import { AlertCircle, CalendarCheck, CheckCircle2, Clock, Timer, Users } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
import { getAttendanceRows, getScheduleRows, type AttendanceRow, type ScheduleRow } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

type SearchParams = {
  month?: string;
  employee?: string;
  status?: string;
};

type ParsedMark = AttendanceRow & {
  parsedAt: Date | null;
  dateKey: string;
  monthKey: string;
  minutesOfDay: number | null;
};

type DailySummary = {
  key: string;
  dateKey: string;
  date: string;
  employee: string;
  shift: string;
  arrival: string;
  departure: string;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number | null;
  status: string;
  comment: string;
  monthKey: string;
};

type EmployeeSummary = {
  employee: string;
  daysWithMarks: number;
  fullDays: number;
  normalDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  markProblemDays: number;
  problemsRate: number;
  totalViolations: number;
  totalWorkedMinutes: number;
  averageLateMinutes: number;
  averageLateNote: string;
};

type ParsedScheduleRow = ScheduleRow & {
  dateKey: string;
  monthKey: string;
};

type PlanFactRow = {
  key: string;
  dateKey: string;
  date: string;
  dayOfWeek: string;
  employee: string;
  matchedEmployee: string;
  department: string;
  hasSchedule: boolean;
  plannedWork: boolean | null;
  fact: string;
  arrival: string;
  departure: string;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number | null;
  status: string;
  scheduleNote: string;
  monthKey: string;
};

type PlanEmployeeSummary = {
  department: string;
  employee: string;
  plannedDays: number;
  attendanceDays: number;
  fullDays: number;
  missedDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  noDepartureDays: number;
  offScheduleDays: number;
  totalWorkedMinutes: number;
  attendanceRate: number;
};

const ALL = 'all';

function normalizeEmployeeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getDepartment(employee: string) {
  const normalized = normalizeEmployeeName(employee);
  if (normalized.includes('залина') || normalized.includes('лиана')) return 'Опт';
  return 'Розница';
}

function displayEmployeeName(employee: string) {
  const parts = employee.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return employee;
  if (/^[А-ЯЁA-Z]\.?$/i.test(parts[1])) return parts[0];
  return parts[1];
}

function employeeMatchesFilter(rowEmployee: string, matchedEmployee: string, selectedEmployee: string) {
  if (selectedEmployee === ALL) return true;

  const selected = normalizeEmployeeName(selectedEmployee);
  const schedule = normalizeEmployeeName(rowEmployee);
  const matched = normalizeEmployeeName(matchedEmployee);

  return selected === schedule || selected === matched || matched.includes(selected) || selected.includes(schedule);
}

function getActionKind(action: string) {
  const normalizedAction = action.trim().toLowerCase();

  if (normalizedAction.includes('начало') || normalizedAction.includes('приход')) return 'arrival';
  if (normalizedAction.includes('окончание') || normalizedAction.includes('уход')) return 'departure';

  return 'unknown';
}

