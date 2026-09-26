import 'server-only';

import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { loadAdminInbox } from '@/lib/admin-inbox-data';
import {
  ADMIN_INBOX_TECHNICAL_DEDUPE_MS,
  adminInboxWebPushPayload,
  eligibleAdminInboxWebPushTypes,
  getAdminInboxPushEventCutoff,
  isAdminInboxWebPushEligible,
  isTechnicalAdminInboxDownEvent,
  subscriptionExistedWhenAdminInboxEventWasCreated,
} from '@/lib/admin-inbox-web-push-policy';
import { TBANK_NOTIFICATION_SOURCE, tbankPushEventId } from '@/lib/tbank-cabinet-notification-policy';

function configureWebPush() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? '';
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() ?? '';
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || 'mailto:admin@offonika.ru';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

async function isCurrentTechnicalIncident(input: {
  id: string;
  type: string;
  sourceType: string;
  sourceId: string;
  occurredAt: Date;
}, now: Date) {
  if (!isTechnicalAdminInboxDownEvent(input.type)) return true;
  const recoveredType = input.type === 'dependency.down'
    ? 'dependency.recovered'
    : 'infrastructure.recovered';
  const latestState = await prisma.adminInboxEvent.findFirst({
    where: {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      type: { in: [input.type, recoveredType] },
      occurredAt: { lte: now },
    },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
  });
  if (latestState?.id !== input.id) return false;

  const duplicateCutoff = new Date(input.occurredAt.getTime() - ADMIN_INBOX_TECHNICAL_DEDUPE_MS);
  const recentSentIncident = await prisma.adminInboxDelivery.findFirst({
    where: {
      channel: 'web_push',
      status: 'sent',
      event: {
        id: { not: input.id },
        type: input.type,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        occurredAt: { gte: duplicateCutoff, lte: input.occurredAt },
      },
    },
    select: { id: true },
  });
  return recentSentIncident === null;
}

export async function dispatchAdminInboxWebPush(now = new Date()) {
  if (!configureWebPush()) throw new Error('WEB_PUSH_NOT_CONFIGURED');
  const eligibleTypes = eligibleAdminInboxWebPushTypes(now);
  if (eligibleTypes.length === 0) return { receipts: 0, sent: 0, failed: 0 };
  const eventCutoff = getAdminInboxPushEventCutoff(now);
  const latestTbank = await prisma.adminInboxEvent.findFirst({
    where: { sourceType: 'dependency', sourceId: TBANK_NOTIFICATION_SOURCE,
      type: { in: ['dependency.down', 'dependency.recovered'] } },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, type: true, occurredAt: true },
  });
  const allowedTbankId = tbankPushEventId(latestTbank, now);
  const receipts = await prisma.adminInboxReceipt.findMany({
    where: {
      event: {
        type: { in: eligibleTypes },
        createdAt: { gte: eventCutoff, lte: now },
        OR: [
          { NOT: { sourceType: 'dependency', sourceId: TBANK_NOTIFICATION_SOURCE } },
          ...(allowedTbankId ? [{ id: allowedTbankId }] : []),
        ],
      },
      user: { role: 'ADMIN', isActive: true },
    },
    include: { event: true, user: { include: { pushSubscriptions: { where: { disabledAt: null } } } } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  let sent = 0;
  let failed = 0;
  const unreadCountByUser = new Map<number, number>();
  for (const receipt of receipts) {
    if (!isAdminInboxWebPushEligible({
      type: receipt.event.type,
      eventCreatedAt: receipt.event.createdAt,
      now,
    })) continue;
    if (!await isCurrentTechnicalIncident(receipt.event, now)) continue;
    let badgeCount = unreadCountByUser.get(receipt.userId);
    if (badgeCount === undefined) {
      badgeCount = (await loadAdminInbox({ userId: receipt.userId, limit: 1 })).unreadCount;
      unreadCountByUser.set(receipt.userId, badgeCount);
    }
    for (const subscription of receipt.user.pushSubscriptions) {
      if (!subscriptionExistedWhenAdminInboxEventWasCreated({
        subscriptionCreatedAt: subscription.createdAt,
        eventCreatedAt: receipt.event.createdAt,
      })) continue;
      const recipientKey = `admin:${receipt.userId}:push:${subscription.id}`;
      const delivery = await prisma.adminInboxDelivery.upsert({
        where: { eventId_channel_recipientKey: { eventId: receipt.eventId, channel: 'web_push', recipientKey } },
        create: { eventId: receipt.eventId, channel: 'web_push', recipientKey },
        update: {},
      });
      if (delivery.status === 'sent' || delivery.status === 'sending' || delivery.attemptCount >= 5) continue;
      const claimed = await prisma.adminInboxDelivery.updateMany({
        where: { id: delivery.id, status: { in: ['pending', 'failed'] }, attemptCount: { lt: 5 } },
        data: { status: 'sending', attemptCount: { increment: 1 }, lastErrorCode: null },
      });
      if (claimed.count !== 1) continue;
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, adminInboxWebPushPayload({
          title: receipt.event.title,
          body: receipt.event.body,
          url: receipt.event.href,
          notificationId: receipt.event.id,
          badgeCount,
        }));
        await prisma.adminInboxDelivery.update({ where: { id: delivery.id }, data: { status: 'sent', sentAt: now, externalMessageId: subscription.id.toString(), leaseToken: null, leaseUntil: null } });
        sent += 1;
      } catch (error) {
        const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) await prisma.workdayPushSubscription.update({ where: { id: subscription.id }, data: { disabledAt: now } });
        await prisma.adminInboxDelivery.update({ where: { id: delivery.id }, data: { status: 'failed', lastErrorCode: statusCode ? `WEB_PUSH_${statusCode}` : 'WEB_PUSH_FAILED' } });
        failed += 1;
      }
    }
  }
  return { receipts: receipts.length, sent, failed };
}
