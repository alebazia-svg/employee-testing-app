import type { Prisma } from '@prisma/client';

type NotificationDb = Pick<Prisma.TransactionClient, 'workdayNotification'>;

export async function suppressPushBacklogOnNewSubscription(
  db: NotificationDb,
  userId: number,
  subscribedAt = new Date(),
) {
  return db.workdayNotification.updateMany({
    where: {
      userId,
      scheduledAt: { lte: subscribedAt },
      OR: [
        { status: 'pending' },
        {
          status: 'sent',
          readAt: null,
          pushStatus: { in: ['no_subscription', 'not_configured', 'retry_pending'] },
        },
      ],
    },
    data: {
      status: 'sent',
      sentAt: subscribedAt,
      pushStatus: 'suppressed_duplicate',
      nextPushAttemptAt: null,
      lastError: '',
    },
  });
}
