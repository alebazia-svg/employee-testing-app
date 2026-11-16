import { isFinishedPaymentState } from './procurement-small-remainder';
const norm = (v: string) => v.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/\s+/g, ' ');
type Request = { supplierPartner: string; orderRefs: string[]; plannedDate?: string | Date };
type Existing = { id: string; status: string; supplierPartner: string; orderRefs: unknown; updatedAt?: Date; plannedDate?: string | Date };
const day = (value: unknown) => {
  const date = value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString().slice(0,10) : typeof value === 'string' ? value.slice(0,10) : '';
  const at = Date.parse(date+'T00:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(at) && new Date(at).toISOString().slice(0,10) === date ? date : '';
};
/** A supplier may have separate payments on different days. An explicit order
 * stays reserved once; a same-day supplier-wide retry stays blocked. Missing
 * dates never weaken the older callers' overlap protection. */
export function planningRequestOverlap(requests: Request[], existing: Existing[], evidence: Map<string, { state: string }> & { versions?: Map<string, string> }) {
  return requests.some(request => existing.some(plan => {
    if (!['SUBMITTED', 'APPROVED', 'NEEDS_CHANGES'].includes(plan.status)) return false;
    const versionMatches = !evidence.versions || evidence.versions.get(plan.id) === plan.updatedAt?.toISOString();
    if (versionMatches && isFinishedPaymentState(evidence.get(plan.id)?.state)) return false;
    const refs = Array.isArray(plan.orderRefs) ? plan.orderRefs.map(String) : [];
    return request.orderRefs.some(ref => refs.includes(ref))
      || ((!refs.length || !request.orderRefs.length) && norm(plan.supplierPartner) === norm(request.supplierPartner)
        && (!day(request.plannedDate) || !day(plan.plannedDate) || day(request.plannedDate) === day(plan.plannedDate)));
  }));
}
