import { DELIVERY_PERSON, DELIVERY_MAX_AGE_MS } from './procurement-delivery-policy';
import { parseOneCDateTime } from './one-c-date';

export type DeliveryNativeStatus = {
  ref: string; number: string; date: string; amount: number;
  state: 'waiting' | 'approved' | 'payable' | 'partial' | 'issued' | 'rejected' | 'review';
  issued: number | null; remaining: number | null;
  cashbox: string | null; desiredDate: string | null; checkedAt: string;
  canCollect?: boolean;
};
export type DeliveryNativeView = { state: 'unlinked' | 'linked' | 'unavailable'; status?: DeliveryNativeStatus; automatic?: boolean; reviewReason?: 'ambiguous' | 'manual' };
export type DeliveryNativeCandidate = { status: DeliveryNativeStatus; quote: string };
export type DeliveryNativeLink = { version: 1; ref: string; date: string; amount: number; userId: number; linkedAt: string };
export const DELIVERY_LINK_SOURCE = 'procurement_delivery_link';
export const deliveryLinkKey = (reminderId: string) => `delivery:native:${reminderId}`;
/** Personal collection instruction, not an inferred cash balance. */
export function deliveryCollectionAmount(s?: DeliveryNativeStatus): number | null {
  if (!s?.cashbox || !['payable', 'partial'].includes(s.state)
    || (s.state === 'partial' && s.canCollect !== true)
    || s.remaining === null || !Number.isFinite(s.remaining) || s.remaining <= 0) return null;
  return s.remaining;
}
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function deliveryNativeFresh(status: DeliveryNativeStatus, now = Date.now()) {
  const age = now - Date.parse(status.checkedAt);
  return Number.isFinite(age) && age >= -60_000 && age <= DELIVERY_MAX_AGE_MS;
}
export function readDeliveryLink(body: string): DeliveryNativeLink {
  const d = JSON.parse(body);
  if (d.version !== 1 || typeof d.ref !== 'string' || !uuid.test(d.ref)
    || typeof d.date !== 'string' || !parseOneCDateTime(d.date)
    || !Number.isSafeInteger(d.userId) || typeof d.amount !== 'number' || !Number.isFinite(d.amount) || d.amount <= 0
    || typeof d.linkedAt !== 'string' || !Number.isFinite(Date.parse(d.linkedAt))) throw Error('DELIVERY_LINK_INVALID');
  return d;
}
type Row = Record<string, any>;
function object(v: unknown): Row {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('DELIVERY_NATIVE_INVALID');
  return v as Row;
}
function cents(v: unknown) {
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isSafeInteger(Math.round(v * 100))
    || Math.abs(v * 100 - Math.round(v * 100)) > .0001) throw Error('DELIVERY_NATIVE_AMOUNT');
  return Math.round(v * 100);
}
function cleanBranch(v: unknown): Row {
  const d = object(v);
  if (d.complete !== true || d.truncated === true || !Array.isArray(d.errors) || d.errors.length
    || (Array.isArray(d.missing_fields) && d.missing_fields.length)) throw Error('DELIVERY_NATIVE_INCOMPLETE');
  return d;
}
export function deliveryNativeIdentity(value: unknown) {
  const r = object(value);
  return r.accountable_identity_contract === 'expense-request-accountable-v1'
    && r.accountable_person?.ref === DELIVERY_PERSON.ref && r.organization?.ref === DELIVERY_PERSON.organizationRef
    && r.currency?.ref === DELIVERY_PERSON.currencyRef && r.is_accountable_issue === true
    && r.multiple_recipients === false && r.payment_form?.cash === true
    && r.payment_form?.cashless === false && r.payment_form?.card === false;
}

/** Only this allowlisted personal projection may be sent to the buyer. */
export function deliveryNativeStatus(value: unknown, checkedAt: string, expectedAmount?: number): DeliveryNativeStatus {
  const r = object(value);
  if (!deliveryNativeIdentity(r) || typeof r.ref !== 'string' || !uuid.test(r.ref)
    || typeof r.version_token !== 'string' || !r.version_token.trim()
    || typeof r.number !== 'string' || !r.number.trim() || !parseOneCDateTime(r.date)) throw Error('DELIVERY_NATIVE_IDENTITY');
  const amount = cents(r.amount);
  if (amount <= 0) throw Error('DELIVERY_NATIVE_AMOUNT');
  const result: DeliveryNativeStatus = { ref: r.ref, number: r.number, date: parseOneCDateTime(r.date)!.toISOString(),
    amount: amount / 100, state: 'review', issued: null, remaining: null, cashbox: null, desiredDate: null, checkedAt };
  if (!deliveryNativeFresh(result) || r.posted !== true || r.deletion_mark !== false
    || (expectedAmount !== undefined && cents(expectedAmount) !== amount)) return result;
  try {
    const e = cleanBranch(r.execution), links = cleanBranch(r.linked_cash_expense_orders);
    if (!Array.isArray(links.rows) || e.source !== 'РегистрНакопления.ДенежныеСредстваКВыплате'
      || e.amounts_consistent !== true || cents(e.request_amount) !== amount) return result;
    const issued = cents(e.executed_amount), remaining = cents(e.remaining_amount);
    if (issued < 0 || remaining < 0 || issued + remaining !== amount) return result;
    const seen = new Set<string>(); let direct = 0;
    for (const value of links.rows) {
      const p = object(value);
      if (typeof p.ref !== 'string' || !uuid.test(p.ref) || seen.has(p.ref) || p.request_amount_conflict === true) return result;
      seen.add(p.ref);
      const executed = cents(p.executed_amount);
      if (executed < 0 || typeof p.posted !== 'boolean' || typeof p.deletion_mark !== 'boolean') return result;
      if (!p.posted || p.deletion_mark) { if (executed !== 0) return result; continue; }
      if (!Array.isArray(p.source_paths) || !p.source_paths.some((x: unknown) => x === 'header.request' || x === 'payment_line.request')) return result;
      if (executed !== cents(p.request_amount) || executed > cents(p.amount)) return result;
      direct += executed;
    }
    if (!Number.isSafeInteger(direct) || direct !== issued) return result;
    if (issued > 0 && (e.has_execution_movements !== true || e.remaining_amount_source !== 'money_payable_register_balance'
      || cents(e.register_remaining_amount) !== remaining || !['partially_executed', 'fully_executed'].includes(e.state))) return result;
    if (issued === 0 && (e.has_execution_movements !== false || e.state !== 'not_executed'
      || ![0, amount].includes(cents(e.register_remaining_amount)))) return result;
    const key = r.status?.key;
    if (!['approved', 'payable', 'not_approved', 'rejected'].includes(key)) return result;
    if (issued > 0 && !['approved', 'payable'].includes(key)) return result;
    result.state = issued > 0 ? (remaining === 0 ? 'issued' : 'partial')
      : key === 'not_approved' ? 'waiting' : key === 'rejected' ? 'rejected' : key;
    result.issued = issued / 100; result.remaining = remaining / 100;
    // This is the requested cashbox, never a claim of reservation or actual RKO source.
    if (typeof r.cashbox?.name === 'string' && uuid.test(r.cashbox?.ref ?? '')) result.cashbox = r.cashbox.name;
    result.canCollect = key === 'payable' && remaining > 0 && Boolean(result.cashbox);
    const desired = parseOneCDateTime(r.desired_payment_date);
    result.desiredDate = desired && desired.getUTCFullYear() >= 2000 ? desired.toISOString() : null;
    return result;
  } catch { return result; }
}
