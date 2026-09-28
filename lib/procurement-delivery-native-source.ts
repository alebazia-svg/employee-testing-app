import 'server-only';
import { createHash } from 'node:crypto';
import { prisma } from './prisma';
import { fetchExpenseRequestSnapshot } from './expense-request-source';
import { moscowDateKey, parseOneCDateTime } from './one-c-date';
import { DELIVERY_LINK_SOURCE, deliveryLinkKey, deliveryNativeIdentity, deliveryNativeStatus, readDeliveryLink, type DeliveryNativeCandidate, type DeliveryNativeView } from './procurement-delivery-native';
import type { DeliveryRequestDetails } from './procurement-delivery-request';

const DAY = 86_400_000;
// Short, bounded in-process cache. Failed reads are never converted into empty results.
const cache = new Map<string, { until: number; promise: ReturnType<typeof fetchExpenseRequestSnapshot> }>();
async function readPeriod(from: Date, to: Date, fresh = false) {
  const key = `${moscowDateKey(from)}:${moscowDateKey(to)}`;
  const old = cache.get(key);
  if (!fresh && old && old.until > Date.now()) return old.promise;
  const promise = fetchExpenseRequestSnapshot({ from, to, strictRequests: true }).then(data => {
    if (!data.complete) throw Error('DELIVERY_NATIVE_INCOMPLETE');
    return data;
  });
  if (cache.size >= 12) cache.clear();
  cache.set(key, { until: Date.now() + 30_000, promise });
  try {
    return await promise;
  } catch (e) { cache.delete(key); throw e; }
}
function day(value: string) {
  const parsed = parseOneCDateTime(value);
  if (!parsed) throw Error('DELIVERY_NATIVE_DATE');
  return new Date(`${moscowDateKey(parsed)}T00:00:00+03:00`);
}
export async function loadDeliveryNative(reminderId: string, details: DeliveryRequestDetails): Promise<DeliveryNativeView> {
  try {
    const stored = await prisma.adminInboxEvent.findUnique({ where: { eventKey: deliveryLinkKey(reminderId) } });
    // Explicit operator unlink suppresses automatic selection for this cycle.
    if (stored?.type === 'procurement.delivery_native_unlinked') return { state: 'unlinked', reviewReason: 'manual' };
    if (!stored) return await automaticDeliveryNative(reminderId, details);
    const link = readDeliveryLink(stored.body);
    const from = day(link.date), data = await readPeriod(from, new Date(from.getTime() + DAY));
    const row = data.rows.find(r => r.ref === link.ref);
    if (!row || link.amount !== details.amount) return { state: 'unavailable' };
    return { state: 'linked', status: deliveryNativeStatus(row, data.checkedAt, link.amount) };
  } catch { return { state: 'unavailable' }; }
}
/** Read-only resolution, recomputed from complete evidence; GET never writes a link.
 * A later competing document hides the instruction instead of silently picking one.
 * New portal cycles exclude earlier native documents by the exact request timestamp.
 */
export async function automaticDeliveryNative(reminderId: string, details: DeliveryRequestDetails): Promise<DeliveryNativeView> {
  const from = day(details.requestedAt), to = new Date(day(new Date().toISOString()).getTime() + DAY);
  if (to <= from || to.getTime() - from.getTime() > 31 * DAY) return { state: 'unlinked', reviewReason: 'manual' };
  const data = await readPeriod(from, to);
  if (data.rows.some(r => !('accountable_identity_contract' in r) || r.accountable_identity_contract !== 'expense-request-accountable-v1')) return { state: 'unavailable' };
  // Do not filter out rejected/review/paid rows before uniqueness: they can be
  // a competing request. Never interpret absence caused by bad data as uniqueness.
  const matching = data.rows.filter(r => deliveryNativeIdentity(r) && r.amount === details.amount);
  if (matching.some(r => !parseOneCDateTime(r.date))) return { state: 'unavailable' };
  const rows = matching.filter(r => parseOneCDateTime(r.date)!.getTime() >= Date.parse(details.requestedAt)
    && parseOneCDateTime(r.date)!.getTime() <= Date.parse(data.checkedAt));
  if (!rows.length) return { state: 'unlinked' };
  if (rows.length !== 1) return { state: 'unlinked', reviewReason: 'ambiguous' };
  const status = deliveryNativeStatus(rows[0], data.checkedAt, details.amount);
  if (['review', 'rejected'].includes(status.state)) return { state: 'unlinked', reviewReason: 'manual' };
  const used = await prisma.adminInboxEvent.findMany({ where: { sourceType: DELIVERY_LINK_SOURCE, sourceId: status.ref, type: 'procurement.delivery_native_linked' }, select: { eventKey: true } });
  if (used.some(e => e.eventKey.startsWith('delivery:native:') && e.eventKey !== deliveryLinkKey(reminderId))) return { state: 'unlinked', reviewReason: 'manual' };
  return { state: 'linked', status, automatic: true };
}
export async function deliveryNativeCandidates(details: DeliveryRequestDetails, selectedDay?: string, fresh = false): Promise<DeliveryNativeCandidate[]> {
  if (selectedDay && !/^\d{4}-\d{2}-\d{2}$/.test(selectedDay)) throw Error('DELIVERY_NATIVE_DATE');
  // Include the preceding day for requests entered around midnight or prepared
  // in 1C before the portal request. This proposes candidates, never auto-links.
  const start = selectedDay ? day(selectedDay) : new Date(day(details.requestedAt).getTime() - DAY);
  const to = selectedDay ? new Date(start.getTime() + DAY) : new Date(day(new Date().toISOString()).getTime() + DAY);
  // Never silently truncate history. ADMIN can select the document date explicitly.
  if (to <= start || to.getTime() - start.getTime() > 31 * DAY) throw Error('DELIVERY_NATIVE_PERIOD');
  const data = await readPeriod(start, to, fresh);
  return data.rows.filter(r => deliveryNativeIdentity(r) && r.amount === details.amount).map(row => {
    const status = deliveryNativeStatus(row, data.checkedAt, details.amount);
    const quote = createHash('sha256').update(JSON.stringify({ row, requestedAt: details.requestedAt, amount: details.amount })).digest('hex');
    return { status, quote };
  }).filter(c => !['review', 'rejected'].includes(c.status.state)).sort((a, b) => b.status.date.localeCompare(a.status.date));
}