function parseRuTimestamp(value: string) {
  const match = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const dateOnlyMatch = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dateOnlyMatch) {
    const [, day, month, year] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const [, day, month, year, hour, minute, second = '0'] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function dateKey(date: Date | null, fallback: string) {
  if (!date) return fallback || '-';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthKey(date: Date | null, fallback: string) {
  if (!date) return fallback.slice(0, 7) || '-';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function displayDateFromKey(key: string) {
  const [year, month, day] = key.split('-');
  if (!year || !month || !day) return key;
  return `${day}.${month}.${year}`;
}

function minutesOfDay(date: Date | null) {
  if (!date) return null;
  return date.getHours() * 60 + date.getMinutes();
}

function formatTimeFromMinutes(minutes: number | null) {
  if (minutes === null) return '-';
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return '-';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours} ч ${rest} мин` : `${rest} мин`;
}

function parseTimeToMinutes(value?: string) {
  if (!value) return null;
  const match = value.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseShift(shift: string) {
  if (!shift.trim()) return null;
  const [startRaw, endRaw] = shift.split(/[–—-]/).map((part) => part.trim());
  const start = parseTimeToMinutes(startRaw);
  const end = parseTimeToMinutes(endRaw);
  if (start === null || end === null) return null;
  return { start, end };
}

function normalizeRows(rows: AttendanceRow[]): ParsedMark[] {
  return rows.map((row) => {
    const parsedAt = parseRuTimestamp(row.timestamp || `${row.date} ${row.time}`);
    return {
      ...row,
      parsedAt,
      dateKey: dateKey(parsedAt, row.date),
      monthKey: monthKey(parsedAt, row.date),
      minutesOfDay: minutesOfDay(parsedAt),
    };
  });
}

function normalizeScheduleRows(rows: ScheduleRow[]): ParsedScheduleRow[] {
  return rows.map((row) => {
    const parsedDate = parseRuTimestamp(row.date);
    return {
      ...row,
      dateKey: dateKey(parsedDate, row.date),
      monthKey: monthKey(parsedDate, row.date),
    };
  });
}

function buildDailySummaries(rows: ParsedMark[]) {
  const grouped = new Map<string, ParsedMark[]>();

  for (const row of rows) {
    const key = `${row.employee}__${row.dateKey}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return Array.from(grouped.entries()).map(([key, group]) => {
    const employee = group[0]?.employee || '-';
    const date = group[0]?.dateKey || '-';
    const shift = group.find((row) => row.shift?.trim())?.shift || '';
    const parsedShift = parseShift(shift);
    const arrivals = group.filter((row) => getActionKind(row.action) === 'arrival' && row.minutesOfDay !== null);
    const departures = group.filter((row) => getActionKind(row.action) === 'departure' && row.minutesOfDay !== null);
    const arrival = arrivals.length ? Math.min(...arrivals.map((row) => row.minutesOfDay!)) : null;
    const departure = departures.length ? Math.max(...departures.map((row) => row.minutesOfDay!)) : null;
    const lateMinutes = parsedShift && arrival !== null ? Math.max(arrival - parsedShift.start, 0) : 0;
    const earlyLeaveMinutes = parsedShift && departure !== null ? Math.max(parsedShift.end - departure, 0) : 0;
    const workedMinutes = arrival !== null && departure !== null ? Math.max(departure - arrival, 0) : null;
    const comments = group.map((row) => row.comment).filter(Boolean);
    const unknownActions = group
      .filter((row) => getActionKind(row.action) === 'unknown' && row.action.trim())
      .map((row) => `Нераспознанное действие: ${row.action}`);
    const commentParts = [...comments];

    if (!shift.trim()) commentParts.unshift('Смена не указана');
    commentParts.push(...unknownActions);

    let status = 'Норма';
    if (arrival === null && departure === null) status = 'Неполные отметки';
    else if (arrival === null) status = 'Нет прихода';
    else if (departure === null) status = 'Нет ухода';
    else if (lateMinutes > 0 && earlyLeaveMinutes > 0) status = 'Опоздание + ранний уход';
    else if (lateMinutes > 0) status = 'Опоздание';
    else if (earlyLeaveMinutes > 0) status = 'Ранний уход';

    return {
      key,
      dateKey: date,
      date: displayDateFromKey(date),
      employee,
      shift: shift || 'Смена не указана',
      arrival: formatTimeFromMinutes(arrival),
      departure: formatTimeFromMinutes(departure),
      lateMinutes,
      earlyLeaveMinutes,
      workedMinutes,
      status,
      comment: commentParts.join('; '),
      monthKey: group[0]?.monthKey || '-',
    } satisfies DailySummary;
  }).sort((a, b) => `${b.monthKey}-${b.dateKey}`.localeCompare(`${a.monthKey}-${a.dateKey}`));
}

function buildPlanFactRows(scheduleRows: ParsedScheduleRow[], summaries: DailySummary[]) {
  const summariesByKey = new Map(summaries.map((summary) => [summary.key, summary]));
  const summariesByDate = new Map<string, DailySummary[]>();
  const matchedSummaryKeys = new Set<string>();

  for (const summary of summaries) {
    summariesByDate.set(summary.dateKey, [...(summariesByDate.get(summary.dateKey) ?? []), summary]);
  }

  const scheduleFactRows = scheduleRows.map((row) => {
    const scheduleName = normalizeEmployeeName(row.employee);
    const dateSummaries = summariesByDate.get(row.dateKey) ?? [];
    const exactMatches = dateSummaries.filter((summary) => normalizeEmployeeName(summary.employee) === scheduleName);
    const fuzzyMatches = exactMatches.length ? exactMatches : dateSummaries.filter((summary) => normalizeEmployeeName(summary.employee).includes(scheduleName));
    const summary = summariesByKey.get(`${row.employee}__${row.dateKey}`) ?? fuzzyMatches[0];
    if (summary) matchedSummaryKeys.add(summary.key);
    const hasArrival = Boolean(summary && summary.arrival !== '-');
    const hasDeparture = Boolean(summary && summary.departure !== '-');
    const hasAnyMark = hasArrival || hasDeparture;
    const fact = hasArrival && hasDeparture ? 'Есть приход и уход' : hasArrival ? 'Есть приход' : hasDeparture ? 'Есть уход' : 'Нет отметок';
    const commentParts = [row.scheduleNote].filter(Boolean);

    if (fuzzyMatches.length > 1) commentParts.push('Проверьте совпадение имени');

    let status = 'Цвет не распознан';
    if (row.plannedWork === true) {
      if (!hasArrival) status = 'Нет явки';
      else if (!hasDeparture && (summary?.lateMinutes ?? 0) > 0) status = 'Опоздание + нет ухода';
      else if (!hasDeparture) status = 'Явка + нет ухода';
      else if ((summary?.lateMinutes ?? 0) > 0) status = 'Опоздание';
      else if ((summary?.earlyLeaveMinutes ?? 0) > 0) status = 'Ранний уход';
      else status = 'Полный день';
    } else if (row.plannedWork === false) {
      status = hasAnyMark ? 'Вне графика' : 'Не требуется';
    }

    return {
      key: `${row.employee}__${row.dateKey}`,
      dateKey: row.dateKey,
      date: displayDateFromKey(row.dateKey),
      dayOfWeek: row.dayOfWeek || '-',
      employee: displayEmployeeName(row.employee),
      matchedEmployee: summary?.employee ?? row.employee,
      department: getDepartment(row.employee),
      hasSchedule: true,
      plannedWork: row.plannedWork,
      fact,
      arrival: summary?.arrival ?? '-',
      departure: summary?.departure ?? '-',
      lateMinutes: summary?.lateMinutes ?? 0,
      earlyLeaveMinutes: summary?.earlyLeaveMinutes ?? 0,
      workedMinutes: summary?.workedMinutes ?? null,
      status,
      scheduleNote: commentParts.join('; '),
      monthKey: row.monthKey,
    } satisfies PlanFactRow;
  });

  const formOnlyRows = summaries
    .filter((summary) => !matchedSummaryKeys.has(summary.key))
    .map((summary) => {
      const hasArrival = summary.arrival !== '-';
      const hasDeparture = summary.departure !== '-';
      let status = 'Нет явки';

      if (hasArrival && !hasDeparture && summary.lateMinutes > 0) status = 'Опоздание + нет ухода';
      else if (hasArrival && !hasDeparture) status = 'Явка + нет ухода';
      else if (hasArrival && summary.lateMinutes > 0) status = 'Опоздание';
      else if (hasArrival && hasDeparture) status = 'Полный день';

      return {
      key: `form-only__${summary.key}`,
      dateKey: summary.dateKey,
      date: summary.date,
      dayOfWeek: '-',
      employee: displayEmployeeName(summary.employee),
      matchedEmployee: summary.employee,
      department: getDepartment(summary.employee),
      hasSchedule: false,
      plannedWork: true,
      fact: summary.arrival !== '-' && summary.departure !== '-' ? 'Есть приход и уход' : summary.arrival !== '-' ? 'Есть приход' : summary.departure !== '-' ? 'Есть уход' : 'Нет отметок',
      arrival: summary.arrival,
      departure: summary.departure,
      lateMinutes: summary.lateMinutes,
      earlyLeaveMinutes: summary.earlyLeaveMinutes,
      workedMinutes: summary.workedMinutes,
      status,
      scheduleNote: 'Расчёт по Google Form без графика',
      monthKey: summary.monthKey,
    } satisfies PlanFactRow;
    });

  return [...scheduleFactRows, ...formOnlyRows].sort((a, b) => `${b.monthKey}-${b.dateKey}`.localeCompare(`${a.monthKey}-${a.dateKey}`));
}

function isIncompleteStatus(status: string) {
  return status === 'Нет прихода' || status === 'Нет ухода' || status === 'Неполные отметки';
}

function hasViolation(summary: EmployeeSummary) {
  return summary.totalViolations > 0;
}

function buildPlanEmployeeSummaries(rows: PlanFactRow[]) {
  const grouped = new Map<string, PlanFactRow[]>();

  for (const row of rows) {
    const key = `${row.department}__${row.employee}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return Array.from(grouped.values()).map((items) => {
    const first = items[0]!;
    const plannedDays = items.filter((item) => item.plannedWork === true).length;
    const attendanceDays = items.filter((item) => item.plannedWork === true && item.arrival !== '-').length;
    const fullDays = items.filter((item) => item.plannedWork === true && item.arrival !== '-' && item.departure !== '-').length;
    const missedDays = items.filter((item) => item.plannedWork === true && item.arrival === '-').length;
    const noDepartureDays = items.filter((item) => item.plannedWork === true && item.arrival !== '-' && item.departure === '-').length;
    const lateDays = items.filter((item) => item.plannedWork === true && item.lateMinutes > 0).length;
    const earlyLeaveDays = items.filter((item) => item.plannedWork === true && item.earlyLeaveMinutes > 0).length;
    const offScheduleDays = items.filter((item) => item.plannedWork === false && (item.arrival !== '-' || item.departure !== '-')).length;

    return {
      department: first.department,
      employee: first.employee,
      plannedDays,
      attendanceDays,
      fullDays,
      missedDays,
      lateDays,
      earlyLeaveDays,
      noDepartureDays,
      offScheduleDays,
      totalWorkedMinutes: items.reduce((sum, item) => sum + (item.workedMinutes ?? 0), 0),
      attendanceRate: plannedDays ? Math.round((attendanceDays * 100) / plannedDays) : 0,
    } satisfies PlanEmployeeSummary;
  }).sort((a, b) => {
    if (a.missedDays !== b.missedDays) return b.missedDays - a.missedDays;
    if (a.lateDays !== b.lateDays) return b.lateDays - a.lateDays;
    if (a.noDepartureDays !== b.noDepartureDays) return b.noDepartureDays - a.noDepartureDays;
    if (a.attendanceRate !== b.attendanceRate) return a.attendanceRate - b.attendanceRate;
    return a.employee.localeCompare(b.employee, 'ru');
  });
}

function buildEmployeeSummaries(rows: DailySummary[]) {
  const grouped = new Map<string, DailySummary[]>();

  for (const row of rows) {
    grouped.set(row.employee, [...(grouped.get(row.employee) ?? []), row]);
  }

  return Array.from(grouped.entries()).map(([employee, items]) => {
    const lateItems = items.filter((item) => item.status.includes('Опоздание') || item.lateMinutes > 0);
    const markProblemDays = items.filter((item) => isIncompleteStatus(item.status)).length;
    const fullDays = items.filter((item) => item.workedMinutes !== null).length;
    const daysWithMarks = items.length;
    const summary: EmployeeSummary = {
      employee,
      daysWithMarks,
      fullDays,
      normalDays: items.filter((item) => item.status === 'Норма').length,
      lateDays: lateItems.length,
      earlyLeaveDays: items.filter((item) => item.status.includes('Ранний уход') || item.earlyLeaveMinutes > 0).length,
      markProblemDays,
      problemsRate: daysWithMarks ? Math.round((markProblemDays * 100) / daysWithMarks) : 0,
      totalViolations: lateItems.length + items.filter((item) => item.status.includes('Ранний уход') || item.earlyLeaveMinutes > 0).length + markProblemDays,
      totalWorkedMinutes: items.reduce((sum, item) => sum + (item.workedMinutes ?? 0), 0),
      averageLateMinutes: lateItems.length ? Math.round(lateItems.reduce((sum, item) => sum + item.lateMinutes, 0) / lateItems.length) : 0,
      averageLateNote: lateItems.length && fullDays === 0 ? 'по приходам' : '',
    };

    return summary;
  }).sort((a, b) => {
    if (a.totalViolations !== b.totalViolations) return b.totalViolations - a.totalViolations;
    if (a.lateDays !== b.lateDays) return b.lateDays - a.lateDays;
    if (a.markProblemDays !== b.markProblemDays) return b.markProblemDays - a.markProblemDays;
    return a.employee.localeCompare(b.employee, 'ru');
  });
}

function statusClass(status: string) {
  if (status === 'Норма') return 'bg-green-100 text-green-800';
  if (isIncompleteStatus(status)) return 'bg-red-100 text-red-700';
  if (status.includes('Опоздание') || status.includes('Ранний')) return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}

function actionClass(action: string) {
  const actionKind = getActionKind(action);
  if (actionKind === 'departure') return 'bg-slate-100 text-slate-700';
  if (actionKind === 'arrival') return 'bg-green-100 text-green-800';
  return 'bg-amber-100 text-amber-800';
}

function applyFilters(rows: ParsedMark[], summaries: DailySummary[], filters: Required<SearchParams>) {
  const filteredSummaries = summaries.filter((summary) => {
    if (filters.month !== ALL && summary.monthKey !== filters.month) return false;
    if (filters.employee !== ALL && summary.employee !== filters.employee) return false;
    if (filters.status !== ALL && summary.status !== filters.status) return false;
    return true;
  });
  const allowedKeys = new Set(filteredSummaries.map((summary) => summary.key));
  const filteredRows = rows.filter((row) => {
    if (filters.month !== ALL && row.monthKey !== filters.month) return false;
    if (filters.employee !== ALL && row.employee !== filters.employee) return false;
    if (filters.status !== ALL && !allowedKeys.has(`${row.employee}__${row.dateKey}`)) return false;
    return true;
  });

  return { filteredRows, filteredSummaries };
}

function applyPlanFactFilters(rows: PlanFactRow[], filters: Required<SearchParams>) {
  return rows.filter((row) => {
    if (filters.month !== ALL && row.monthKey !== filters.month) return false;
    if (!employeeMatchesFilter(row.employee, row.matchedEmployee, filters.employee)) return false;
    if (filters.status !== ALL && row.status !== filters.status) return false;
    return true;
  });
}

function summaryStats(rows: ParsedMark[], summaries: DailySummary[]) {
  const totalWorked = summaries.reduce((sum, item) => sum + (item.workedMinutes ?? 0), 0);
  const lateDays = summaries.filter((item) => item.lateMinutes > 0).length;
  const incompleteDays = summaries.filter((item) => isIncompleteStatus(item.status)).length;
  const lateItems = summaries.filter((item) => item.lateMinutes > 0);
  const averageLate = lateItems.length ? Math.round(lateItems.reduce((sum, item) => sum + item.lateMinutes, 0) / lateItems.length) : 0;

  return [
    { label: 'Всего отметок', value: rows.length, icon: CalendarCheck },
    { label: 'Сотрудников в выборке', value: new Set(rows.map((row) => row.employee)).size, icon: Users },
    { label: 'Дней с опозданиями', value: lateDays, icon: Clock },
    { label: 'Дней с неполными отметками', value: incompleteDays, icon: AlertCircle },
    { label: 'Среднее опоздание', value: `${averageLate} мин`, icon: Timer },
    { label: 'Общее отработанное время', value: formatDuration(totalWorked), icon: CheckCircle2 },
  ];
}

function planStats(rows: PlanFactRow[]) {
  const plannedDays = rows.filter((row) => row.plannedWork === true).length;
  const attendanceDays = rows.filter((row) => row.plannedWork === true && row.arrival !== '-').length;
  const missedDays = rows.filter((row) => row.plannedWork === true && row.arrival === '-').length;
  const lateDays = rows.filter((row) => row.plannedWork === true && row.lateMinutes > 0).length;
  const noDepartureDays = rows.filter((row) => row.plannedWork === true && row.arrival !== '-' && row.departure === '-').length;
  const fullDays = rows.filter((row) => row.plannedWork === true && row.arrival !== '-' && row.departure !== '-').length;
  const offScheduleDays = rows.filter((row) => row.plannedWork === false && (row.arrival !== '-' || row.departure !== '-')).length;
  const attendanceRate = plannedDays ? Math.round((attendanceDays * 100) / plannedDays) : 0;

  return [
    { label: 'Плановых рабочих дней', value: plannedDays, icon: CalendarCheck },
    { label: 'Явок подтверждено', value: attendanceDays, icon: CheckCircle2 },
    { label: 'Нет явки по графику', value: missedDays, icon: AlertCircle },
    { label: 'Опозданий', value: lateDays, icon: Clock },
    { label: 'Нет отметки ухода', value: noDepartureDays, icon: Timer },
    { label: 'Полных дней', value: fullDays, icon: CheckCircle2 },
    { label: 'Работ вне графика', value: offScheduleDays, icon: Users },
    { label: 'Выполнение явки', value: `${attendanceRate}%`, icon: CheckCircle2 },
  ];
}

function FilterBar({
  months,
  employees,
  statuses,
  filters,
}: {
  months: string[];
  employees: string[];
  statuses: string[];
  filters: Required<SearchParams>;
}) {
  return (
    <form className='mb-5 grid gap-3 rounded-lg border border-border bg-white p-4 md:grid-cols-4'>
      <label className='text-sm font-semibold text-slate-700'>
        Месяц
        <select name='month' defaultValue={filters.month} className='mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm'>
          <option value={ALL}>Все месяцы</option>
          {months.map((month) => <option key={month} value={month}>{month}</option>)}
        </select>
      </label>
      <label className='text-sm font-semibold text-slate-700'>
        Сотрудник
        <select name='employee' defaultValue={filters.employee} className='mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm'>
          <option value={ALL}>Все сотрудники</option>
          {employees.map((employee) => <option key={employee} value={employee}>{employee}</option>)}
        </select>
      </label>
      <label className='text-sm font-semibold text-slate-700'>
        Статус
        <select name='status' defaultValue={filters.status} className='mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm'>
          <option value={ALL}>Все статусы</option>
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </label>
      <div className='flex items-end'>
        <button className='h-[42px] w-full rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm shadow-green-700/20' type='submit'>
          Применить
        </button>
      </div>
    </form>
  );
}

function RawTable({ rows }: { rows: ParsedMark[] }) {
  return (
    <Table>
      <thead className='bg-slate-50 text-slate-500'>
        <tr className='text-left'>
          <th className='px-5 py-4'>ФИО сотрудника</th>
          <th className='px-5 py-4'>Дата</th>
          <th className='px-5 py-4'>Действие</th>
          <th className='px-5 py-4'>Время отметки</th>
          <th className='px-5 py-4'>Смена</th>
          <th className='px-5 py-4'>Причина/Комментарий</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.employee}-${row.timestamp}-${index}`} className='border-t border-border/70'>
            <td className='px-5 py-4 font-semibold text-slate-900'>{displayEmployeeName(row.employee)}</td>
            <td className='px-5 py-4 text-slate-700'>{displayDateFromKey(row.dateKey)}</td>
            <td className='px-5 py-4'><Badge className={actionClass(row.action)}>{row.action}</Badge></td>
            <td className='px-5 py-4 text-slate-700'>{row.time}</td>
            <td className='px-5 py-4 text-slate-700'>{row.shift || 'Смена не указана'}</td>
            <td className='px-5 py-4 text-slate-600'>{row.comment || '-'}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function EmployeeTotalsTable({ rows }: { rows: EmployeeSummary[] }) {
  return (
    <Table>
      <thead className='bg-slate-50 text-slate-500'>
        <tr className='text-left'>
          <th className='px-5 py-4'>Сотрудник</th>
          <th className='px-5 py-4'>Дней с отметками</th>
          <th className='px-5 py-4'>Полных дней</th>
          <th className='px-5 py-4'>Норма</th>
          <th className='px-5 py-4'>Опозданий</th>
          <th className='px-5 py-4'>Ранних уходов</th>
          <th className='px-5 py-4'>Проблемы с отметками</th>
          <th className='px-5 py-4'>Проблемный %</th>
          <th className='px-5 py-4'>Нарушений всего</th>
          <th className='px-5 py-4'>Отработано</th>
          <th className='px-5 py-4'>Среднее опоздание</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.employee} className='border-t border-border/70'>
            <td className='px-5 py-4'>
              <div className='font-semibold text-slate-900'>{displayEmployeeName(row.employee)}</div>
              <div className='mt-1'>
                {hasViolation(row) ? (
                  <div className='flex flex-wrap gap-1.5'>
                    {row.markProblemDays > 0 && <Badge className='bg-red-100 text-red-700'>Проблемы с отметками</Badge>}
                    {row.problemsRate > 30 && <Badge className='bg-red-100 text-red-700'>Много неполных</Badge>}
                    {row.markProblemDays === 0 && row.lateDays > 0 && <Badge className='bg-amber-100 text-amber-800'>Есть опоздания</Badge>}
                    {row.markProblemDays === 0 && row.lateDays === 0 && row.earlyLeaveDays > 0 && <Badge className='bg-amber-100 text-amber-800'>Ранние уходы</Badge>}
                  </div>
                ) : (
                  <Badge className='bg-green-100 text-green-800'>Без нарушений</Badge>
                )}
              </div>
            </td>
            <td className='px-5 py-4 text-slate-700'>{row.daysWithMarks}</td>
            <td className='px-5 py-4 text-slate-700'>{row.fullDays}</td>
            <td className='px-5 py-4 text-slate-700'>{row.normalDays}</td>
            <td className='px-5 py-4 text-slate-700'>{row.lateDays}</td>
            <td className='px-5 py-4 text-slate-700'>{row.earlyLeaveDays}</td>
            <td className='px-5 py-4 text-slate-700'>{row.markProblemDays}</td>
            <td className='px-5 py-4'>
              <Badge className={row.problemsRate > 30 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}>{row.problemsRate}%</Badge>
            </td>
            <td className='px-5 py-4 font-semibold text-slate-900'>{row.totalViolations}</td>
            <td className='px-5 py-4 text-slate-700'>{formatDuration(row.totalWorkedMinutes)}</td>
            <td className='px-5 py-4 text-slate-700'>
              {row.averageLateMinutes ? (
                <span>{row.averageLateMinutes} мин{row.averageLateNote && <span className='block text-xs text-slate-500'>{row.averageLateNote}</span>}</span>
              ) : '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function PlanEmployeeTotalsTable({ rows }: { rows: PlanEmployeeSummary[] }) {
  return (
    <Table>
      <thead className='bg-slate-50 text-slate-500'>
        <tr className='text-left'>
          <th className='px-5 py-4'>Подразделение</th>
          <th className='px-5 py-4'>Сотрудник</th>
          <th className='px-5 py-4'>План дней</th>
          <th className='px-5 py-4'>Явка</th>
          <th className='px-5 py-4'>Нет явки</th>
          <th className='px-5 py-4'>Опоздания</th>
          <th className='px-5 py-4'>Ранние уходы</th>
          <th className='px-5 py-4'>Нет ухода</th>
          <th className='px-5 py-4'>Полных дней</th>
          <th className='px-5 py-4'>Вне графика</th>
          <th className='px-5 py-4'>Отработано часов</th>
          <th className='px-5 py-4'>Выполнение явки %</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.department}-${row.employee}`} className='border-t border-border/70'>
            <td className='px-5 py-4 text-slate-700'>{row.department}</td>
            <td className='px-5 py-4 font-semibold text-slate-900'>{displayEmployeeName(row.employee)}</td>
            <td className='px-5 py-4 text-slate-700'>{row.plannedDays}</td>
            <td className='px-5 py-4 text-slate-700'>{row.attendanceDays}</td>
            <td className='px-5 py-4'>{row.missedDays ? <Badge className='bg-red-100 text-red-700'>{row.missedDays}</Badge> : '-'}</td>
            <td className='px-5 py-4'>{row.lateDays ? <Badge className='bg-amber-100 text-amber-800'>{row.lateDays}</Badge> : '-'}</td>
            <td className='px-5 py-4'>{row.earlyLeaveDays ? <Badge className='bg-amber-100 text-amber-800'>{row.earlyLeaveDays}</Badge> : '-'}</td>
            <td className='px-5 py-4'>{row.noDepartureDays ? <Badge className='bg-amber-100 text-amber-800'>{row.noDepartureDays}</Badge> : '-'}</td>
            <td className='px-5 py-4 text-slate-700'>{row.fullDays}</td>
            <td className='px-5 py-4'>{row.offScheduleDays ? <Badge className='bg-blue-100 text-blue-800'>{row.offScheduleDays}</Badge> : '-'}</td>
            <td className='px-5 py-4 text-slate-700'>{formatDuration(row.totalWorkedMinutes)}</td>
            <td className='px-5 py-4'>
              <Badge className={row.attendanceRate === 100 ? 'bg-green-100 text-green-800' : row.attendanceRate >= 80 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}>
                {row.attendanceRate}%
              </Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function plannedWorkLabel(value: boolean | null, hasSchedule = true) {
  if (!hasSchedule) return 'По форме';
  if (value === true) return 'Работает';
  if (value === false) return 'Не работает';
  return 'Цвет не распознан';
}

function plannedWorkClass(value: boolean | null) {
  if (value === true) return 'bg-green-100 text-green-800';
  if (value === false) return 'bg-slate-100 text-slate-700';
  return 'bg-amber-100 text-amber-800';
}

function planFactStatusClass(status: string) {
  if (status === 'Явка' || status === 'Полный день') return 'bg-green-100 text-green-800';
  if (status === 'Не требуется') return 'bg-slate-100 text-slate-700';
  if (status === 'Вне графика') return 'bg-blue-100 text-blue-800';
  if (status === 'Нет явки') return 'bg-red-100 text-red-700';
  if (status.includes('нет ухода') || status === 'Опоздание' || status === 'Ранний уход' || status === 'Цвет не распознан') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}

function PlanFactTable({ rows }: { rows: PlanFactRow[] }) {
  return (
    <Table>
      <thead className='bg-slate-50 text-slate-500'>
        <tr className='text-left'>
          <th className='px-5 py-4'>Дата</th>
          <th className='px-5 py-4'>День недели</th>
          <th className='px-5 py-4'>Сотрудник</th>
          <th className='px-5 py-4'>По графику</th>
          <th className='px-5 py-4'>Факт</th>
          <th className='px-5 py-4'>Приход</th>
          <th className='px-5 py-4'>Уход</th>
          <th className='px-5 py-4'>Опоздание</th>
          <th className='px-5 py-4'>Ранний уход</th>
          <th className='px-5 py-4'>Отработано</th>
          <th className='px-5 py-4'>Статус</th>
          <th className='px-5 py-4'>Пометка из графика</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className='border-t border-border/70'>
            <td className='px-5 py-4 text-slate-700'>{row.date}</td>
            <td className='px-5 py-4 text-slate-700'>{row.dayOfWeek}</td>
            <td className='px-5 py-4 font-semibold text-slate-900'>{row.employee}</td>
            <td className='px-5 py-4'><Badge className={plannedWorkClass(row.plannedWork)}>{plannedWorkLabel(row.plannedWork, row.hasSchedule)}</Badge></td>
            <td className='px-5 py-4 text-slate-700'>{row.fact}</td>
            <td className='px-5 py-4 text-slate-700'>{row.arrival}</td>
            <td className='px-5 py-4 text-slate-700'>{row.departure}</td>
            <td className='px-5 py-4 text-slate-700'>{row.lateMinutes ? `${row.lateMinutes} мин` : '-'}</td>
            <td className='px-5 py-4 text-slate-700'>{row.earlyLeaveMinutes ? `${row.earlyLeaveMinutes} мин` : '-'}</td>
            <td className='px-5 py-4 text-slate-700'>{formatDuration(row.workedMinutes)}</td>
            <td className='px-5 py-4'><Badge className={planFactStatusClass(row.status)}>{row.status}</Badge></td>
            <td className='px-5 py-4 text-slate-600'>{row.scheduleNote || '-'}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function DailyTable({ rows }: { rows: DailySummary[] }) {
  return (
    <Table>
      <thead className='bg-slate-50 text-slate-500'>
        <tr className='text-left'>
          <th className='px-5 py-4'>Дата</th>
          <th className='px-5 py-4'>Сотрудник</th>
          <th className='px-5 py-4'>Смена</th>
          <th className='px-5 py-4'>Приход</th>
          <th className='px-5 py-4'>Уход</th>
          <th className='px-5 py-4'>Опоздание</th>
          <th className='px-5 py-4'>Ранний уход</th>
          <th className='px-5 py-4'>Отработано</th>
          <th className='px-5 py-4'>Статус</th>
          <th className='px-5 py-4'>Комментарий</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className='border-t border-border/70'>
            <td className='px-5 py-4 text-slate-700'>{row.date}</td>
            <td className='px-5 py-4 font-semibold text-slate-900'>{row.employee}</td>
            <td className='px-5 py-4 text-slate-700'>{row.shift}</td>
            <td className='px-5 py-4 text-slate-700'>{row.arrival}</td>
            <td className='px-5 py-4 text-slate-700'>{row.departure}</td>
            <td className='px-5 py-4 text-slate-700'>{row.lateMinutes ? `${row.lateMinutes} мин` : '-'}</td>
            <td className='px-5 py-4 text-slate-700'>{row.earlyLeaveMinutes ? `${row.earlyLeaveMinutes} мин` : '-'}</td>
            <td className='px-5 py-4 text-slate-700'>{formatDuration(row.workedMinutes)}</td>
            <td className='px-5 py-4'><Badge className={statusClass(row.status)}>{row.status}</Badge></td>
            <td className='px-5 py-4 text-slate-600'>{row.comment || '-'}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default async function AdminAttendancePage({ searchParams }: { searchParams: SearchParams }) {
  let data;
  let error = '';
  let scheduleData;
  let scheduleError = '';

  try {
    data = await getAttendanceRows();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : 'Не удалось загрузить Google Sheets.';
    data = {
      mode: 'demo' as const,
      rows: [],
      message: 'Проверьте Google Sheets переменные, доступ service account и лист “Ответы на форму (1)”.',
    };
  }

  try {
    scheduleData = await getScheduleRows();
  } catch (caught) {
    scheduleError = caught instanceof Error ? caught.message : 'Не удалось загрузить график работы из Google Sheets.';
    scheduleData = {
      mode: 'not-configured' as const,
      rows: [],
      message: 'Проверьте GOOGLE_SHEETS_SCHEDULE_SPREADSHEET_ID, доступ service account и лист “График работы”.',
    };
  }

  const normalizedRows = normalizeRows(data.rows);
  const allSummaries = buildDailySummaries(normalizedRows);
  const normalizedScheduleRows = normalizeScheduleRows(scheduleData.rows);
  const allPlanFactRows = buildPlanFactRows(normalizedScheduleRows, allSummaries);
  const filters = {
    month: searchParams.month || ALL,
    employee: searchParams.employee || ALL,
    status: searchParams.status || ALL,
  };
  const months = Array.from(new Set([...normalizedRows.map((row) => row.monthKey), ...normalizedScheduleRows.map((row) => row.monthKey)].filter(Boolean))).sort().reverse();
  const employees = Array.from(new Set([...normalizedRows.map((row) => row.employee), ...normalizedScheduleRows.map((row) => row.employee)].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru'));
  const statuses = Array.from(new Set([...allSummaries.map((row) => row.status), ...allPlanFactRows.map((row) => row.status)])).sort();
  const { filteredRows, filteredSummaries } = applyFilters(normalizedRows, allSummaries, filters);
  const filteredPlanFactRows = applyPlanFactFilters(allPlanFactRows, filters);
  const formStats = summaryStats(filteredRows, filteredSummaries);
  const stats = scheduleData.mode === 'google-sheets' ? planStats(filteredPlanFactRows) : formStats;
  const employeeSummaries = buildEmployeeSummaries(filteredSummaries);
  const planEmployeeSummaries = buildPlanEmployeeSummaries(filteredPlanFactRows);
  const isDemo = data.mode === 'demo';

  return (
    <AdminShell>
      <div className='mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-slate-900'>Посещаемость</h1>
          <p className='text-sm text-slate-500'>Аналитика по отметкам из Google Sheets: лист “Ответы на форму (1)”, диапазон A:F.</p>
          <p className='mt-1 text-sm text-slate-500'>На текущем этапе явка считается подтверждённой по отметке начала рабочего дня. Отсутствие отметки ухода фиксируется отдельно и не обнуляет явку.</p>
        </div>
        <Badge className={isDemo ? 'bg-slate-100 text-slate-700' : 'bg-green-100 text-green-800'}>
          {isDemo ? 'Demo mode' : 'Google Sheets'}
        </Badge>
      </div>

      <Card className='mb-4 flex gap-3 border-green-100 bg-green-50/60 text-sm text-green-900'>
        {error ? <AlertCircle className='mt-0.5 h-5 w-5 shrink-0 text-amber-700' /> : <CheckCircle2 className='mt-0.5 h-5 w-5 shrink-0 text-green-700' />}
        <div>
          <p className='font-semibold'>{error ? 'Google Sheets пока не подключён' : data.message}</p>
          {error && <p className='mt-1 break-words text-green-800'>{error}</p>}
        </div>
      </Card>

      <FilterBar months={months} employees={employees} statuses={statuses} filters={filters} />

      <section className='mb-6'>
        <h2 className='mb-3 text-lg font-bold text-slate-900'>{scheduleData.mode === 'google-sheets' ? 'Главная сводка за период' : 'Краткая сводка по отметкам'}</h2>
        {data.mode === 'demo' && scheduleData.mode === 'google-sheets' && (
          <Card className='mb-3 border-amber-100 bg-amber-50/70 text-sm text-amber-900'>
            Фактические отметки не подключены. Плановые дни показаны из графика, факт считается как отсутствие отметок.
          </Card>
        )}
        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
          {stats.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className='flex items-center gap-4'>
                <div className='flex h-11 w-11 items-center justify-center rounded-lg bg-green-100 text-green-700'>
                  <Icon className='h-5 w-5' />
                </div>
                <div>
                  <p className='text-sm font-semibold text-slate-500'>{item.label}</p>
                  <p className='mt-1 text-xl font-bold text-slate-950'>{item.value}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <Card className='mb-6 p-0'>
        <div className='border-b border-border/80 px-5 py-4'>
          <h2 className='font-semibold text-slate-900'>Итоги по сотрудникам</h2>
          <p className='text-sm text-slate-500'>
            {scheduleData.mode === 'google-sheets'
              ? 'Главный отчёт по выбранному месяцу и текущим фильтрам: явка считается по приходу, полный день и отсутствие ухода контролируются отдельно.'
              : 'График не подключён, поэтому показаны итоги только по фактическим отметкам Google Form.'}
          </p>
        </div>
        {scheduleData.mode === 'google-sheets'
          ? (planEmployeeSummaries.length ? <PlanEmployeeTotalsTable rows={planEmployeeSummaries} /> : <div className='p-6 text-sm text-slate-500'>Нет сотрудников по выбранным фильтрам.</div>)
          : (employeeSummaries.length ? <EmployeeTotalsTable rows={employeeSummaries} /> : <div className='p-6 text-sm text-slate-500'>Нет сотрудников по выбранным фильтрам.</div>)}
      </Card>

      <Card className='mb-6 p-0'>
        <div className='flex flex-col gap-2 border-b border-border/80 px-5 py-4 md:flex-row md:items-start md:justify-between'>
          <div>
            <h2 className='font-semibold text-slate-900'>План/факт по дням</h2>
            <p className='text-sm text-slate-500'>График читается по цвету ячейки на листе “График работы”: зелёный — работает, красный — не работает.</p>
            <p className='mt-1 text-sm text-slate-500'>Буквы и ручные пометки в ячейках сохраняются только как комментарий.</p>
          </div>
          <Badge className={scheduleData.mode === 'google-sheets' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}>
            {scheduleData.mode === 'google-sheets' ? 'График подключён' : 'График не подключён'}
          </Badge>
        </div>
        {(scheduleError || scheduleData.mode !== 'google-sheets') && (
          <div className='border-b border-border/80 px-5 py-3 text-sm text-amber-800'>
            {scheduleError || scheduleData.message}
          </div>
        )}
        {scheduleData.mode === 'google-sheets'
          ? (filteredPlanFactRows.length ? <PlanFactTable rows={filteredPlanFactRows} /> : <div className='p-6 text-sm text-slate-500'>Нет строк графика по выбранным фильтрам.</div>)
          : <div className='p-6 text-sm text-slate-500'>График не подключён. План/факт по дням появится после подключения GOOGLE_SHEETS_SCHEDULE_SPREADSHEET_ID.</div>}
      </Card>

      <Card className='mb-6 p-0'>
        <div className='border-b border-border/80 px-5 py-4'>
          <h2 className='font-semibold text-slate-900'>Сводка только по отметкам</h2>
          <p className='text-sm text-slate-500'>Проверочная группировка Google Form без учёта графика.</p>
        </div>
        {filteredSummaries.length ? <DailyTable rows={filteredSummaries} /> : <div className='p-6 text-sm text-slate-500'>Нет данных по выбранным фильтрам.</div>}
      </Card>

      <Card className='p-0'>
        <div className='border-b border-border/80 px-5 py-4'>
          <h2 className='font-semibold text-slate-900'>Журнал отметок</h2>
          <p className='text-sm text-slate-500'>Сырые отметки из формы Google Sheets.</p>
        </div>
        {filteredRows.length ? <RawTable rows={filteredRows} /> : <div className='p-6 text-sm text-slate-500'>Нет отметок по выбранным фильтрам.</div>}
      </Card>
    </AdminShell>
  );
}
