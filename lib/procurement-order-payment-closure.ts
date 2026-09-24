import { evaluateAcquisitionSettlement } from './procurement-acquisition-settlement';
import { parseOneCDateTime } from './one-c-date';
import type { SupplierCurrencyPaymentRow } from './procurement-currency-payment-source';

export type OrderPaymentClosure = {
  state: 'paid' | 'small_balance'; remainingRub: number; checkedAt: string;
  recheckPending?: boolean;
  receipts: { ref?: string; number: string; amountRub: number; remainingRub: number;
    payments: { ref?: string; number: string; date: string; amount: number; currency: string; appliedRub: number;
      method?: 'direct' | 'advance' }[] }[];
};
const rub = (value: string) => ['руб','rub','₽','российский рубль'].includes(value.toLocaleLowerCase('ru'));
function minor(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0
    || !Number.isSafeInteger(Math.round(value * 100)) || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) throw Error('INVALID_AMOUNT');
  return Math.round(value * 100);
}
function scope(m: Record<string, any>) {
  const keys = ['analytics_ref', 'settlement_object_ref', 'currency_ref'];
  if (keys.some(key => typeof m[key] !== 'string' || !m[key])) throw Error('MISSING_SCOPE');
  return JSON.stringify(keys.map(key => m[key]));
}
/** Proof follows exact register references, including cash -> advance -> receipt.
 * Dates and amounts never create a link. Unsupported offsets remain unresolved. */
export function orderPaymentClosure(detail: Record<string, any>, orderRef: string,
  source: { complete: boolean; payments: SupplierCurrencyPaymentRow[] }, checkedAt: string): OrderPaymentClosure | undefined {
  try {
  if (!source.complete || detail.order_links_complete !== true || detail.planning_links_contract !== 'supplier-planning-links-v1') return;
  const acquisition = evaluateAcquisitionSettlement(detail, orderRef);
  if (acquisition.state !== 'verified' || !acquisition.receipts.length) return;
  const payments = new Map<string, SupplierCurrencyPaymentRow>();
  for (const p of source.payments) {
    const previous = payments.get(p.ref);
    if (previous && JSON.stringify(previous) !== JSON.stringify(p)) return;
    if (!p.posted || p.deleted || !p.ref || !p.number || !(p.documentAmount > 0)) continue;
    payments.set(p.ref, p);
  }
  const result: OrderPaymentClosure['receipts'] = [];
  const totalApplied = new Map<string, number>();
  const from = parseOneCDateTime(detail.movement_date_from);
  const through = parseOneCDateTime(detail.as_of);
  if (!from || !through) return;
  const checkMovement = (m: Record<string, any>) => {
    const at = parseOneCDateTime(m.movement_date);
    if (!at || at < from || at > through || !['Приход', 'Расход'].includes(m.movement_type)) throw Error('INVALID_MOVEMENT');
    scope(m);
    return at;
  };
  const checkPayment = (ref: string, movement: Record<string, any>) => {
    const p = payments.get(ref);
    const paidAt = p && parseOneCDateTime(p.date);
    if (!p || !paidAt || paidAt > through || paidAt > checkMovement(movement)) throw Error('UNPROVEN_PAYMENT');
    return p;
  };
  for (const r of acquisition.receipts) {
    const links = detail.order_links?.filter((l: any) => l.receipt_ref === r.ref);
    if (links?.length !== 1 || links[0].order_ref !== orderRef || links[0].order_supplier_ref !== detail.order[0].supplier_ref) return;
    const raw = detail.receipts.find((x: any) => x.receipt_ref === r.ref);
    const date = parseOneCDateTime(raw?.receipt_date);
    if (!date || !from || !through || date < from || r.status === 'needs_review' || r.outstandingMinor === null
      || !rub(r.currencyName)) return;
    const movements = detail.due_date_movements.filter((m: any) => m.settlement_document_ref === r.ref);
    let recognized = 0, incoming = 0, outgoing = 0;
    const applied = new Map<string, { ref: string; method: 'direct' | 'advance'; amount: number }>();
    const advanceOffsets = new Map<string, { movement: Record<string, any>; amount: number }>();
    const addPayment = (ref: string, amount: number, method: 'direct' | 'advance') => {
      const key = `${ref}:${method}`;
      applied.set(key, { ref, method, amount: (applied.get(key)?.amount || 0) + amount });
      totalApplied.set(ref, (totalApplied.get(ref) || 0) + amount);
    };
    for (const m of movements) {
      const at = checkMovement(m);
      const value = minor(m.raw_debt);
      if (m.currency_ref !== r.currencyRef) return;
      if (m.movement_type === 'Приход') {
        incoming += value;
        if (m.source_recorder_ref === r.ref) recognized += value;
      } else if (value > 0) {
        outgoing += value;
        if (m.source_recorder_ref === r.ref) {
          const key = `${scope(m)}:${at.getTime()}`;
          advanceOffsets.set(key, { movement: m, amount: (advanceOffsets.get(key)?.amount || 0) + value });
        } else {
          const p = checkPayment(m.source_recorder_ref, m);
          addPayment(p.ref, value, 'direct');
        }
      }
    }
    for (const { movement, amount } of advanceOffsets.values()) {
      // Both legs must belong to the same receipt registrar, analytics, object,
      // currency and event time. A supplier-wide advance cannot satisfy this.
      const offsets = detail.due_date_movements.filter((m: any) => m.source_recorder_ref === r.ref
        && m.movement_type === 'Расход' && m.raw_prepayment > 0
        && scope(m) === scope(movement)
        && checkMovement(m).getTime() === checkMovement(movement).getTime());
      if (offsets.reduce((sum: number, m: any) => sum + minor(m.raw_prepayment), 0) !== amount) return;
      for (const offset of offsets) {
        const p = checkPayment(offset.settlement_document_ref, offset);
        const advanceHistory = detail.due_date_movements.filter((m: any) => m.settlement_document_ref === p.ref && scope(m) === scope(offset));
        let created = 0, consumed = 0;
        for (const m of advanceHistory) {
          checkMovement(m);
          const value = minor(m.raw_prepayment ?? 0);
          if (m.movement_type === 'Приход' && value) {
            if (m.source_recorder_ref !== p.ref) return;
            checkPayment(p.ref, m);
            created += value;
          } else if (m.movement_type === 'Расход') consumed += value;
        }
        // Require the original advance, not merely an offset with an empty
        // current balance. Missing older history must not earn a paid badge.
        if (created <= 0 || consumed > created || (rub(p.documentCurrency) && created > minor(p.documentAmount))) return;
        addPayment(p.ref, minor(offset.raw_prepayment), 'advance');
      }
    }
    if (!detail.receipt_source_movements.some((m: any) => m.recorder_ref === r.ref && m.raw_amount > 0)
      || recognized !== r.documentAmountMinor || incoming !== recognized || outgoing <= 0
      || incoming - outgoing !== r.outstandingMinor) return;
    result.push({ ref: r.ref, number: r.number, amountRub: r.documentAmountMinor / 100, remainingRub: r.outstandingMinor / 100,
      payments: [...applied.values()].map(({ref, amount, method}) => { const p = payments.get(ref)!;
        return { ref, number: p.number, date: p.date, amount: p.documentAmount, currency: p.documentCurrency, appliedRub: amount / 100, method }; }) });
  }
  const remaining = acquisition.receipts.reduce((sum, r) => sum + r.outstandingMinor!, 0);
  for (const [ref, applied] of totalApplied) {
    const p = payments.get(ref)!;
    if (rub(p.documentCurrency) && applied > minor(p.documentAmount)) return;
  }
  if (remaining > 50000) return;
  return { state: remaining === 0 ? 'paid' : 'small_balance', remainingRub: remaining / 100, checkedAt, receipts: result };
  } catch { return; }
}

