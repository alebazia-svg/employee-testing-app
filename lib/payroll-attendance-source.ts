import type { AttendanceRow } from '@/lib/google-sheets';
import type { PayrollAttendanceSourceSummary } from '@/lib/payroll-attendance-snapshot';
import { buildFormSummaries } from '@/lib/payroll-attendance-summary';
import { getMoscowDateKey, getMoscowMinutes } from '@/lib/workday';

// Owner-approved pilot cutover. Other employees remain on their current source.
export const PAYROLL_APP_ATTENDANCE_CUTOVERS = [{
  userId: 8,
  employee: 'Хурзокова Лиана',
  aliases: ['Хурзокова Лиана', 'Лиана', 'Ляна'],
  fromDate: '2026-10-18',
}] as const;

type Cutover = {
  userId: number;
  employee: string;
  aliases: readonly string[];
  fromDate: string;
};

type AppUser = {
  id: number;
  name: string;
  payrollName: string | null;
  workDays: { userId: number; date: string; startedAt: Date; status: string }[];
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

function googleDate(row: AttendanceRow) {
  const value = row.timestamp || `${row.date} ${row.time}`;
  const ru = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s|$)/);
  if (ru) return `${ru[3]}-${ru[2].padStart(2, '0')}-${ru[1].padStart(2, '0')}`;
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})(?:T|\s|$)/);
  return iso?.[1] ?? null;
}

export function mergePayrollAttendanceSources(input: {
  googleRows: AttendanceRow[];
  appUsers: AppUser[];
  periodKey: string;
  throughDate: string;
  cutovers?: readonly Cutover[];
}) {
  let formSummaries = buildFormSummaries(input.googleRows, input.periodKey);
  const sources: PayrollAttendanceSourceSummary[] = [];

  for (const rule of input.cutovers ?? PAYROLL_APP_ATTENDANCE_CUTOVERS) {
    if (rule.fromDate > input.throughDate || rule.fromDate.slice(0, 7) > input.periodKey) continue;
    const user = input.appUsers.find((item) => item.id === rule.userId);
    if (!user || normalize(user.payrollName || user.name) !== normalize(rule.employee)) {
      throw new Error('Не удалось подтвердить сотрудника для учёта дней из приложения.');
    }
    const aliases = new Set(rule.aliases.map(normalize));
    const ownRows = input.googleRows.filter((row) => aliases.has(normalize(row.employee)));
    const periodRows = ownRows.filter((row) => {
      const date = googleDate(row);
      if (!date) throw new Error('Не удалось определить дату резервной отметки сотрудника.');
      return date.slice(0, 7) === input.periodKey && date <= input.throughDate;
    }).map((row) => ({ ...row, employee: rule.employee }));
    const appDays = new Map<string, AppUser['workDays'][number]>();
    for (const day of user.workDays) {
      if (day.date < rule.fromDate || day.date.slice(0, 7) !== input.periodKey || day.date > input.throughDate) continue;
      if (day.userId !== rule.userId || !['active', 'completed'].includes(day.status)
        || !Number.isFinite(day.startedAt.getTime()) || getMoscowDateKey(day.startedAt) !== day.date
        || appDays.has(day.date)) {
        throw new Error('Проверьте даты и состояние рабочих дней сотрудника в приложении.');
      }
      appDays.set(day.date, day);
    }
    const googleDates = new Set(periodRows.map((row) => googleDate(row)!));
    const keptGoogleRows = periodRows.filter((row) => !appDays.has(googleDate(row)!));
    const appRows: AttendanceRow[] = [...appDays].map(([date, day]) => {
      const minutes = getMoscowMinutes(day.startedAt);
      const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      return {
        employee: rule.employee, date,
        timestamp: `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)} ${time}:00`,
        // No shift/late minutes from PWA: its timing remains outside payroll penalties.
        time, action: 'Начало рабочего дня', shift: '', comment: '',
      };
    });
    const merged = buildFormSummaries([...keptGoogleRows, ...appRows], input.periodKey)[0] ?? {
      employee: rule.employee, formRows: 0, uniqueFormDates: 0, workedDays: 0, lateCount: 0,
    };
    // The approved change concerns day sourcing only; retain the existing Google lateness rule.
    merged.lateCount = buildFormSummaries(periodRows, input.periodKey)[0]?.lateCount ?? 0;
    formSummaries = formSummaries.filter((row) => !aliases.has(normalize(row.employee)));
    formSummaries.push(merged);
    sources.push({
      employee: rule.employee,
      userId: rule.userId,
      fromDate: rule.fromDate,
      appDates: [...appDays.keys()].sort(),
      googleFallbackDates: [...googleDates].filter((date) => date >= rule.fromDate && !appDays.has(date)).sort(),
      overlapDates: [...appDays.keys()].filter((date) => googleDates.has(date)).sort(),
    });
  }

  return { formSummaries: formSummaries.sort((a, b) => a.employee.localeCompare(b.employee, 'ru')), sources };
}
