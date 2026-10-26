import 'server-only';
import { prisma } from '@/lib/prisma';
import { buildDateRange, getMoscowDateKey } from '@/lib/workday';
import { buildScheduleMonthRange } from '@/lib/workday-schedule';
import { serializeEmployeeVacation } from '@/lib/employee-vacation';
import { scheduleWeekAllowsDate, scheduleWeekStart, shiftScheduleDate } from './schedule-week-reminder';

export function requestedDates(monthKey?: string | null, weekStart?: string | null, today = getMoscowDateKey()) {
  if (weekStart !== undefined && weekStart !== null) {
    if (monthKey || !scheduleWeekAllowsDate(weekStart, today, today)) return null;
    const from = scheduleWeekStart(today), through = shiftScheduleDate(weekStart, 6);
    return { monthKey: null, dates: buildDateRange(from, Math.round((Date.parse(through) - Date.parse(from)) / 86400000) + 1) };
  }
  if (!monthKey) return { monthKey: null, dates: buildDateRange(today, 31) };
  return buildScheduleMonthRange(monthKey);
}

export async function scheduleSnapshot(user: { id: number; department: string }, dates: string[], monthKey: string | null) {
  const [ownSchedule, departmentSchedule, replacementNotifications, ownVacations, departmentVacations] = await Promise.all([
    prisma.workScheduleEntry.findMany({
      where: { userId: user.id, date: { in: dates } },
      orderBy: { date: 'asc' },
    }),
    prisma.workScheduleEntry.findMany({
      where: {
        department: user.department,
        date: { in: dates },
        user: { role: 'EMPLOYEE', isActive: true, department: user.department },
      },
      include: { user: { select: { id: true, name: true, department: true } } },
      orderBy: [{ date: 'asc' }, { user: { name: 'asc' } }],
    }),
    prisma.workdayNotification.findMany({
      where: {
        userId: user.id,
        kind: 'schedule_replacement_request',
        status: { in: ['pending', 'sent'] },
      },
      select: { fingerprint: true },
    }),
    prisma.employeeVacation.findMany({
      where: { userId: user.id, status: 'active', dateFrom: { lte: dates[dates.length - 1] }, dateTo: { gte: dates[0] } },
      orderBy: [{ dateFrom: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.employeeVacation.findMany({
      where: {
        department: user.department,
        status: 'active',
        dateFrom: { lte: dates[dates.length - 1] },
        dateTo: { gte: dates[0] },
        user: { role: 'EMPLOYEE', isActive: true, department: user.department },
      },
      include: { user: { select: { id: true, name: true, department: true } } },
      orderBy: [{ dateFrom: 'asc' }, { user: { name: 'asc' } }],
    }),
  ]);
  const replacementRequestDates = replacementNotifications
    .map((notification) => notification.fingerprint.match(/^schedule-coverage:[^:]+:(\d{4}-\d{2}-\d{2}):/)?.[1])
    .filter((date): date is string => Boolean(date));
  return {
    today: getMoscowDateKey(),
    ownSchedule,
    departmentSchedule,
    ownVacations: ownVacations.map(serializeEmployeeVacation),
    departmentVacations: departmentVacations.map(serializeEmployeeVacation),
    replacementRequestDates,
    range: { monthKey, from: dates[0], to: dates[dates.length - 1] },
  };
}
