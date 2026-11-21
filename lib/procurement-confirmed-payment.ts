import type { SupplierCurrencyPaymentRow } from './procurement-currency-payment-source';
import type { EvidencePlan, ProcurementPaymentEvidence } from './procurement-currency-payment-evidence';
import { paymentFingerprint } from './procurement-manual-payment-links';

import {parseOneCDateTime} from './one-c-date';
import {SMALL_REMAINDER_COMPLETED} from './procurement-small-remainder';

export type ConfirmedPayment = {ref: string; number: string; fingerprint: string};
export type PaymentConfirmation = {planId: string; payment: ConfirmedPayment};
export const paymentKey = (ref: string) => ref.trim().toLowerCase();

export function confirmedPayments(meta: unknown): ConfirmedPayment[] {
  if (!meta || typeof meta !== 'object' || !('confirmedSupplierPayments' in meta) || !Array.isArray(meta.confirmedSupplierPayments)) return [];
  return meta.confirmedSupplierPayments.filter((p): p is ConfirmedPayment => p && typeof p.ref === 'string' &&
    typeof p.number === 'string' && typeof p.fingerprint === 'string');
}

export function describePayment(p: SupplierCurrencyPaymentRow): ConfirmedPayment {
  return {ref: paymentKey(p.ref), number: p.number, fingerprint: JSON.stringify([
    paymentFingerprint(p), p.requestOrderRef || '', p.settlementOrderRef || '',
    [...(p.settlementOrderRefs || [])].sort(), p.settlementCurrency, p.settlementAmount,
    p.settlementMovementsCount, p.verifiedHeaderOrderRef || '',
  ])};
}

// This index holds identities only. Every amount must come from the current native document.
export function confirmedPaymentIndex(plans: EvidencePlan[], payments: SupplierCurrencyPaymentRow[]) {
  const manual = new Set(plans.flatMap(p => (p.manualRubleLinks || []).map(link => paymentKey(link.ref))));
  const owners = new Map<string, string>();
  const issues = new Map<string, {ref: string; message: string}[]>();
  const blocked = new Set<string>();
  const rows = new Map(payments.map(p => [paymentKey(p.ref), p]));
  function review(id: string, ref: string, message: string) {
    blocked.add(ref);
    const existing = issues.get(id) || [];
    if (!existing.some(issue => issue.ref === ref)) issues.set(id, [...existing, {ref, message}]);
  }
  for (const plan of plans) for (const link of confirmedPayments(plan.oneCCashEvidence)) {
    if (manual.has(link.ref)) continue;
    const previous = owners.get(link.ref);
    const row = rows.get(link.ref);
    const label = 'Расходник ' + (link.number || link.ref);
    if (previous && previous !== plan.id) {
      review(previous, link.ref, label + ' связан с двумя заявками');
      review(plan.id, link.ref, label + ' связан с двумя заявками');
    } else if (!row) review(plan.id, link.ref, label + ' не подтверждён выгрузкой 1С');
    else if (!row.posted || row.deleted) review(plan.id, link.ref, label + ' снят с проведения или удалён в 1С');
    else if (describePayment(row).fingerprint !== link.fingerprint) review(plan.id, link.ref, label + ' изменён в 1С');
    owners.set(link.ref, plan.id);
  }
  return {owners, blocked, issues, review};
}


// A fallback candidate alone is insufficient. Check the final allocation across
// all plans and currencies, after split amounts and manual claims are known.
export function collectConfirmedPayments(newOwners: Map<string, string>, evidence: Map<string, ProcurementPaymentEvidence>,
  uniquePayments: SupplierCurrencyPaymentRow[], confirmations: PaymentConfirmation[]) {
  const claims = new Map<string, {owner: string; amount: number}[]>();
  for (const [owner, row] of evidence) {
    for (const doc of [...row.cashOrders, ...row.currencyPayments]) {
      const ref = paymentKey(doc.ref);
      if (newOwners.has(ref)) claims.set(ref, [...(claims.get(ref) || []), {
        owner, amount: 'foreignAmount' in doc ? doc.foreignAmount : doc.amount,
      }]);
    }
  }
  for (const payment of uniquePayments) {
    const ref = paymentKey(payment.ref);
    const owner = newOwners.get(ref);
    const claim = claims.get(ref);
    if (!owner || claim?.length !== 1 || claim[0].owner !== owner || claim[0].amount !== payment.documentAmount ||
        !((parseOneCDateTime(payment.date)?.getTime() ?? Infinity) <= Date.now())) continue;
    const row = evidence.get(owner)!;
    if (!['PAID_BY_ONE_C','PARTIALLY_PAID_BY_ONE_C','ISSUED_BY_ONE_C','PARTIALLY_ISSUED',SMALL_REMAINDER_COMPLETED].includes(row.state) ||
        row.rubleAllocationNeedsReview || row.paymentAmountNeedsConfirmation) continue;
    confirmations.push({planId: owner, payment: describePayment(payment)});
  }
}
