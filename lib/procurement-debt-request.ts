/** Empty orderRefs persist the supplier-debt basis; no synthetic order goes to 1C. */
export function isSupplierDebtPlan(plan: { orderRefs: unknown }) {
  return Array.isArray(plan.orderRefs) && plan.orderRefs.length === 0;
}

export function debtRequestConflict(
  plans: Array<{ id: string; supplierPartner: string; orderRefs: unknown; status: string }>,
  supplier: string,
  evidence: Map<string, { state: string }>,
) {
  return plans.some(plan => plan.supplierPartner === supplier && isSupplierDebtPlan(plan) &&
    ['SUBMITTED', 'APPROVED', 'NEEDS_CHANGES'].includes(plan.status) &&
    !['ISSUED_BY_ONE_C', 'PAID_BY_ONE_C'].includes(evidence.get(plan.id)?.state || ''));
}