export function hasCurrentPaymentClosure(row: { paymentClosure?: OrderPaymentClosure }, now = Date.now()) {
  return hasRecordedPaymentClosure(row, now) && !row.paymentClosure!.recheckPending && now - Date.parse(row.paymentClosure!.checkedAt) <= 15 * 60000;
}

export function hasCurrentPaidClosure(row: { paymentClosure?: OrderPaymentClosure }, now = Date.now()) {
  return hasRecordedPaidClosure(row, now) && !row.paymentClosure!.recheckPending && now - Date.parse(row.paymentClosure!.checkedAt) <= 15 * 60000;
}

/** Historical evidence does not become unpaid merely because refresh is late. */
export function hasRecordedPaymentClosure(row: { paymentClosure?: OrderPaymentClosure }, now = Date.now()) {
  const c = row.paymentClosure;
  if (!c || !['paid','small_balance'].includes(c.state) || !c.receipts.length) return false;
  const age = now - Date.parse(c.checkedAt);
  return Number.isFinite(age) && age >= -60000 && c.remainingRub >= 0 && c.remainingRub <= 500;
}

/** Only a zero remainder is removed from planning. A positive balance through
 * 500 RUB remains a real 1C balance and is shown as a separate category. */
export function hasRecordedPaidClosure(row: { paymentClosure?: OrderPaymentClosure }, now = Date.now()) {
  return row.paymentClosure?.state === 'paid' && hasRecordedPaymentClosure(row, now);
}
