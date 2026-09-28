import { prisma } from '../lib/prisma';
import { deliveryMappedUser } from '../lib/procurement-delivery-reminders';
import { currentDeliveryPush, queueDeliveryReadyPush, DELIVERY_READY_KIND } from '../lib/procurement-delivery-notifications';

// Read-only by default. --queue creates the one notification but NEVER dispatches.
// Normal sending is owned by the existing minute dispatcher.
async function main() {
  const queue = process.argv.includes('--queue');
  if (process.argv.slice(2).some(a => a !== '--queue')) throw Error('UNKNOWN_ARGUMENT');
  const current = await currentDeliveryPush();
  if (queue) {
    if (current.state !== 'ready') throw Error('DELIVERY_PERMISSION_NOT_READY');
    await queueDeliveryReadyPush();
  }
  const user = await deliveryMappedUser();
  const [subscriptionCount, row, activeAlerts, retiredAlerts] = await Promise.all([
    prisma.workdayPushSubscription.count({ where: { userId: user.id, disabledAt: null } }),
    current.state === 'ready' ? prisma.workdayNotification.findUnique({ where: { fingerprint: current.fingerprint },
      select: { id: true, status: true, pushStatus: true, scheduledAt: true, nextPushAttemptAt: true, sentAt: true, pushDeliveredAt: true } }) : null,
    prisma.workdayNotification.count({ where: { userId: user.id, status: 'sent', readAt: null } }),
    prisma.workdayNotification.count({ where: { userId: user.id, status: 'cancelled', kind: { startsWith: 'procurement_' } } }),
  ]);
  console.log(JSON.stringify({ ok: true, queued: queue, dispatched: false, state: current.state,
    notBefore: current.state === 'ready' ? current.scheduledAt.toISOString() : null,
    kind: DELIVERY_READY_KIND, subscriptionCount, pushConfigured: Boolean(process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() && process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim()),
    notification: row, activeUnread: activeAlerts, retiredProcurementAlerts: retiredAlerts }));
}
main().catch(() => { console.error('DELIVERY_NOTIFICATION_CHECK_FAILED'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
