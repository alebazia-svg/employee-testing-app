import 'server-only';

import webpush from 'web-push';
import { dispatchAdminAttentionPush } from './admin-inbox-attention-push';
import { ATTENTION_PUSH_TYPES } from './admin-inbox-attention-policy';
import { prisma } from '@/lib/prisma';
import { loadAdminInbox } from '@/lib/admin-inbox-data';
import {
  adminInboxWebPushPayload,
  eligibleAdminInboxWebPushTypes,
  getAdminInboxPushEventCutoff,
  isAdminInboxWebPushEligible,
  isTechnicalAdminInboxDownEvent,
  subscriptionExistedWhenAdminInboxEventWasCreated,
  RECEIPT_PUSH_TYPE,
  RECEIPT_PUSH_MAX_AGE_MS,
} from '@/lib/admin-inbox-web-push-policy';

function configureWebPush() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? '';
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() ?? '';
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || 'mailto:admin@offonika.ru';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function dispatchAdminInboxWebPush(now = new Date()) {
  if (!configureWebPush()) throw new Error('WEB_PUSH_NOT_CONFIGURED');
  const digest = await dispatchAdminAttentionPush(now);
  // Preserve the existing 22:00–23:00 closing-blocker channel. During the
  // daytime those decisions are covered by the common digest instead.
  const digestHours = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Moscow' }).format(now) !== '22';
  const eligibleTypes = eligibleAdminInboxWebPushTypes(now).filter(type => (!digestHours || !(ATTENTION_PUSH_TYPES as readonly string[]).includes(type)) && !isTechnicalAdminInboxDownEvent(type));
  if (eligibleTypes.length === 0) return digest;
  const eventCutoff = getAdminInboxPushEventCutoff(now);
  let sent = digest.sent;
  let failed = digest.failed;
  let receiptCount = digest.receipts;
  let cursor: string | undefined;
  const unreadCountByUser = new Map<number, number>();
  // Advance past already delivered/read entries: the first page must not
  // permanently block new receipts. The fixed event cutoff bounds this scan.
  for (;;) {
  const receipts = await prisma.adminInboxReceipt.findMany({
    where: {
      event: {
        type: { in: eligibleTypes },
        AND: [{OR:[
          {type:{not:RECEIPT_PUSH_TYPE},createdAt:{gte:eventCutoff,lte:now}},
          {type:RECEIPT_PUSH_TYPE,createdAt:{gte:new Date(now.getTime()-RECEIPT_PUSH_MAX_AGE_MS),lte:now}},
        ]}],

      },
      user: { role: 'ADMIN', isActive: true },
    },
    include: { event: true, user: { include: { pushSubscriptions: { where: { disabledAt: null } } } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: 100,
  });
  receiptCount += receipts.length;
  for (const receipt of receipts) {
    if(receipt.event.type===RECEIPT_PUSH_TYPE && receipt.readAt) continue;
    if (!isAdminInboxWebPushEligible({
      type: receipt.event.type,
      eventCreatedAt: receipt.event.createdAt,
      now,
    })) continue;
    let badgeCount = unreadCountByUser.get(receipt.userId);
    if (badgeCount === undefined) {
      badgeCount = (await loadAdminInbox({ userId: receipt.userId, limit: 1 })).attentionCount;
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
  if (receipts.length < 100) break;
  cursor = receipts[receipts.length - 1].id;
  }
  return { receipts: receiptCount, sent, failed };
}
