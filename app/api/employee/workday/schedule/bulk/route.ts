import { scheduleWeekAllowsDate } from '@/lib/schedule-week-reminder';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey } from '@/lib/workday';
import { isValidScheduleDateKey, isValidScheduleMonthKey } from '@/lib/workday-schedule';
import { persistEmployeeScheduleChange } from '@/lib/work-schedule-persistence';

const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

type BulkMode = 'fill' | 'edit' | 'plan';
type BulkChange = { date: string; status: 'working' | 'off'; previousStatus?: 'working' | 'off' | null };

function parseBulkChanges(value: unknown, monthKey: string, today: string, mode: BulkMode, weekStart?: string) {
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
      || (weekStart ? !scheduleWeekAllowsDate(weekStart,date,today) : !date.startsWith(`${monthKey}-`))
      || date < today
      || (status !== 'working' && status !== 'off')
      || (mode === 'edit' && previousStatus !== 'working' && previousStatus !== 'off')
      || (mode === 'plan' && (!('previousStatus' in item) || (previousStatus !== null && previousStatus !== 'working' && previousStatus !== 'off')))
      || dates.has(date)
    ) return null;
    dates.add(date);
    changes.push({ date, status, ...(mode !== 'fill' ? { previousStatus } : {}) });
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
  const mode: BulkMode = payload?.mode === 'plan' ? 'plan' : payload?.mode === 'edit' ? 'edit' : 'fill';
  if (typeof monthKey !== 'string' || !isValidScheduleMonthKey(monthKey)) {
    return Response.json({ error: 'Некорректный месяц' }, { status: 400, headers: noStoreHeaders });
  }
  const weekStart = payload?.weekStart;
  if (weekStart !== undefined && (typeof weekStart !== 'string' || mode !== 'plan' || !scheduleWeekAllowsDate(weekStart,getMoscowDateKey(),getMoscowDateKey()))) return Response.json({error:'Некорректная неделя'},{status:400,headers:noStoreHeaders});
  const changes = parseBulkChanges(payload?.changes, monthKey, getMoscowDateKey(), mode, weekStart);
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
        .filter((change) => (existingOwnByDate.get(change.date) ?? null) !== change.previousStatus)
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
        previousStatus: mode !== 'fill' ? existingOwnByDate.get(change.date) : null,
        departmentEntries: entries,
        source: mode !== 'fill' ? 'employee_bulk_edit' : 'employee_bulk',
      });
      coverageResults.push({ date: change.date, state: coverage.state });
    }

    return { staleDates: [], coverageResults };
  }, { isolationLevel: 'Serializable', timeout: 15000 }).catch((error: unknown) => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') {
      return { staleDates: changes.map((change) => change.date) };
    }
    throw error;
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
