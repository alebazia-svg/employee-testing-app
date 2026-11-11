import type { PayrollAttendancePreviewResponse } from './payroll-calculation-engine';
export function purchasePayrollAttendance(periodKey: string, attendance?: PayrollAttendancePreviewResponse | null) {
  if (periodKey < '2026-11') return undefined;
  const missing = { periodKey, workedDays: null };
  if (!attendance || attendance.period.periodKey !== periodKey) return missing;
  const sources = attendance.attendanceSources?.filter(row => row.userId === 10 && row.employee === 'Тохов Астемир');
  const summaries = attendance.formSummaries.filter(row => row.employee === 'Тохов Астемир');
  if (sources?.length !== 1 || summaries.length !== 1) return missing;
  const dates = new Set([...sources[0].appDates, ...sources[0].googleFallbackDates]);
  if ([...dates].some(date => !date.startsWith(periodKey + '-')) || dates.size > 31
    || summaries[0].workedDays !== dates.size || summaries[0].uniqueFormDates !== dates.size) return missing;
  return { periodKey, workedDays: dates.size };
}
