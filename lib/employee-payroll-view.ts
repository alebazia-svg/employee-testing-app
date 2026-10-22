import type { EmployeeEarning } from './employee-payroll-estimate';

export type EmployeePayrollView = { month: string; state: 'unavailable' | 'current_estimate' | 'confirmed'; estimatedAccrued?: number; earnings?: EmployeeEarning[]; savedAdvance?: number | null; verifiedThrough?: string; accrued?: number; paid?: number | null; remaining?: number | null };

export function validEmployeePayrollView(value: unknown, month: string): value is EmployeePayrollView {
  if (!value || typeof value !== 'object') return false;
  const row = value as EmployeePayrollView;
  const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
  if (row.month !== month) return false;
  if (row.state === 'unavailable') return true;
  if (row.state === 'current_estimate') return finite(row.estimatedAccrued) && Array.isArray(row.earnings)
    && row.earnings.every(item => item && typeof item.label === 'string' && finite(item.amount))
    && row.earnings.reduce((sum, item) => sum + item.amount, 0) === row.estimatedAccrued
    && (row.savedAdvance == null || amount(row.savedAdvance));
  return row.state === 'confirmed' && amount(row.accrued)
    && ((row.paid == null && row.remaining == null) || amount(row.paid) && amount(row.remaining)
      && Math.round((row.paid! + row.remaining!) * 100) === Math.round(row.accrued! * 100));
}

export function employeePayrollMonthAt(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit' }).format(now);
}
export function employeePayrollMonths(current: string) {
  const previous = new Date(`${current}-01T12:00:00Z`);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  return [current, previous.toISOString().slice(0, 7)];
}
// One sleeping timer, bounded below the browser's maximum timeout. No polling
// requests; rollover is also rechecked on foreground/focus.
export function employeePayrollMonthDelay(now = new Date()) {
  const month = employeePayrollMonthAt(now);
  const next = new Date(`${month}-01T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const boundary = Date.parse(`${next.toISOString().slice(0, 7)}-01T00:00:00+03:00`);
  return Math.max(1, Math.min(86400000, boundary - now.getTime()));
}

/** Two visible months only; unavailable evidence invalidates a former result. */
export function rememberEmployeePayroll(previous: ReadonlyMap<string, EmployeePayrollView>, value: EmployeePayrollView, months: readonly string[]) {
  const visible = months.slice(0, 2);
  const next = new Map([...previous].filter(([month]) => visible.includes(month)));
  if (visible.includes(value.month) && value.state !== 'unavailable') next.set(value.month, value);
  else next.delete(value.month);
  return next;
}
