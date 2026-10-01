import 'server-only';
import { prisma } from './prisma';
import { deliveryMappedUser } from './procurement-delivery-reminders';
import { currentDeliveryPush, DELIVERY_READY_KIND } from './procurement-delivery-notifications';
import { currentCollectionPushes, COLLECTION_READY_KIND, COLLECTION_PUSH_COPY } from './procurement-collection-notifications';
import { DELIVERY_PUSH_COPY } from './employee-push-policy';
import { cashMorningAt, cashMorningKey, isCashMorning } from './procurement-morning-policy';

/** Only the mapped buyer's cash invitations. No GET writes or 1C mutations. */
export async function queueCashMorningPushes(now = new Date()) {
  const user = await deliveryMappedUser();
  // Existing delivered invitations are eligible too (including the current release),
  // but do not revive a historical backlog. Pending reminders survive in the DB.
  const originals = await prisma.workdayNotification.findMany({ where: {
    userId: user.id, kind: { in: [COLLECTION_READY_KIND, DELIVERY_READY_KIND] },
    status: 'sent', pushStatus: 'delivered',
    pushDeliveredAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), lte: now },
  }, select: { userId: true, kind: true, fingerprint: true, pushDeliveredAt: true } });
  const eligible = originals.filter(n => !isCashMorning(n) && n.pushDeliveredAt && cashMorningAt(n.pushDeliveredAt));
  if (!eligible.length) return;
  const collections = eligible.some(n => n.kind === COLLECTION_READY_KIND) ? await currentCollectionPushes(now) : null;
  const delivery = eligible.some(n => n.kind === DELIVERY_READY_KIND) ? await currentDeliveryPush(now) : null;
  const data = eligible.flatMap(n => {
    const active = n.kind === COLLECTION_READY_KIND
      ? collections?.state === 'ready' && collections.notices.some(c => c.userId === user.id && c.fingerprint === n.fingerprint)
      : delivery?.state === 'ready' && delivery.userId === user.id && delivery.fingerprint === n.fingerprint;
    if (!active) return [];
    const scheduledAt = cashMorningAt(n.pushDeliveredAt!)!;
    return [{ userId: user.id, kind: n.kind, fingerprint: cashMorningKey(n.fingerprint),
      ...(n.kind === COLLECTION_READY_KIND ? COLLECTION_PUSH_COPY : DELIVERY_PUSH_COPY),
      scheduledAt, nextPushAttemptAt: scheduledAt }];
  });
  if (data.length) await prisma.workdayNotification.createMany({ data, skipDuplicates: true });
}
