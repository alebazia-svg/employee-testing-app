import type { PrismaClient } from '@prisma/client';

/** Count persisted requests that can still affect an active shift. */
export function readWorkdayDecisionCount(db: Pick<PrismaClient, 'workdayCloseExceptionRequest'>, today: string) {
  return db.workdayCloseExceptionRequest.count({
    where: {
      status: 'pending',
      consumedAt: null,
      employee: { isActive: true },
      workDayEntry: { date: { lte: today }, endedAt: null, status: { in: ['active', 'missing_checkout'] } },
    },
  });
}
