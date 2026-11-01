import type { PayrollAttendanceFormSummary, PayrollAttendanceSourceSummary } from './payroll-attendance-snapshot';
import { getMoscowDateKey } from './workday';

export const MUHAMED_DAY_NAME = 'Кумыков Мухаммед';
export const MUHAMED_DAY_FROM = '2026-11-01';
// Owner confirmed this actual exit on November 1, before the employee's first QR.
// This is payroll evidence, never a fabricated WorkDayEntry or QR timestamp.
export const MUHAMED_OWNER_CONFIRMED_DATES = ['2026-11-01'] as const;
type User = {
  id: number; name: string; payrollName: string | null; role: string; department: string; isActive: boolean; portalArea: string;
  workDays: { userId: number; date: string; startedAt: Date; qrAcceptedAt: Date | null; status: string }[];
};
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
  && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;

/** No calendar/Google fallback and no assumed monthly norm. Failures retain the previous snapshot. */
export function mergeMuhamedPayrollDays(input: {
  periodKey: string; throughDate: string; appUsers: User[];
  formSummaries: PayrollAttendanceFormSummary[]; sources: PayrollAttendanceSourceSummary[];
}) {
  if (input.periodKey < '2026-11') return { formSummaries: input.formSummaries, sources: input.sources };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.periodKey) || !validDate(input.throughDate)) throw Error('Некорректный период выходов Мухамеда.');
  const users = input.appUsers.filter(user => [MUHAMED_DAY_NAME, 'Кумыков Мухамед'].includes(user.payrollName?.trim() || user.name.trim()));
  if (input.appUsers.length !== 1 || users.length !== 1 || users[0].role !== 'EMPLOYEE' || !users[0].isActive
    || users[0].department !== 'procurement' || users[0].portalArea !== 'WORKDAY') throw Error('Не удалось однозначно подтвердить Мухамеда для учёта выходов.');
  const user = users[0], appDates = new Set<string>();
  for (const day of user.workDays) {
    if (!day.date.startsWith(input.periodKey + '-') || day.date < MUHAMED_DAY_FROM || day.date > input.throughDate) continue;
    // Failed/cancelled starts are not paid; a valid open shift is a real start.
    if (!['active', 'completed', 'missing_checkout'].includes(day.status)) continue;
    if (day.userId !== user.id || !validDate(day.date) || !Number.isFinite(day.startedAt.getTime())
      || getMoscowDateKey(day.startedAt) !== day.date || !day.qrAcceptedAt
      || !Number.isFinite(day.qrAcceptedAt.getTime()) || getMoscowDateKey(day.qrAcceptedAt) !== day.date
      || appDates.has(day.date)) throw Error('Проверьте QR-отметки Мухамеда.');
    appDates.add(day.date);
  }
  const ownerConfirmedDates = MUHAMED_OWNER_CONFIRMED_DATES.filter(date => date.startsWith(input.periodKey + '-') && date <= input.throughDate);
  const count = new Set([...appDates, ...ownerConfirmedDates]).size;
  const source: PayrollAttendanceSourceSummary = { employee: MUHAMED_DAY_NAME, userId: user.id, fromDate: MUHAMED_DAY_FROM,
    appDates: [...appDates].sort(), googleFallbackDates: [], overlapDates: [], ownerConfirmedDates: [...ownerConfirmedDates] };
  return {
    formSummaries: [...input.formSummaries.filter(row => ![MUHAMED_DAY_NAME, 'Кумыков Мухамед'].includes(row.employee)),
      { employee: MUHAMED_DAY_NAME, formRows: count, uniqueFormDates: count, workedDays: count, lateCount: 0 }]
      .sort((a,b) => a.employee.localeCompare(b.employee, 'ru')),
    sources: [...input.sources.filter(row => row.employee !== MUHAMED_DAY_NAME), source],
  };
}
