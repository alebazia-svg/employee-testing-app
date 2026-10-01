import type { ExpenseRequestSourceRow } from './expense-request-source';
import type { EvidencePlan, ProcurementPaymentEvidence } from './procurement-currency-payment-evidence';
import { requestSettlementOrderRef } from './procurement-request-order';
import { moscowDateKey, parseOneCDateTime } from './one-c-date';

export type ProcurementCollection = {
  requestRef: string;
  amount: number;
  cashbox: string;
  cashboxRef: string;
  date: string;
};
const key = (v: unknown) => typeof v === 'string' ? v.trim().toLowerCase() : '';
const uuid = (v: unknown) => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(key(v)) && key(v) !== '00000000-0000-0000-0000-000000000000';
const cents = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(Math.round(v * 100))
  && Math.abs(v * 100 - Math.round(v * 100)) < .0001 ? Math.round(v * 100) : NaN;
const clean = (v: Record<string, any> | null | undefined) => v?.complete === true && v.truncated !== true
  && Array.isArray(v.errors) && v.errors.length === 0 && (!v.missing_fields || Array.isArray(v.missing_fields) && v.missing_fields.length === 0);

/** A collection permission is NOT evidence of payment. Source is a payable native
 * supplier request; no matching by amount/date alone and no cross-plan allocation.
 */
function nativeCollection(r: ExpenseRequestSourceRow): ProcurementCollection | null {
  const e = r.execution as Record<string, any> | null;
  const links = r.linked_cash_expense_orders;
  const amount = cents(r.amount), remaining = cents(e?.remaining_amount), issued = cents(e?.executed_amount);
  const date = parseOneCDateTime(r.desired_payment_date || r.payment_date);
  if (!uuid(r.ref) || r.posted !== true || r.deletion_mark !== false || r.status?.key !== 'payable'
    || r.business_operation?.name !== 'Оплата поставщику' || !['руб', 'rub', 'руб.'].includes(key(r.currency?.name))
    || r.payment_form?.cash !== true || r.payment_form.cashless !== false || r.payment_form.card !== false
    || !uuid(r.cashbox?.ref) || !r.cashbox?.name?.trim() || !date || date.getUTCFullYear() < 2000
    || r.completeness?.request !== true || r.completeness?.execution !== true || r.completeness?.linked_cash_expense_orders !== true
    || !clean(e) || !clean(links) || !Array.isArray(links?.rows)
    || e?.source !== 'РегистрНакопления.ДенежныеСредстваКВыплате' || e.amounts_consistent !== true
    || amount <= 0 || remaining <= 0 || issued < 0 || issued + remaining !== amount
    || cents(e.request_amount) !== amount || cents(e.register_remaining_amount) !== remaining) return null;
  if (issued === 0 ? e.state !== 'not_executed' || e.has_execution_movements !== false
    : e.state !== 'partially_executed' || e.has_execution_movements !== true || e.remaining_amount_source !== 'money_payable_register_balance') return null;
  const seen = new Set<string>(); let direct = 0;
  for (const p of links.rows) {
    if (!uuid(p.ref) || seen.has(key(p.ref)) || p.request_amount_conflict === true
      || typeof p.posted !== 'boolean' || typeof p.deletion_mark !== 'boolean') return null;
    seen.add(key(p.ref));
    const executed = cents(p.executed_amount);
    if (!(executed >= 0)) return null;
    if (!p.posted || p.deletion_mark) { if (executed !== 0) return null; continue; }
    if (!p.source_paths?.some(path => ['header.request', 'payment_line.request'].includes(path))
      || executed !== cents(p.request_amount) || !(executed <= cents(p.amount))) return null;
    direct += executed;
  }
  if (direct !== issued) return null;
  return { requestRef: key(r.ref), amount: remaining / 100, cashbox: r.cashbox.name.trim(), cashboxRef: key(r.cashbox.ref), date: moscowDateKey(date) };
}

export function procurementCollections(plans: EvidencePlan[], requests: ExpenseRequestSourceRow[], evidence: Map<string, ProcurementPaymentEvidence>) {
  const candidates = new Map<string, ProcurementCollection[]>();
  const refs = new Map<string, number>();
  for (const r of requests) refs.set(key(r.ref), (refs.get(key(r.ref)) || 0) + 1);
  for (const r of requests) {
    if (refs.get(key(r.ref)) !== 1) continue;
    const native = nativeCollection(r), order = requestSettlementOrderRef(r);
    const created = parseOneCDateTime(r.date)?.getTime();
    if (!native || !order || !uuid(order) || created === undefined) continue;
    const owners = plans.filter(p => {
      const e = evidence.get(p.id);
      return p.status === 'APPROVED' && p.paymentMethod === 'CASH' && !p.foreignAmount
        && p.orderRefs.some(ref => key(ref) === order) && key(p.supplierPartner) === key(r.partner?.name)
        && (!p.supplierCounterparty || key(p.supplierCounterparty) === key(r.counterparty?.name))
        && Number.isFinite(Date.parse(p.createdAt || '')) && Date.parse(p.createdAt!) <= created
        && e && ['NO_EVIDENCE', 'NEEDS_REVIEW', 'PARTIALLY_ISSUED'].includes(e.state)
        && !e.rubleAllocationNeedsReview && !e.paymentAmountNeedsConfirmation && e.remainingAmount > 0;
    });
    if (owners.length !== 1) continue;
    const p = owners[0], e = evidence.get(p.id)!;
    // Do not silently crop an excessive permission or offer the already paid part.
    const outstanding = cents(p.plannedAmount) - Math.max(cents(e.issuedAmount), cents(e.paidAmount));
    if (cents(native.amount) > Math.min(outstanding, cents(e.remainingAmount))) continue;
    candidates.set(p.id, [...(candidates.get(p.id) || []), native]);
  }
  return new Map([...candidates].filter(([, rows]) => rows.length === 1).map(([id, rows]) => [id, rows[0]]));
}

export function procurementCollectionCopy(collection: ProcurementCollection, today: string) {
  const amount = collection.amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽';
  const date = new Date(collection.date + 'T12:00:00+03:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });
  return { title: collection.date > today ? `Получить ${date} · ${amount}` : `Можно получить ${amount}`, body: collection.cashbox };
}
