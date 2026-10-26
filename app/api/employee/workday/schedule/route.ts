import { requestedDates, scheduleSnapshot } from '@/lib/employee-schedule-snapshot';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey, scheduleStatuses } from '@/lib/workday';
import { isValidScheduleDateKey, scheduleMonthKeyFromDate } from '@/lib/workday-schedule';
import { scheduleCoverage, scheduleCoverageCopy, scheduleWorkingCountAfterChange, shouldRequestScheduleReplacement } from '@/lib/work-schedule-coverage';
import { persistEmployeeScheduleChange } from '@/lib/work-schedule-persistence';
import { activeScheduleNotices } from '@/lib/work-schedule-notifications';

const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  const params = new URL(req.url).searchParams;
  const range = requestedDates(params.get('month'), params.get('week'));
  if (!range) return Response.json({ error: 'Некорректный период графика' }, { status: 400, headers: noStoreHeaders });
  return Response.json(await scheduleSnapshot(user, range.dates, range.monthKey), { headers: noStoreHeaders });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await req.json().catch(() => null);
  const { date, status, confirmCoverageImpact, action, noticeId, expectedStatus } = payload ?? {};
  if (typeof date !== 'string' || !isValidScheduleDateKey(date)) {
    return Response.json({ error: 'Некорректная дата' }, { status: 400, headers: noStoreHeaders });
  }
  const declining = action === 'decline_replacement';
  if (!declining && !scheduleStatuses.includes(status)) {
    return Response.json({ error: 'Некорректный статус графика' }, { status: 400, headers: noStoreHeaders });
  }
  if (date < getMoscowDateKey()) {
    return Response.json({ error: 'Прошедший день нельзя изменить самостоятельно. Обратитесь к администратору.' }, { status: 409, headers: noStoreHeaders });
  }
  if (noticeId !== undefined && (!Number.isSafeInteger(noticeId) || noticeId <= 0 || (expectedStatus !== null && expectedStatus !== 'off'))) {
    return Response.json({ error: 'Некорректный ответ на уведомление' }, { status: 400, headers: noStoreHeaders });
  }
  const stale = { error: 'График изменился. Откройте вопрос ещё раз.', code: 'SCHEDULE_STALE' };
  const result = await prisma.$transaction(async (tx) => {
    const [currentEntry, departmentEntries, vacations] = await Promise.all([
      tx.workScheduleEntry.findUnique({ where: { userId_date: { userId: user.id, date } } }),
      tx.workScheduleEntry.findMany({ where: { department: user.department, date, user: { role: 'EMPLOYEE', isActive: true, department: user.department } } }),
      tx.employeeVacation.findMany({ where: { department: user.department, status: 'active', dateFrom: { lte: date }, dateTo: { gte: date } }, select: { userId: true } }),
    ]);
    const vacationUserIds = new Set(vacations.map(row => row.userId));
    if (vacationUserIds.has(user.id)) return { error: 'Этот день входит в отпуск. Измените период отпуска.' };
    const fingerprint = `schedule-coverage:${user.department}:${date}:${user.id}`;
    let answeredNotice = null;
    if (noticeId !== undefined || declining) {
      answeredNotice = await tx.workdayNotification.findFirst({ where: {
        userId: user.id, ...(noticeId !== undefined ? { id: noticeId } : { fingerprint }), status: { in: ['pending', 'sent'] },
      } });
      if (!answeredNotice) return stale;
      const activeDates = (await activeScheduleNotices(tx, [answeredNotice])).get(answeredNotice.id) ?? [];
      if (!activeDates.some(row => row.date === date)) return stale;
      if (noticeId !== undefined && (currentEntry?.status ?? null) !== expectedStatus) return stale;
      if (declining && currentEntry?.status !== 'off') return stale;
    }
    const effectiveEntries = departmentEntries.filter(row => !vacationUserIds.has(row.userId));
    const coverage = scheduleCoverage(user.department, scheduleWorkingCountAfterChange({
      workingBefore: effectiveEntries.filter(row => row.status === 'working').length,
      previousStatus: currentEntry?.status, nextStatus: declining ? 'off' : status,
    }));
    if (!declining && currentEntry?.status !== status) {
      if (shouldRequestScheduleReplacement({ previousStatus: currentEntry?.status, nextStatus: status, coverage }) && confirmCoverageImpact !== true) {
        return { error: 'Подтвердите изменение графика', code: 'SCHEDULE_COVERAGE_CONFIRMATION_REQUIRED', coverage, copy: scheduleCoverageCopy(coverage) };
      }
      await persistEmployeeScheduleChange(tx, { user, date, status, previousStatus: currentEntry?.status, departmentEntries: effectiveEntries, source: 'employee' });
    }
    if (answeredNotice) {
      // A legacy monthly notice can contain several dates: resolve only this date.
      const now = new Date();
      await tx.workdayNotification.upsert({ where: { fingerprint },
        create: { userId: user.id, fingerprint, kind: 'schedule_replacement_request', title: answeredNotice.title, body: '', scheduledAt: now, status: 'answered', pushStatus: 'cancelled', readAt: now },
        update: { status: 'answered', pushStatus: 'cancelled', readAt: now, nextPushAttemptAt: null },
      });
    }
    return { coverage, replacementDeclined: declining };
  }, { isolationLevel: 'Serializable', timeout: 15000 }).catch((error: unknown) => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') return stale;
    throw error;
  });
  if ('error' in result) return Response.json(result, { status: 409, headers: noStoreHeaders });
  const monthKey = scheduleMonthKeyFromDate(date);
  const range = monthKey ? requestedDates(monthKey) : null;
  if (!range) return Response.json({ error: 'Некорректная дата' }, { status: 400, headers: noStoreHeaders });
  return Response.json({ ...(await scheduleSnapshot(user, range.dates, range.monthKey)), ...result }, { headers: noStoreHeaders });
}

export async function DELETE(_req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json({ error: 'Выберите явный статус: «Работаю» или «Выходной».' }, { status: 405, headers: noStoreHeaders });
}
