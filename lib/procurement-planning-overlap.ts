const norm = (v: string) => v.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/\s+/g, ' ');
type Request = { supplierPartner: string; orderRefs: string[] };
type Existing = { id: string; status: string; supplierPartner: string; orderRefs: unknown; updatedAt?: Date };
/** Never silently allocate a supplier-wide payment to a second order request. */
export function planningRequestOverlap(requests: Request[], existing: Existing[], evidence: Map<string, { state: string }> & { versions?: Map<string, string> }) {
  return requests.some(request => existing.some(plan => {
    if (!['SUBMITTED', 'APPROVED', 'NEEDS_CHANGES'].includes(plan.status)) return false;
    const versionMatches = !evidence.versions || evidence.versions.get(plan.id) === plan.updatedAt?.toISOString();
    if (versionMatches && ['PAID_BY_ONE_C', 'ISSUED_BY_ONE_C'].includes(evidence.get(plan.id)?.state || '')) return false;
    const refs = Array.isArray(plan.orderRefs) ? plan.orderRefs.map(String) : [];
    return request.orderRefs.some(ref => refs.includes(ref))
      || ((!refs.length || !request.orderRefs.length) && norm(plan.supplierPartner) === norm(request.supplierPartner));
  }));
}
