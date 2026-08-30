import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey } from '@/lib/workday';
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
    const [existingOwn, departmentEntries] = await Promise.all([
      tx.workScheduleEntry.findMany({ where: { userId: user.id, date: { in: dates } }, select: { date: true, status: true } }),
      tx.workScheduleEntry.findMany({
        where: {
          department: user.department,
          date: { in: dates },
          user: { role: 'EMPLOYEE', isActive: true, department: user.department },
        },
        select: { userId: true, date: true, status: true },
      }),
    ]);
    const existingOwnByDate = new Map(existingOwn.map((entry) => [entry.date, entry.status]));
    const staleDates = mode === 'fill'
      ? existingOwn.map((entry) => entry.date)
      : changes
        .filter((change) => existingOwnByDate.get(change.date) !== change.previousStatus)
        .map((change) => change.date);
    if (staleDates.length > 0) return { staleDates };

    const entriesByDate = new Map<string, Array<{ userId: number; status: string }>>();
    for (const entry of departmentEntries) {
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
