import { getAttendanceRows, getScheduleRows, type AttendanceRow, type ScheduleRow } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

type ParsedMark = AttendanceRow & {
  dateKey: string;
  monthKey: string;
  minutesOfDay: number | null;
};

type DailySummary = {
  employee: string;
  dateKey: string;
  arrival: string;
  lateMinutes: number;
};

type ParsedScheduleRow = ScheduleRow & {
  dateKey: string;
  monthKey: string;
};

function normalizeEmployeeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
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

function minutesOfDay(date: Date | null) {
  if (!date) return null;
  return date.getHours() * 60 + date.getMinutes();
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

  return Array.from(grouped.values()).map((group) => {
    const shift = group.find((row) => row.shift?.trim())?.shift || '';
    const parsedShift = parseShift(shift);
    const arrivals = group.filter((row) => getActionKind(row.action) === 'arrival' && row.minutesOfDay !== null);
    const arrival = arrivals.length ? Math.min(...arrivals.map((row) => row.minutesOfDay!)) : null;
    const lateMinutes = parsedShift && arrival !== null ? Math.max(arrival - parsedShift.start, 0) : 0;

    return {
      employee: group[0]?.employee || '-',
      dateKey: group[0]?.dateKey || '-',
      arrival: arrival === null ? '-' : `${pad(Math.floor(arrival / 60))}:${pad(arrival % 60)}`,
      lateMinutes,
    } satisfies DailySummary;
  });
}

function buildFormSummaries(rows: AttendanceRow[], periodKey: string) {
  const periodRows = normalizeRows(rows).filter((row) => row.monthKey === periodKey);
  const dailySummaries = buildDailySummaries(periodRows);
  const groupedMarks = new Map<string, ParsedMark[]>();
  const groupedDays = new Map<string, DailySummary[]>();

  for (const row of periodRows) {
    const key = normalizeEmployeeName(row.employee);
    groupedMarks.set(key, [...(groupedMarks.get(key) ?? []), row]);
  }

  for (const summary of dailySummaries) {
    const key = normalizeEmployeeName(summary.employee);
    groupedDays.set(key, [...(groupedDays.get(key) ?? []), summary]);
  }

  return Array.from(new Set([...groupedMarks.keys(), ...groupedDays.keys()]))
    .map((key) => {
      const marks = groupedMarks.get(key) ?? [];
      const days = groupedDays.get(key) ?? [];
      const employee = marks[0]?.employee ?? days[0]?.employee ?? '-';

      return {
        employee,
        formRows: marks.length,
        uniqueFormDates: new Set(marks.map((row) => row.dateKey)).size,
        workedDays: days.filter((summary) => summary.arrival !== '-').length,
        lateCount: days.filter((summary) => summary.lateMinutes > 0).length,
      };
    })
    .sort((a, b) => a.employee.localeCompare(b.employee, 'ru'));
}

function buildScheduleSummaries(rows: ScheduleRow[], periodKey: string) {
  const grouped = new Map<string, ParsedScheduleRow[]>();

  for (const row of normalizeScheduleRows(rows).filter((item) => item.monthKey === periodKey && item.plannedWork === true)) {
    const key = normalizeEmployeeName(row.employee);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return Array.from(grouped.values())
    .map((items) => ({
      employee: items[0]?.employee ?? '-',
      scheduleDays: new Set(items.map((item) => item.dateKey)).size,
    }))
    .sort((a, b) => a.employee.localeCompare(b.employee, 'ru'));
}

function getPeriod(searchParams: URLSearchParams) {
  const monthRaw = searchParams.get('month');
  const yearRaw = searchParams.get('year');
  const monthIndex = monthRaw === null ? NaN : Number(monthRaw);
  const year = yearRaw === null ? NaN : Number(yearRaw);

  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11 || !Number.isInteger(year)) {
    return null;
  }

  return {
    monthIndex,
    year,
    periodKey: `${year}-${pad(monthIndex + 1)}`,
  };
}

export async function GET(request: Request) {
  const period = getPeriod(new URL(request.url).searchParams);

  if (!period) {
    return Response.json(
      {
        error: 'Не выбран период для предпросмотра посещаемости.',
      },
      { status: 400 },
    );
  }

  try {
    const [attendanceData, scheduleData] = await Promise.all([getAttendanceRows(), getScheduleRows()]);

    return Response.json({
      period,
      attendanceMode: attendanceData.mode,
      attendanceMessage: attendanceData.message,
      scheduleMode: scheduleData.mode,
      scheduleMessage: scheduleData.message,
      formSummaries: buildFormSummaries(attendanceData.rows, period.periodKey),
      scheduleSummaries: buildScheduleSummaries(scheduleData.rows, period.periodKey),
    });
  } catch (caught) {
    return Response.json(
      {
        error: caught instanceof Error ? caught.message : 'Не удалось загрузить предпросмотр посещаемости.',
      },
      { status: 500 },
    );
  }
}
