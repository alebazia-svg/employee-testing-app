import 'server-only';
import { prisma } from './prisma';
import { deliveryMappedUser, loadDeliveryView } from './procurement-delivery-reminders';
import { deliveryCollectionAmount, deliveryNativeFresh } from './procurement-delivery-native';

export const DELIVERY_READY_KIND = 'procurement_delivery_ready';
// Owner-approved one-time deferral, not a recurring quiet-hours rule.
export const DELIVERY_MORNING_REF = 'ed241171-bb79-11f1-8f11-002590803daf';
export const DELIVERY_MORNING_AT = new Date('2026-09-29T08:30:00+03:00');
export function deliveryPushNotBefore(ref: string, now: Date) {
  return ref === DELIVERY_MORNING_REF && now < DELIVERY_MORNING_AT ? DELIVERY_MORNING_AT : now;
}
export const deliveryPushKey = (ref: string, userId: number) => `procurement-delivery-ready:${ref}:${userId}`;
let cached: { until: number; value: Promise<{ userId: number; view: Awaited<ReturnType<typeof loadDeliveryView>> } | null> } | null = null;
async function context() {
  if (cached && cached.until > Date.now()) return cached.value;
  const value = Promise.all([deliveryMappedUser(), loadDeliveryView()]).then(([user, view]) => ({ userId: user.id, view })).catch(() => null).finally(() => {
    if (cached?.value === value) cached.until = Date.now() + 5000;
  });
  cached = { until: Infinity, value };
  return value;
}
export async function currentDeliveryPush(now = new Date()) {
  const data = await context();
  if (!data?.view.requestStateAvailable) return { state: 'unknown' as const };
  const native = data.view.nativeRequest;
  if (native?.state === 'unavailable' || (native?.state === 'unlinked' && native.reviewReason === 'ambiguous')) return { state: 'unknown' as const };
  if (native?.state !== 'linked' || !native.status) return { state: 'inactive' as const };
  if (!deliveryNativeFresh(native.status, now.getTime())) return { state: 'unknown' as const };
  const amount = deliveryCollectionAmount(native.status);
  if (amount === null) return { state: 'inactive' as const };
  return { state: 'ready' as const, userId: data.userId, ref: native.status.ref,
    title: `Можно получить ${amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`, body: native.status.cashbox!,
    fingerprint: deliveryPushKey(native.status.ref, data.userId), scheduledAt: deliveryPushNotBefore(native.status.ref, now) };
}
/** Existing minute dispatcher owns delivery. No browser GET queues or sends a push. */
export async function queueDeliveryReadyPush(now = new Date()) {
  const current = await currentDeliveryPush(now);
  if (current.state !== 'ready') return;
  await prisma.workdayNotification.createMany({ skipDuplicates: true, data: [{
    userId: current.userId, kind: DELIVERY_READY_KIND, fingerprint: current.fingerprint,
    title: 'Пополнение подотчёта', body: 'Откройте календарь, чтобы проверить сумму и кассу.',
    scheduledAt: current.scheduledAt, nextPushAttemptAt: current.scheduledAt,
  }] });
}
export async function deliveryPushDecision(notification: { kind: string; fingerprint: string; userId: number }, now = new Date()) {
  const current = await currentDeliveryPush(now);
  if (current.state === 'unknown') return { state: 'defer' as const, until: new Date(now.getTime() + 60000) };
  if (current.state !== 'ready' || current.fingerprint !== notification.fingerprint || current.userId !== notification.userId) return { state: 'cancel' as const };
  if (now < current.scheduledAt) return { state: 'defer' as const, until: current.scheduledAt };
  return { state: 'send' as const, title: current.title, body: current.body };
}
