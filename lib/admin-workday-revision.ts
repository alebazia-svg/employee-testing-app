import { prisma } from '@/lib/prisma';
import { getMoscowDateKey, getMoscowMinutes } from '@/lib/workday';

export type AdminWorkdayRevisionPart = {
  count: number;
  latestAt: Date | string | null;
  latestId?: number | null;
};

function revisionTimestamp(value: Date | string | null) {
  if (!value) return 'none';
  return new Date(value).toISOString();
}

export function formatAdminWorkdayRevision({
  date,
  today,
  nowMinutes,
  parts,
}: {
  date: string;
  today: string;
  nowMinutes: number;
  parts: AdminWorkdayRevisionPart[];
}) {
  const timeRevision = date === today ? `minute:${nowMinutes}` : 'history';
  return [
    date,
    timeRevision,
    ...parts.map((part) => `${part.count}:${part.latestId ?? 'none'}:${revisionTimestamp(part.latestAt)}`),
  ].join('|');
}

export async function getAdminWorkdayRevision(date: string) {
  const [schedules, vacations, workDays, runs, tasks, cashOperations, manualReviews] = await Promise.all([
    prisma.workScheduleEntry.aggregate({
      where: { date },
      _count: { _all: true },
      _max: { id: true, updatedAt: true },
    }),
    prisma.employeeVacation.aggregate({
      where: { status: 'active', dateFrom: { lte: date }, dateTo: { gte: date } },
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    prisma.workDayEntry.aggregate({
      where: { date },
      _count: { _all: true },
      _max: { id: true, updatedAt: true },
    }),
    prisma.shiftControlRun.aggregate({
      where: { date },
      _count: { _all: true },
      _max: { id: true, updatedAt: true },
    }),
    prisma.shiftControlTask.aggregate({
      where: { run: { date } },
      _count: { _all: true },
      _max: { id: true, updatedAt: true },
    }),
    prisma.cashOperation.aggregate({
      where: { date },
      _count: { _all: true },
      _max: { id: true, updatedAt: true },
    }),
    prisma.shiftControlManualReview.aggregate({
      where: { task: { run: { date } } },
      _count: { _all: true },
      _max: { id: true, reviewedAt: true },
    }),
  ]);

  return formatAdminWorkdayRevision({
    date,
    today: getMoscowDateKey(),
    nowMinutes: getMoscowMinutes(),
    parts: [
      { count: schedules._count._all, latestId: schedules._max.id, latestAt: schedules._max.updatedAt },
      { count: vacations._count._all, latestAt: vacations._max.updatedAt },
      { count: workDays._count._all, latestId: workDays._max.id, latestAt: workDays._max.updatedAt },
      { count: runs._count._all, latestId: runs._max.id, latestAt: runs._max.updatedAt },
      { count: tasks._count._all, latestId: tasks._max.id, latestAt: tasks._max.updatedAt },
      { count: cashOperations._count._all, latestId: cashOperations._max.id, latestAt: cashOperations._max.updatedAt },
      { count: manualReviews._count._all, latestId: manualReviews._max.id, latestAt: manualReviews._max.reviewedAt },
    ],
  });
}
