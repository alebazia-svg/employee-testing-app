import { prisma } from '@/lib/prisma';
import { dispatchDueWorkdayNotifications } from '@/lib/workday-notifications';

async function main() {
  if (process.argv.includes('--inspect')) {
    const now = new Date();
    const [pendingDue, earliestPending, activePushSubscriptions] = await Promise.all([
      prisma.workdayNotification.count({ where: { status: 'pending', scheduledAt: { lte: now } } }),
      prisma.workdayNotification.findFirst({
        where: { status: 'pending' },
        orderBy: { scheduledAt: 'asc' },
        select: { scheduledAt: true },
      }),
      prisma.workdayPushSubscription.count({ where: { disabledAt: null } }),
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
    })}\n`);
    return;
  }

  const result = await dispatchDueWorkdayNotifications();
  process.stdout.write(`${JSON.stringify({ ok: true, applied: true, ...result })}\n`);
}

main().finally(() => prisma.$disconnect());
