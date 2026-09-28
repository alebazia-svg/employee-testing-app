import { parseOneCDateTime } from './one-c-date';
import { DELIVERY_PERSON, DELIVERY_MAX_AGE_MS } from './procurement-delivery-policy';

type Row = Record<string, unknown>;
export type DeliveryFunding = {
  checkedAt: string;
  cashboxes: { ref: string; name: string; balance: number; pending: number | null; count: number }[];
  topups: { ref: string; number: string; date: string; status: string; remaining: number | null }[];
  unassignedCount: number;
  unassignedAmount: number;
  reviewCount: number;
};
function requireValue(value: unknown): asserts value { if (!value) throw Error('FUNDING_INVALID'); }
function object(value: unknown): Row {
  requireValue(value && typeof value === 'object' && !Array.isArray(value)); return value as Row;
}
function rows(value: unknown, cap: number): Row[] {
  requireValue(Array.isArray(value) && value.length <= cap); return (value as unknown[]).map(object);
}
function text(value: unknown) { requireValue(typeof value === 'string' && value.trim()); return value as string; }
function ref(value: unknown, optional = false): string {
  if (optional && (value === null || value === '' || value === '00000000-0000-0000-0000-000000000000')) return '';
  const s = text(value); requireValue(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s)); return s.toLowerCase();
}
function cents(value: unknown): number {
  requireValue(typeof value === 'number' && Number.isFinite(value));
  const n = Math.round((value as number) * 100);
  requireValue(Number.isSafeInteger(n) && Math.abs((value as number) * 100 - n) < 0.0001); return n;
}
function unique(items: Row[], key: (r: Row) => string) {
  const map = new Map<string, Row>();
  for (const r of items) { const k = key(r); requireValue(!map.has(k)); map.set(k, r); }
  return map;
}
const grain = (r: Row) => JSON.stringify([ref(r.document_ref), ref(r.source_ref, true), ref(r.recipient_ref, true)]);

// Explicit active employee mappings only. Never infer eligibility from a cashbox name.
// Filter after reconciliation: other sources and unallocated obligations must not
// disappear from the evidence checks or become assigned to a manager's cashbox.
export function deliveryFundingForManagerCashboxes(data: DeliveryFunding, cashboxRefs: readonly string[]): DeliveryFunding {
  const allowed = new Set(cashboxRefs.map(id => ref(id)));
  return { ...data, cashboxes: data.cashboxes.filter(box => allowed.has(box.ref)) };
}

