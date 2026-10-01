import type { EvidencePlan, ProcurementPaymentEvidence } from './procurement-currency-payment-evidence';
import type { SupplierCurrencyPaymentRow } from './procurement-currency-payment-source';
import { paymentFingerprint, samePaymentSupplier } from './procurement-manual-payment-links';
import {COMPLETED_WITHOUT_TOPUP} from './procurement-payment-completion';
import {hasConfirmedPaymentBasis} from './procurement-payment-basis';

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
      row.settlementAmount, row.settlementCurrency, row.settlementMovementsCount, row.requestOrderRef, row.settlementOrderRefs, row.verifiedHeaderOrderRef,
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
  // Rebuild coverage from this read, oldest first. A persisted "paid" flag
  // cannot release another request after an earlier RKO is unposted/removed.
  const coveredBefore = (plan: EvidencePlan, at: number) => {
    const current = evidence.get(plan.id)!;
    if (current.state === 'MISMATCH') return false;
    const orders = [...new Map(current.cashOrders.map(row => [key(row.ref), row])).values()];
    const covered = orders.reduce((sum, row) => {
      const owners = claims.get(key(row.ref));
      const paidAt = paymentTimestamp(row.date);
      // Do not infer an ordering for documents in the same second, or use
      // a later explicit payment to resolve an earlier ambiguous one.
      return owners?.size === 1 && owners.has(plan.id) && Number.isFinite(paidAt) && paidAt < at &&
        Number.isFinite(row.amount) && row.amount > 0 ? sum + minor(row.amount) : sum;
    }, 0);
    return covered >= minor(plan.plannedAmount);
  };
  const orderedPayments = uniqueSupplierPayments(payments)
    .filter(payment => Number.isFinite(paymentTimestamp(payment.date)))
    .sort((a, b) => paymentTimestamp(a.date) - paymentTimestamp(b.date) || key(a.ref).localeCompare(key(b.ref)));
  for (const payment of orderedPayments) {
    if (!payment.posted || payment.deleted || !['РУБ', 'RUB'].includes(payment.documentCurrency) ||
        !Number.isFinite(payment.documentAmount) || payment.documentAmount <= 0) continue;
    const at = paymentTimestamp(payment.date);
    if (!Number.isFinite(at)) continue;
    const orderRef = payment.requestOrderRef || payment.baseDocumentRef || payment.settlementOrderRef || '';
    const allocatedOrders = payment.settlementOrderRefs?.map(key) ?? [];
    const manualOwners = plans.filter((plan) => plan.manualRubleLinks?.some((link) => key(link.ref) === key(payment.ref)));
    const completedOwners = plans.filter(plan => plan.status === COMPLETED_WITHOUT_TOPUP && plan.completedPaymentRefs?.includes(payment.ref));
    const availablePlans = eligible.filter((plan) => {
      if(completedOwners.length && (completedOwners.length !== 1 || completedOwners[0].id !== plan.id))return false;
      if(plan.status===COMPLETED_WITHOUT_TOPUP&&!plan.completedPaymentRefs?.includes(payment.ref))return false;
      const created = Date.parse(plan.createdAt || '');
      const confirmed = manualOwners.length === 1 && manualOwners[0].id === plan.id &&
        plan.manualRubleLinks?.some((link) => link.fingerprint === paymentFingerprint(payment)) && samePaymentSupplier(plan, payment);
      // Explicit ownership remains authoritative. Only automatic
      // matching stops when earlier uniquely owned receipts cover the request.
      if (!manualOwners.length && plan.status !== COMPLETED_WITHOUT_TOPUP && coveredBefore(plan, at)) return false;
      return Number.isFinite(created) && created <= at && (!manualOwners.length || confirmed);
    });
    let candidates = availablePlans.filter(plan => manualOwners.length || (allocatedOrders.length
          ? allocatedOrders.some(ref=>plan.orderRefs.some(p=>key(p)===ref)) && samePaymentSupplier(plan,payment)
          : Boolean(orderRef) && plan.orderRefs.some((ref) => key(ref) === key(orderRef)) && (!(payment.settlementOrderRef || payment.requestOrderRef) || samePaymentSupplier(plan,payment))));
    // Owner-approved supplier-debt workflow: the planning basis need not be
    // the RKO settlement basis. Explicit order/code/manual ownership wins.
    // Otherwise only a sole outstanding RUB request to this supplier may
    // consume the payment. Do not choose between requests by matching amounts.
    let supplierDebtFallback = false;
    if (!manualOwners.length && !completedOwners.length && !candidates.length) {
      const supplierPlans = availablePlans.filter(plan => samePaymentSupplier(plan, payment));
      if (supplierPlans.some(plan => !plan.orderRefs.length)) {
        candidates = supplierPlans;
        supplierDebtFallback = true;
      }
    }
    // Multiple requests for one order require an explicit link; do not guess by amount/date.
    const owners = claims.get(key(payment.ref));
    if (owners?.size) continue; // Already accounted through the expense request, never twice.
    const debtPlan = supplierDebtFallback && candidates.length === 1 ? candidates[0] : undefined;
    const alreadyIssued = debtPlan ? evidence.get(debtPlan.id)!.cashOrders.reduce((sum, row) => sum + minor(row.amount), 0) : 0;
    // A shared trading name must not override conflicting legal counterparties.
    const counterpartyConflict = debtPlan?.supplierCounterparty.trim() && payment.counterparty?.trim() &&
      !samePaymentSupplier({ supplierPartner: '', supplierCounterparty: debtPlan.supplierCounterparty },
        { ...payment, supplier: '' });
    if (candidates.length !== 1 || (supplierDebtFallback
      ? !debtPlan || debtPlan.orderRefs.length > 0 || !hasConfirmedPaymentBasis(payment, plans.flatMap(plan => plan.orderRefs)) || counterpartyConflict || minor(payment.documentAmount) > minor(debtPlan.plannedAmount) - alreadyIssued
      : !manualOwners.length && allocatedOrders.some(ref=>!candidates[0]?.orderRefs.some(p=>key(p)===ref)))) {
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
