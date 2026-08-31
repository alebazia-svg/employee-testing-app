import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDateLabel, getMoscowDateKey } from '@/lib/workday';
import { isValidScheduleDateKey, isValidScheduleMonthKey } from '@/lib/workday-schedule';
import { persistEmployeeScheduleChange } from '@/lib/work-schedule-persistence';

const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

type BulkMode = 'fill' | 'edit';
type BulkChange = { date: string; status: 'working' | 'off'; previousStatus?: 'working' | 'off' };

function parseBulkChanges(value: unknown, monthKey: string, today: string, mode: BulkMode) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 31) return null;
  const changes: BulkChange[] = [];
  const dates = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const date = 'date' in item ? item.date : null;
    const status = 'status' in item ? item.status : null;
    const previousStatus = 'previousStatus' in item ? item.previousStatus : null;
    if (
      typeof date !== 'string'
      || !isValidScheduleDateKey(date)
      || !date.startsWith(`${monthKey}-`)
      || date < today
      || (status !== 'working' && status !== 'off')
      || (mode === 'edit' && previousStatus !== 'working' && previousStatus !== 'off')
      || dates.has(date)
    ) return null;
    dates.add(date);
    changes.push({ date, status, ...(mode === 'edit' ? { previousStatus } : {}) });
  }
  return changes.sort((left, right) => left.date.localeCompare(right.date));
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  const payload = await req.json().catch(() => null);
  if (payload?.confirmed !== true) {
    return Response.json({ error: 'Подтвердите заполнение графика' }, { status: 400, headers: noStoreHeaders });
  }
  const monthKey = payload?.monthKey;
  const mode: BulkMode = payload?.mode === 'edit' ? 'edit' : 'fill';
  if (typeof monthKey !== 'string' || !isValidScheduleMonthKey(monthKey)) {
    return Response.json({ error: 'Некорректный месяц' }, { status: 400, headers: noStoreHeaders });
  }
  const changes = parseBulkChanges(payload?.changes, monthKey, getMoscowDateKey(), mode);
  if (!changes) return Response.json({ error: 'Некорректный список дней' }, { status: 400, headers: noStoreHeaders });

  const result: { staleDates: string[]; coverageResults?: Array<{ date: string; state: 'full' | 'reduced' | 'empty' }> } = await prisma.$transaction(async (tx) => {
    const dates = changes.map((change) => change.date);
    const [existingOwn, departmentEntries, vacations] = await Promise.all([
      tx.workScheduleEntry.findMany({ where: { userId: user.id, date: { in: dates } }, select: { date: true, status: true } }),
      tx.workScheduleEntry.findMany({
        where: {
          department: user.department,
          date: { in: dates },
          user: { role: 'EMPLOYEE', isActive: true, department: user.department },
        },
        select: { userId: true, date: true, status: true },
      }),
      tx.employeeVacation.findMany({
        where: {
          department: user.department,
          status: 'active',
          dateFrom: { lte: dates[dates.length - 1] },
          dateTo: { gte: dates[0] },
        },
        select: { userId: true, dateFrom: true, dateTo: true },
      }),
    ]);
    const ownVacationDates = changes.filter((change) => vacations.some((vacation) => vacation.userId === user.id && vacation.dateFrom <= change.date && vacation.dateTo >= change.date)).map((change) => change.date);
    if (ownVacationDates.length > 0) return { staleDates: ownVacationDates };
    const existingOwnByDate = new Map(existingOwn.map((entry) => [entry.date, entry.status]));
    const staleDates = mode === 'fill'
      ? existingOwn.map((entry) => entry.date)
      : changes
        .filter((change) => existingOwnByDate.get(change.date) !== change.previousStatus)
        .map((change) => change.date);
    if (staleDates.length > 0) return { staleDates };

    const entriesByDate = new Map<string, Array<{ userId: number; status: string }>>();
    for (const entry of departmentEntries) {
      if (vacations.some((vacation) => vacation.userId === entry.userId && vacation.dateFrom <= entry.date && vacation.dateTo >= entry.date)) continue;
      const rows = entriesByDate.get(entry.date) ?? [];
      rows.push(entry);
      entriesByDate.set(entry.date, rows);
    }
    const coverageResults: Array<{ date: string; state: 'full' | 'reduced' | 'empty' }> = [];
    for (const change of changes) {
      const entries = entriesByDate.get(change.date) ?? [];
      const coverage = await persistEmployeeScheduleChange(tx, {
        user,
        date: change.date,
        status: change.status,
        previousStatus: mode === 'edit' ? existingOwnByDate.get(change.date) : null,
        departmentEntries: entries,
        source: mode === 'edit' ? 'employee_bulk_edit' : 'employee_bulk',
        // A monthly edit can touch dozens of dates. Per-date replacement pushes
        // belong only to the explicit single-day flow; otherwise one save floods
        // every colleague with a notification for each affected day.
        notifyCoverage: false,
      });
      coverageResults.push({ date: change.date, state: coverage.state });
    }

    if (mode === 'edit') {
      const stateByDate = new Map(coverageResults.map((item) => [item.date, item.state]));
      const replacementDates = changes
        .filter((change) => (
          change.previousStatus === 'working'
          && change.status === 'off'
          && stateByDate.get(change.date) !== 'full'
        ))
        .map((change) => change.date);

      if (replacementDates.length > 0) {
        const colleagues = await tx.user.findMany({
          where: {
            role: 'EMPLOYEE',
            isActive: true,
            department: user.department,
            id: { not: user.id },
          },
          select: { id: true },
        });
        const workingByUserAndDate = new Set(
          departmentEntries
            .filter((entry) => entry.status === 'working')
            .map((entry) => `${entry.userId}:${entry.date}`),
        );
        const candidates = colleagues.filter((colleague) => (
          replacementDates.some((date) => !workingByUserAndDate.has(`${colleague.id}:${date}`))
        ));
        const now = new Date();
        const body = replacementDates.length === 1
          ? `${formatDateLabel(replacementDates[0])} · Сможете выйти на замену?`
          : `${replacementDates.length} дн. · Откройте график и отметьте дни, когда сможете выйти.`;
        for (const candidate of candidates) {
          const fingerprint = `schedule-coverage-digest:${user.department}:${monthKey}:${user.id}:${candidate.id}`;
          await tx.workdayNotification.upsert({
            where: { fingerprint },
            create: {
              userId: candidate.id,
              fingerprint,
              kind: 'schedule_replacement_digest',
              title: 'Нужна замена в графике',
              body,
              scheduledAt: now,
            },
            update: {
              title: 'Нужна замена в графике',
              body,
              status: 'pending',
              scheduledAt: now,
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
      }
    }
    return { staleDates: [], coverageResults };
  });

  if (result.staleDates.length > 0) {
    return Response.json({
      error: 'График изменился на другом устройстве. Обновите месяц и повторите заполнение.',
      code: 'SCHEDULE_BULK_STALE',
      staleDates: result.staleDates,
    }, { status: 409, headers: noStoreHeaders });
  }

  const coverageResults = result.coverageResults ?? [];
  return Response.json({
    ok: true,
    changedCount: changes.length,
    workingDays: changes.filter((change) => change.status === 'working').length,
    offDays: changes.filter((change) => change.status === 'off').length,
    reducedDates: coverageResults.filter((item) => item.state === 'reduced').map((item) => item.date),
    emptyDates: coverageResults.filter((item) => item.state === 'empty').map((item) => item.date),
  }, { headers: noStoreHeaders });
}
