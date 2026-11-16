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
