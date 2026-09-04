import 'server-only';

import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { TBANK_NOTIFICATION_SOURCE, tbankPushEventId } from '@/lib/tbank-cabinet-notification-policy';

export const ADMIN_INBOX_PUSH_READ_GRACE_MS = 30 * 60 * 1000;

export function getAdminInboxPushReadGraceCutoff(now: Date) {
  return new Date(now.getTime() - ADMIN_INBOX_PUSH_READ_GRACE_MS);
}

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
  const readGraceCutoff = getAdminInboxPushReadGraceCutoff(now);
  const latestTbank = await prisma.adminInboxEvent.findFirst({
    where: { sourceType: 'dependency', sourceId: TBANK_NOTIFICATION_SOURCE,
      type: { in: ['dependency.down', 'dependency.recovered'] } },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, type: true, occurredAt: true },
  });
  const allowedTbankId = tbankPushEventId(latestTbank, now);
  const receipts = await prisma.adminInboxReceipt.findMany({
    where: {
      event: { OR: [
        { NOT: { sourceType: 'dependency', sourceId: TBANK_NOTIFICATION_SOURCE } },
        ...(allowedTbankId ? [{ id: allowedTbankId }] : []),
      ] },
      user: { role: 'ADMIN', isActive: true },
      OR: [
        { readAt: null },
        { createdAt: { gte: readGraceCutoff } },
      ],
    },
    include: { event: true, user: { include: { pushSubscriptions: { where: { disabledAt: null } } } } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  let sent = 0;
  let failed = 0;
  for (const receipt of receipts) {
    for (const subscription of receipt.user.pushSubscriptions) {
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
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({
          title: receipt.event.title,
          body: receipt.event.body,
          url: receipt.event.href,
          notificationId: receipt.event.id,
          tagPrefix: 'admin',
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
