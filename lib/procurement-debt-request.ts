import { isFinishedPaymentState } from './procurement-small-remainder';
import { planningRequestOverlap } from './procurement-planning-overlap';
/** Empty orderRefs persist the supplier-debt basis; no synthetic order goes to 1C. */
export function isSupplierDebtPlan(plan: { orderRefs: unknown }) {
  return Array.isArray(plan.orderRefs) && plan.orderRefs.length === 0;
}

export function paymentBasisChanged(before: { orderRefs: unknown }, after: { orderRefs: unknown }) {
  return isSupplierDebtPlan(before) !== isSupplierDebtPlan(after);
}

export function debtRequestConflict(
  plans: Array<{ id: string; supplierPartner: string; orderRefs: unknown; status: string; plannedDate?: string | Date }>,
  supplier: string,
  evidence: Map<string, { state: string }>,
  plannedDate?: string | Date,
) {
  return plans.some(plan => plan.supplierPartner === supplier && isSupplierDebtPlan(plan) &&
    ['SUBMITTED', 'APPROVED', 'NEEDS_CHANGES'].includes(plan.status) &&
    !isFinishedPaymentState(evidence.get(plan.id)?.state) &&
    planningRequestOverlap([{supplierPartner:supplier,orderRefs:[],plannedDate}],[plan],evidence));
}

export type PaymentBasis = 'ORDER' | 'DEBT' | 'ADVANCE';
type Target = {orderRefs: unknown; paymentPurpose?: string};
export function planBasis(plan: Target): PaymentBasis {
  return plan.paymentPurpose === 'SUPPLIER_ADVANCE' ? 'ADVANCE' : isSupplierDebtPlan(plan) ? 'DEBT' : 'ORDER';
}
export function paymentTargetChanged(before: Target, after: Target) {
  const refs = (plan: Target) => Array.isArray(plan.orderRefs) ? [...plan.orderRefs].sort() : [];
  return planBasis(before) !== planBasis(after) || JSON.stringify(refs(before)) !== JSON.stringify(refs(after));
}
