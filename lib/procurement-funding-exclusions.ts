import { createHash } from 'node:crypto';
import { deliveryFundingFromEvidence } from './procurement-delivery-funding';

type Row = Record<string, unknown>;
type Evidence = { requests: Row[]; payables: Row[]; payable_movements: Row[]; distribution: Row[] };
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).sort().join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
/** Exact reviewed document version AND native residual slices, not an age filter.
 * Any document edit or payment movement invalidates the owner exclusion.
 */
export function fundingExclusionFingerprint(data: Evidence, request: Row) {
  const id = request.request_ref;
  return createHash('sha256').update(canonical({request,
    payables: data.payables.filter(r => r.document_ref === id),
    movements: data.payable_movements.filter(r => r.document_ref === id),
    distribution: data.distribution.filter(r => r.request_ref === id),
  })).digest('hex');
}

/** Validate the entire source BEFORE applying approved exclusions. Never mutate it. */
export function forecastFundingWithExclusions(value: unknown, approved: readonly string[], now = Date.now()) {
  const original = deliveryFundingFromEvidence(value, now);
  const data = value as Evidence;
  const allowed = new Set(approved);
  const excluded = new Set(data.requests.filter(r => allowed.has(fundingExclusionFingerprint(data,r))).map(r => r.request_ref));
  const filtered = {...data, requests:data.requests.filter(r=>!excluded.has(r.request_ref)),
    payables:data.payables.filter(r=>!excluded.has(r.document_ref)),
    payable_movements:data.payable_movements.filter(r=>!excluded.has(r.document_ref)),
    distribution:data.distribution.filter(r=>!excluded.has(r.request_ref)),
  };
  const result = deliveryFundingFromEvidence(filtered, now);
  return {...result, excludedCount:excluded.size,
    excludedUnassignedAmount: original.unassignedAmount - result.unassignedAmount};
}