// Read-only presentation. No available-cash formula, automatic ranking or payment action.
export function deliveryFundingFromEvidence(value: unknown, now = Date.now()): DeliveryFunding {
  const d = object(value);
  requireValue(d.ok === true && d.complete === true && d.contract_version === 'cash-funding-context-v2');
  requireValue(d.mode === 'read-only' && d.write_operations === false && d.snapshot_consistent === false);
  requireValue(d.automatic_spending_allowed === false && d.automatic_cashbox_selection_allowed === false && d.available_cash_calculated === false);
  requireValue(d.organization_ref === DELIVERY_PERSON.organizationRef);
  requireValue(d.payables_scope === 'current_active_register_all_dates_including_future_plans');
  requireValue(d.requests_scope === 'non_deleted_unposted_or_no_active_history_or_nonzero_native_balance_all_dates_all_forms');
  requireValue(d.movement_scope === 'nonzero_groups_only_same_grain_as_native_balances');
  const at = parseOneCDateTime(d.cash_as_of), end = parseOneCDateTime(d.read_finished_at);
  requireValue(at && end && end >= at && now - at.getTime() >= -60_000 && now - at.getTime() <= DELIVERY_MAX_AGE_MS && end.getTime() <= now + 60_000);
  const complete = object(d.sections_complete);
  for (const s of ['cash', 'requests', 'distribution', 'payables', 'payable_movements']) requireValue(complete[s] === true);
  const cash = unique(rows(d.cash, 1000), r => ref(r.cashbox_ref));
  const requests = unique(rows(d.requests, 1000), r => ref(r.request_ref));
  const balances = unique(rows(d.payables, 10000), grain);
  const movements = unique(rows(d.payable_movements, 10000), grain);
  for (const key of new Set([...balances.keys(), ...movements.keys()])) {
    const b = balances.get(key), m = movements.get(key);
    const remaining = b ? cents(b.remaining_amount) : 0;
    const net = m ? cents(m.planned_amount) - cents(m.executed_amount) : 0;
    requireValue(Number.isSafeInteger(net) && remaining === net);
  }
  for (const r of requests.values()) {
    requireValue(r.organization_ref === DELIVERY_PERSON.organizationRef);
    ref(r.currency_ref); cents(r.amount); text(r.version_token);
    requireValue(typeof r.posted === 'boolean' && typeof r.is_accountable_issue === 'boolean' && typeof r.multiple_recipients === 'boolean');
    requireValue(['approved', 'payable', 'not_approved', 'rejected', 'unknown'].includes(text(r.status_key)));
    if (r.is_accountable_issue && !r.multiple_recipients) ref(r.accountable_person_ref);
  }
  for (const r of unique(rows(d.distribution, 10000), r => {
    requireValue(Number.isSafeInteger(r.line_number) && Number(r.line_number) > 0);
    return JSON.stringify([ref(r.request_ref), r.line_number]);
  }).values()) { requireValue(requests.has(ref(r.request_ref))); cents(r.amount); }

  const cashboxes: DeliveryFunding['cashboxes'] = [];
  const cashIndex = new Map<string, DeliveryFunding['cashboxes'][number]>();
  for (const [id, r] of cash) {
    ref(r.currency_ref); cents(r.balance); requireValue(typeof r.deleted === 'boolean');
    if (r.currency_ref !== DELIVERY_PERSON.currencyRef || r.deleted) continue;
    const box = { ref: id, name: text(r.cashbox_name), balance: cents(r.balance) / 100, pending: 0 as number | null, count: 0 };
    cashboxes.push(box); cashIndex.set(id, box);
  }
  const unassigned = new Set<string>(), review = new Set<string>();
  let unassignedCents = 0;
  const byRequest = new Map<string, Row[]>();
  for (const b of balances.values()) {
    const id = ref(b.document_ref), source = ref(b.source_ref, true), amount = cents(b.remaining_amount);
    byRequest.set(id, [...(byRequest.get(id) ?? []), b]);
    const r = requests.get(id), box = cashIndex.get(source);
    const known = r && r.currency_ref === DELIVERY_PERSON.currencyRef && r.posted === true
      && ['approved', 'payable', 'not_approved'].includes(String(r.status_key)) && amount > 0;
    if (box) {
      box.count++;
      if (!known) { box.pending = null; review.add(id); }
      else if (box.pending !== null) { box.pending = (cents(box.pending) + amount) / 100; requireValue(Number.isSafeInteger(cents(box.pending))); }
    } else if (!source && known) {
      unassigned.add(id); unassignedCents += amount; requireValue(Number.isSafeInteger(unassignedCents));
    } else if (!source || !cash.has(source) || amount < 0) review.add(id);
  }
  const topups: DeliveryFunding['topups'] = [];
  for (const [id, r] of requests) {
    const parts = byRequest.get(id) ?? [];
    if (!parts.length && r.status_key !== 'rejected') review.add(id);
    if (!r.is_accountable_issue || r.multiple_recipients || r.accountable_person_ref !== DELIVERY_PERSON.ref || r.currency_ref !== DELIVERY_PERSON.currencyRef) continue;
    if (r.status_key === 'rejected' && !parts.length) continue;
    const confirmed = r.posted && ['approved', 'payable', 'not_approved'].includes(String(r.status_key))
      && parts.length > 0 && parts.every(p => cents(p.remaining_amount) > 0 && ref(p.recipient_ref, true) === DELIVERY_PERSON.ref);
    const total = parts.reduce((n, p) => n + cents(p.remaining_amount), 0); requireValue(Number.isSafeInteger(total));
    topups.push({ ref: id, number: text(r.number), date: parseOneCDateTime(r.date)?.toISOString() ?? '',
      status: String(r.status_key), remaining: confirmed ? total / 100 : null });
  }
  return { checkedAt: at.toISOString(), cashboxes: cashboxes.sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    topups: topups.sort((a, b) => b.date.localeCompare(a.date) || a.ref.localeCompare(b.ref)),
    unassignedCount: unassigned.size, unassignedAmount: unassignedCents / 100, reviewCount: review.size };
}
