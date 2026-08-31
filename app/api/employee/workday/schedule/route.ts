import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildDateRange, getMoscowDateKey, scheduleStatuses } from '@/lib/workday';
import { buildScheduleMonthRange, isValidScheduleDateKey, scheduleMonthKeyFromDate } from '@/lib/workday-schedule';
import { scheduleCoverage, scheduleCoverageCopy, scheduleWorkingCountAfterChange, shouldRequestScheduleReplacement } from '@/lib/work-schedule-coverage';
import { persistEmployeeScheduleChange } from '@/lib/work-schedule-persistence';
import { serializeEmployeeVacation } from '@/lib/employee-vacation';

const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

function requestedDates(monthKey?: string | null) {
  if (!monthKey) return { monthKey: null, dates: buildDateRange(getMoscowDateKey(), 31) };
  return buildScheduleMonthRange(monthKey);
}

async function scheduleSnapshot(user: { id: number; department: string }, dates: string[], monthKey: string | null) {
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
        readAt: null,
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
    ownSchedule,
    departmentSchedule,
    ownVacations: ownVacations.map(serializeEmployeeVacation),
    departmentVacations: departmentVacations.map(serializeEmployeeVacation),
    replacementRequestDates,
    range: { monthKey, from: dates[0], to: dates[dates.length - 1] },
  };
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  const monthKey = new URL(req.url).searchParams.get('month');
  const range = requestedDates(monthKey);
  if (!range) return Response.json({ error: 'Некорректный месяц' }, { status: 400, headers: noStoreHeaders });
  return Response.json(await scheduleSnapshot(user, range.dates, range.monthKey), { headers: noStoreHeaders });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { date, status, confirmCoverageImpact, action } = await req.json();
  if (typeof date !== 'string' || !isValidScheduleDateKey(date)) {
    return Response.json({ error: 'Некорректная дата' }, { status: 400 });
  }
  if (action === 'decline_replacement') {
    const fingerprint = `schedule-coverage:${user.department}:${date}:${user.id}`;
    const now = new Date();
    await prisma.$transaction([
      prisma.workdayNotification.updateMany({
        where: { userId: user.id, fingerprint, status: 'pending' },
        data: { status: 'cancelled', pushStatus: 'cancelled', readAt: now, nextPushAttemptAt: null },
      }),
      prisma.workdayNotification.updateMany({
        where: { userId: user.id, fingerprint, status: 'sent' },
        data: { readAt: now },
      }),
    ]);
    const monthKey = scheduleMonthKeyFromDate(date);
    const range = monthKey ? requestedDates(monthKey) : null;
    if (!range) return Response.json({ error: 'Некорректная дата' }, { status: 400, headers: noStoreHeaders });
    return Response.json({ ...(await scheduleSnapshot(user, range.dates, range.monthKey)), replacementDeclined: true }, { headers: noStoreHeaders });
  }
  if (!scheduleStatuses.includes(status)) {
    return Response.json({ error: 'Некорректный статус графика' }, { status: 400 });
  }
  if (date < getMoscowDateKey()) {
    return Response.json({ error: 'Прошедший день нельзя изменить самостоятельно. Обратитесь к администратору.' }, { status: 409 });
  }

  const [currentEntry, departmentEntries, vacations] = await Promise.all([
    prisma.workScheduleEntry.findUnique({ where: { userId_date: { userId: user.id, date } } }),
    prisma.workScheduleEntry.findMany({
      where: {
        department: user.department,
        date,
        user: { role: 'EMPLOYEE', isActive: true, department: user.department },
      },
    }),
    prisma.employeeVacation.findMany({
      where: { department: user.department, status: 'active', dateFrom: { lte: date }, dateTo: { gte: date } },
      select: { userId: true },
    }),
  ]);
  const vacationUserIds = new Set(vacations.map((vacation) => vacation.userId));
  if (vacationUserIds.has(user.id)) {
    return Response.json({ error: 'Этот день входит в отпуск. Измените период отпуска.' }, { status: 409, headers: noStoreHeaders });
  }
  const effectiveDepartmentEntries = departmentEntries.filter((entry) => !vacationUserIds.has(entry.userId));
  const workingBefore = effectiveDepartmentEntries.filter((entry) => entry.status === 'working').length;
  const workingAfter = scheduleWorkingCountAfterChange({
    workingBefore,
    previousStatus: currentEntry?.status,
    nextStatus: status,
  });
  const coverage = scheduleCoverage(user.department, workingAfter);

  if (currentEntry?.status === status) {
    const monthKey = scheduleMonthKeyFromDate(date);
    const range = monthKey ? requestedDates(monthKey) : null;
    if (!range) return Response.json({ error: 'Некорректная дата' }, { status: 400, headers: noStoreHeaders });
    return Response.json({ ...(await scheduleSnapshot(user, range.dates, range.monthKey)), coverage }, { headers: noStoreHeaders });
  }

  if (shouldRequestScheduleReplacement({
    previousStatus: currentEntry?.status,
    nextStatus: status,
    coverage,
  }) && confirmCoverageImpact !== true) {
    return Response.json({
      error: 'Подтвердите изменение графика',
      code: 'SCHEDULE_COVERAGE_CONFIRMATION_REQUIRED',
      coverage,
      copy: scheduleCoverageCopy(coverage),
    }, { status: 409, headers: noStoreHeaders });
  }

  await prisma.$transaction((tx) => persistEmployeeScheduleChange(tx, {
    user,
    date,
    status,
    previousStatus: currentEntry?.status,
    departmentEntries: effectiveDepartmentEntries,
    source: 'employee',
  }));

  const monthKey = scheduleMonthKeyFromDate(date);
  const range = monthKey ? requestedDates(monthKey) : null;
  if (!range) return Response.json({ error: 'Некорректная дата' }, { status: 400, headers: noStoreHeaders });
  return Response.json({ ...(await scheduleSnapshot(user, range.dates, range.monthKey)), coverage }, { headers: noStoreHeaders });
}

export async function DELETE(_req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json({ error: 'Выберите явный статус: «Работаю» или «Выходной».' }, { status: 405, headers: noStoreHeaders });
}
