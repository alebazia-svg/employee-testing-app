import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildDateRange, formatDateLabel, getMoscowDateKey, scheduleStatuses } from '@/lib/workday';
import { buildScheduleMonthRange, isValidScheduleDateKey, scheduleMonthKeyFromDate } from '@/lib/workday-schedule';
import { scheduleCoverage, scheduleCoverageCopy, schedulePersonName, scheduleWorkingCountAfterChange } from '@/lib/work-schedule-coverage';

const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

function requestedDates(monthKey?: string | null) {
  if (!monthKey) return { monthKey: null, dates: buildDateRange(getMoscowDateKey(), 31) };
  return buildScheduleMonthRange(monthKey);
}

async function scheduleSnapshot(user: { id: number; department: string }, dates: string[], monthKey: string | null) {
  const [ownSchedule, departmentSchedule, replacementNotifications] = await Promise.all([
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
  ]);
  const replacementRequestDates = replacementNotifications
    .map((notification) => notification.fingerprint.match(/^schedule-coverage:[^:]+:(\d{4}-\d{2}-\d{2}):/)?.[1])
    .filter((date): date is string => Boolean(date));
  return {
    ownSchedule,
    departmentSchedule,
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

  const [currentEntry, departmentEntries] = await Promise.all([
    prisma.workScheduleEntry.findUnique({ where: { userId_date: { userId: user.id, date } } }),
    prisma.workScheduleEntry.findMany({
      where: {
        department: user.department,
        date,
        user: { role: 'EMPLOYEE', isActive: true, department: user.department },
      },
    }),
  ]);
  const workingBefore = departmentEntries.filter((entry) => entry.status === 'working').length;
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

  if (status === 'off' && coverage.needsReplacement && confirmCoverageImpact !== true) {
    return Response.json({
      error: 'Подтвердите изменение графика',
      code: 'SCHEDULE_COVERAGE_CONFIRMATION_REQUIRED',
      coverage,
      copy: scheduleCoverageCopy(coverage),
    }, { status: 409, headers: noStoreHeaders });
  }

  await prisma.$transaction(async (tx) => {
    await tx.workScheduleEntry.upsert({
      where: { userId_date: { userId: user.id, date } },
      create: { userId: user.id, date, status, department: user.department },
      update: { status, department: user.department },
    });
    await tx.workScheduleChange.create({
      data: {
        userId: user.id,
        date,
        department: user.department,
        previousStatus: currentEntry?.status ?? null,
        nextStatus: status,
        workingBefore,
        workingAfter,
        coverageState: coverage.state,
      },
    });

    const fingerprintPrefix = `schedule-coverage:${user.department}:${date}:`;
    await tx.workdayNotification.updateMany({
      where: { fingerprint: `${fingerprintPrefix}${user.id}`, status: { in: ['pending', 'sent'] } },
      data: { status: 'cancelled', pushStatus: 'cancelled', readAt: new Date(), nextPushAttemptAt: null },
    });
    if (!coverage.needsReplacement) {
      await tx.workdayNotification.updateMany({
        where: { fingerprint: { startsWith: fingerprintPrefix }, status: { in: ['pending', 'sent'] } },
        data: { status: 'cancelled', pushStatus: 'cancelled', nextPushAttemptAt: null },
      });
      const event = await tx.adminInboxEvent.findUnique({ where: { eventKey: `schedule-coverage:${user.department}:${date}` }, select: { id: true } });
      if (event) await tx.adminInboxReceipt.updateMany({ where: { eventId: event.id, readAt: null }, data: { readAt: new Date() } });
      return;
    }

    const workingUserIds = new Set(
      departmentEntries
        .filter((entry) => entry.status === 'working' && entry.userId !== user.id)
        .map((entry) => entry.userId),
    );
    if (status === 'working') workingUserIds.add(user.id);
    const candidates = await tx.user.findMany({
      where: { role: 'EMPLOYEE', isActive: true, department: user.department, id: { notIn: [...workingUserIds, user.id] } },
      select: { id: true },
    });
    const copy = scheduleCoverageCopy(coverage);
    for (const candidate of candidates) {
      await tx.workdayNotification.upsert({
        where: { fingerprint: `${fingerprintPrefix}${candidate.id}` },
        create: {
          userId: candidate.id,
          fingerprint: `${fingerprintPrefix}${candidate.id}`,
          kind: 'schedule_replacement_request',
          title: coverage.state === 'empty' ? 'На этот день пока никто не выходит' : 'На этот день нужна замена',
          body: `${formatDateLabel(date)} · ${copy.body}`,
          scheduledAt: new Date(),
        },
        update: {
          title: coverage.state === 'empty' ? 'На этот день пока никто не выходит' : 'На этот день нужна замена',
          body: `${formatDateLabel(date)} · ${copy.body}`,
          status: 'pending',
          scheduledAt: new Date(),
          sentAt: null,
          readAt: null,
          pushStatus: 'pending',
          pushDeliveredAt: null,
          nextPushAttemptAt: null,
          lastError: '',
          attemptCount: 0,
        },
      });
    }

    const event = await tx.adminInboxEvent.upsert({
      where: { eventKey: `schedule-coverage:${user.department}:${date}` },
      create: {
        eventKey: `schedule-coverage:${user.department}:${date}`,
        type: 'work_schedule.coverage_gap',
        title: coverage.state === 'empty' ? 'На рабочий день никто не назначен' : 'Сокращённый состав отдела',
        body: `${formatDateLabel(date)} · ${schedulePersonName(user.name)}: график изменён. ${coverage.workingCount} из ${coverage.targetCount} сотрудников.`,
        href: `/admin/workday?date=${date}`,
        sourceType: 'work_schedule_coverage',
        sourceId: `${user.department}:${date}`,
        occurredAt: new Date(),
      },
      update: {
        title: coverage.state === 'empty' ? 'На рабочий день никто не назначен' : 'Сокращённый состав отдела',
        body: `${formatDateLabel(date)} · ${schedulePersonName(user.name)}: график изменён. ${coverage.workingCount} из ${coverage.targetCount} сотрудников.`,
        occurredAt: new Date(),
      },
    });
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    if (admins.length) {
      await tx.adminInboxReceipt.createMany({ data: admins.map((admin) => ({ eventId: event.id, userId: admin.id })), skipDuplicates: true });
      await tx.adminInboxReceipt.updateMany({ where: { eventId: event.id }, data: { readAt: null } });
    }
  });

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
