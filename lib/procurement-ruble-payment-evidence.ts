import type { EvidencePlan, ProcurementPaymentEvidence } from './procurement-currency-payment-evidence';
import type { SupplierCurrencyPaymentRow } from './procurement-currency-payment-source';
import { paymentFingerprint, samePaymentSupplier } from './procurement-manual-payment-links';
import {COMPLETED_WITHOUT_TOPUP} from './procurement-payment-completion';

const key = (value: string) => value.trim().toLowerCase();
const minor = (value: number) => Math.round(value * 100);

export function paymentEvidenceFrom(plans: { createdAt: Date | string }[], fallback: Date) {
  const times = plans.map((plan) => new Date(plan.createdAt).getTime()).filter(Number.isFinite);
  return new Date(Math.min(fallback.getTime(), ...times.map((at) => at - 86400_000)));
}

export function paymentTimestamp(value: string) {
  const m = value.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return NaN;
  const at = Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
  const date = new Date(at);
  if (date.getUTCFullYear() !== +m[3] || date.getUTCMonth() !== +m[2] - 1 ||
      date.getUTCDate() !== +m[1] || +m[4] > 23 || +m[5] > 59 || +m[6] > 59) return NaN;
  return at - 3 * 3600_000;
}

/** Register joins may repeat an RKO. Conflicting copies must never prove payment. */
export function uniqueSupplierPayments(rows: SupplierCurrencyPaymentRow[]) {
  const groups = new Map<string, SupplierCurrencyPaymentRow[]>();
  for (const row of rows) {
    if (!row.ref.trim()) continue;
    const ref = key(row.ref);
    groups.set(ref, [...(groups.get(ref) || []), row]);
  }
  return [...groups.values()].flatMap((copies) => {
    const signature = (row: SupplierCurrencyPaymentRow) => JSON.stringify([
      row.date, row.posted, row.deleted, row.documentAmount, row.documentCurrency,
      key(row.baseDocumentRef), row.supplier, row.counterparty, row.contract,row.settlementOrderRef,
    ]);
    return copies.every((row) => signature(row) === signature(copies[0])) ? [copies[0]] : [];
  });
}

/** Call with ALL plans, then expose only the current user's result to the client. */
export function applyRublePaymentEvidence(
  plans: EvidencePlan[], payments: SupplierCurrencyPaymentRow[],
  evidence: Map<string, ProcurementPaymentEvidence>,
) {
  const eligible = plans.filter((plan) => ['APPROVED',COMPLETED_WITHOUT_TOPUP].includes(plan.status||'') &&
    ['CASH', 'ACCOUNTABLE_QR', 'BANK'].includes(plan.paymentMethod) && plan.plannedAmount > 0);
  const claims = new Map<string, Set<string>>();
  for (const plan of plans) {
    for (const order of evidence.get(plan.id)?.cashOrders || []) {
      const ref = key(order.ref);
      if (ref) claims.set(ref, new Set([...(claims.get(ref) || []), plan.id]));
    }
  }
  for (const payment of uniqueSupplierPayments(payments)) {
    if (!payment.posted || payment.deleted || !['РУБ', 'RUB'].includes(payment.documentCurrency) ||
        !Number.isFinite(payment.documentAmount) || payment.documentAmount <= 0) continue;
    const at = paymentTimestamp(payment.date);
    if (!Number.isFinite(at)) continue;
    const manualOwners = plans.filter((plan) => plan.manualRubleLinks?.some((link) => key(link.ref) === key(payment.ref)));
    const completedOwners = plans.filter(plan => plan.status === COMPLETED_WITHOUT_TOPUP && plan.completedPaymentRefs?.includes(payment.ref));
    const candidates = eligible.filter((plan) => {
      if(completedOwners.length && (completedOwners.length !== 1 || completedOwners[0].id !== plan.id))return false;
      if(plan.status===COMPLETED_WITHOUT_TOPUP&&!plan.completedPaymentRefs?.includes(payment.ref))return false;
      const created = Date.parse(plan.createdAt || '');
      const confirmed = manualOwners.length === 1 && manualOwners[0].id === plan.id &&
        plan.manualRubleLinks?.some((link) => link.fingerprint === paymentFingerprint(payment)) && samePaymentSupplier(plan, payment);
      return Number.isFinite(created) && created <= at &&
        (manualOwners.length ? confirmed : Boolean(payment.baseDocumentRef||payment.settlementOrderRef) && plan.orderRefs.some((ref) => key(ref) === key(payment.baseDocumentRef||payment.settlementOrderRef||'')) && (!payment.settlementOrderRef||samePaymentSupplier(plan,payment)));
    });
    // Multiple requests for one order require an explicit link; do not guess by amount/date.
    const owners = claims.get(key(payment.ref));
    if (owners?.size) continue; // Already accounted through the expense request, never twice.
    if (candidates.length !== 1) {
      for (const plan of candidates) {
        const current = evidence.get(plan.id)!;
        if (current.state !== 'ISSUED_BY_ONE_C') evidence.set(plan.id, { ...current, state: 'NEEDS_REVIEW' });
      }
      continue;
    }
    const plan = candidates[0];
    const current = evidence.get(plan.id)!;
    if (current.state === 'MISMATCH') continue;
    evidence.set(plan.id, {
      ...current,
      manualPaymentCount: (current.manualPaymentCount || 0) + (manualOwners.length === 1 ? 1 : 0),
      cashOrders: [...current.cashOrders, {
        ref: payment.ref, number: payment.number, date: payment.date,
        amount: payment.documentAmount, cashbox: payment.cashbox || '',
      }],
    });
    claims.set(key(payment.ref), new Set([plan.id]));
  }
  for (const plan of eligible) {
    const current = evidence.get(plan.id)!;
    const orders = [...new Map(current.cashOrders.map((row) => [key(row.ref), row])).values()];
    const conflicting = orders.some((row) => !row.ref || (claims.get(key(row.ref))?.size || 0) > 1);
    const totalMinor = conflicting ? 0 : orders.reduce((sum, row) => sum + minor(row.amount), 0);
    const issuedAmount = totalMinor / 100;
    evidence.set(plan.id, {
      ...current, cashOrders: orders, issuedAmount,
      // Consumers sum issuedAmount (RUB RKO) + paidAmount (USDT equivalent).
      paidAmount: 0,
      remainingAmount: Math.max(0, minor(plan.plannedAmount) - totalMinor) / 100,
      state: conflicting ? 'NEEDS_REVIEW' : current.state === 'MISMATCH' ? 'MISMATCH' :
        totalMinor > 0 ? totalMinor >= minor(plan.plannedAmount) ? 'ISSUED_BY_ONE_C' :
          current.state === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' : 'PARTIALLY_ISSUED' : current.state,
    });
  }
}
