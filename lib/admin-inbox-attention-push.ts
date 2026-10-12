import 'server-only';
import { randomUUID } from 'node:crypto';
import webpush from 'web-push';
import { prisma } from './prisma';
import { loadAdminInbox } from './admin-inbox-data';
import { ATTENTION_PUSH_TYPES, attentionDigestText, digestDue, readDigestState } from './admin-inbox-attention-policy';
import { adminInboxWebPushPayload } from './admin-inbox-web-push-policy';

/** One durable delivery state per ADMIN/device; repeats create no inbox copies.
 * The lease prevents concurrent timer runs and expires after an interrupted send.
 * A crash after provider acceptance may repeat once after lease expiry (at-least-once).
 */
export async function dispatchAdminAttentionPush(now = new Date()) {
  const result = { receipts: 0, sent: 0, failed: 0 };
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Moscow' }).format(now));
  if (hour < 9 || hour >= 22) return result;
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, include: { pushSubscriptions: { where: { disabledAt: null } } } });
  for (const admin of admins) {
    if (!admin.pushSubscriptions.length) continue;
    const inbox = await loadAdminInbox({ userId: admin.id, limit: 1, view: 'attention', now });
    const items = inbox.attention.filter(i => i.meta.category !== 'system' && !i.event.technicalAttention && (ATTENTION_PUSH_TYPES as readonly string[]).includes(i.event.type));
    result.receipts += items.length;
    if (!items.length) continue;
    const event = await prisma.adminInboxEvent.upsert({ where: { eventKey: `admin:attention-digest:v1:${admin.id}` }, update: {}, create: {
      eventKey: `admin:attention-digest:v1:${admin.id}`, type: 'admin.attention_digest', title: 'Сводка требующих внимания дел', body: '', href: '/admin/inbox?view=attention', sourceType: 'admin_attention_digest', sourceId: String(admin.id), occurredAt: now,
    } });
    for (const sub of admin.pushSubscriptions) {
      const recipientKey = `admin:${admin.id}:push:${sub.id}`;
      const delivery = await prisma.adminInboxDelivery.upsert({ where: { eventId_channel_recipientKey: { eventId: event.id, channel: 'web_push', recipientKey } }, update: {}, create: { eventId: event.id, channel: 'web_push', recipientKey } });
      const next = digestDue({ items, previous: readDigestState(delivery.externalMessageId), sentAt: delivery.sentAt, now });
      if (!next || (delivery.leaseUntil && delivery.leaseUntil > now)) continue;
      const token = randomUUID();
      const claimed = await prisma.adminInboxDelivery.updateMany({ where: { id: delivery.id, updatedAt: delivery.updatedAt, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] }, data: {
        status: 'sending', leaseToken: token, leaseUntil: new Date(now.getTime() + 5 * 60_000), attemptCount: { increment: 1 },
      } });
      if (claimed.count !== 1) continue;
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, adminInboxWebPushPayload({
          ...attentionDigestText(items, readDigestState(delivery.externalMessageId)), notificationId: `attention-${admin.id}`, badgeCount: inbox.attentionCount, renotify: true,
        }), { TTL: 300, urgency: 'high', timeout: 15_000 });
        await prisma.adminInboxDelivery.updateMany({ where: { id: delivery.id, leaseToken: token }, data: { status: 'sent', sentAt: now, externalMessageId: JSON.stringify(next), attemptCount: 0, leaseToken: null, leaseUntil: null, lastErrorCode: null } });
        result.sent++;
      } catch (error) {
        const code = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0;
        if (code === 404 || code === 410) await prisma.workdayPushSubscription.update({ where: { id: sub.id }, data: { disabledAt: now } });
        const delay = Math.min(60, 5 * 2 ** Math.min(delivery.attemptCount, 4));
        await prisma.adminInboxDelivery.updateMany({ where: { id: delivery.id, leaseToken: token }, data: { status: 'failed', leaseToken: null, leaseUntil: new Date(now.getTime() + delay * 60_000), lastErrorCode: code ? `WEB_PUSH_${code}` : 'WEB_PUSH_FAILED' } });
        result.failed++;
      }
    }
  }
  return result;
}
