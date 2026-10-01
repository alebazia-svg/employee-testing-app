import 'server-only';
import { prisma } from './prisma';
import { procurementNotificationEvidence } from './procurement-notification-evidence';
import { procurementCollectionCopy } from './procurement-collection';
import { moscowDateKey } from './one-c-date';
import { employeePushNotBefore } from './employee-push-policy';
import { cashNoticeBase, isCashMorning, cashMorningNotBefore } from './procurement-morning-policy';

export const COLLECTION_READY_KIND = 'procurement_collection_ready';
export const COLLECTION_PUSH_COPY = { title: 'Деньги для оплаты', body: 'Проверьте сумму, дату и кассу в платёжном календаре.' };
export const collectionPushKey = (ref: string, planId: string, userId: number) => `procurement-collection:${ref}:${planId}:${userId}`;

export async function currentCollectionPushes(now = new Date()) {
  const evidence = await procurementNotificationEvidence();
  if (!evidence) return { state: 'unknown' as const };
  // Reread after 1C: never use a changed plan or an inactive employee's permission.
  const plans = await prisma.supplierPaymentPlan.findMany({
    where: { status: 'APPROVED' }, include: { manager: true },
  });
  if (plans.some(p => evidence.versions.get(p.id) !== p.updatedAt.toISOString())) return { state: 'unknown' as const };
  const notices = plans.flatMap(p => {
    const collection = evidence.get(p.id)?.collection;
    if (!collection || !p.manager.isActive) return [];
    const copy = procurementCollectionCopy(collection, moscowDateKey(now));
    return [{ ...copy, body: `${copy.body} · ${p.supplierPartner}`, userId: p.managerUserId,
      fingerprint: collectionPushKey(collection.requestRef, p.id, p.managerUserId), scheduledAt: employeePushNotBefore(now) }];
  });
  return { state: 'ready' as const, notices };
}

/** Existing minute dispatcher is the only producer. GET only reads projections. */
export async function queueCollectionReadyPush(now = new Date()) {
  const current = await currentCollectionPushes(now);
  if (current.state !== 'ready' || !current.notices.length) return;
  await prisma.workdayNotification.createMany({ skipDuplicates: true, data: current.notices.map(n => ({
    userId: n.userId, kind: COLLECTION_READY_KIND, fingerprint: n.fingerprint, ...COLLECTION_PUSH_COPY,
    scheduledAt: n.scheduledAt, nextPushAttemptAt: n.scheduledAt,
  })) });
}

export async function collectionPushDecision(notification: { fingerprint: string; userId: number }, now = new Date()) {
  const current = await currentCollectionPushes(now);
  if (current.state === 'unknown') return { state: 'defer' as const, until: new Date(now.getTime() + 60000) };
  const identity = { ...notification, kind: COLLECTION_READY_KIND };
  const notice = current.notices.find(n => n.fingerprint === (cashNoticeBase(identity) ?? notification.fingerprint) && n.userId === notification.userId);
  if (!notice) return { state: 'cancel' as const };
  const morning = isCashMorning(identity) ? cashMorningNotBefore(now) : now;
  if (morning > now) return { state: 'defer' as const, until: morning };
  if (notice.scheduledAt > now) return { state: 'defer' as const, until: notice.scheduledAt };
  return { state: 'send' as const, title: notice.title, body: notice.body };
}
