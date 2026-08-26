import { prisma } from '@/lib/prisma';
import { dispatchDueWorkdayNotifications } from '@/lib/workday-notifications';

async function main() {
  if (process.argv.includes('--inspect')) {
    const now = new Date();
    const [pendingDue, earliestPending, activePushSubscriptions, retryDue, pushStates] = await Promise.all([
      prisma.workdayNotification.count({ where: { status: 'pending', scheduledAt: { lte: now } } }),
      prisma.workdayNotification.findFirst({
        where: { status: 'pending' },
        orderBy: { scheduledAt: 'asc' },
        select: { scheduledAt: true },
      }),
      prisma.workdayPushSubscription.count({ where: { disabledAt: null } }),
      prisma.workdayNotification.count({
        where: {
          status: 'sent',
          readAt: null,
          pushStatus: { in: ['retry_pending', 'no_subscription', 'not_configured'] },
          nextPushAttemptAt: { lte: now },
        },
      }),
      prisma.workdayNotification.groupBy({
        by: ['pushStatus'],
        where: { status: 'sent', readAt: null },
        _count: { _all: true },
      }),
    ]);
    const pushConfigured = Boolean(
      process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim()
      && process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim(),
    );
    process.stdout.write(`${JSON.stringify({
      ok: true,
      applied: false,
      pendingDue,
      earliestPendingAt: earliestPending?.scheduledAt ?? null,
      activePushSubscriptions,
      pushConfigured,
      retryDue,
      pushStates: Object.fromEntries(pushStates.map((row) => [row.pushStatus, row._count._all])),
    })}\n`);
    return;
  }

  const result = await dispatchDueWorkdayNotifications();
  process.stdout.write(`${JSON.stringify({ ok: true, applied: true, ...result })}\n`);
}

main().finally(() => prisma.$disconnect());
