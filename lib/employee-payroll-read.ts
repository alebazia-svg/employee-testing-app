/** Private response boundary. Never serialize a payroll database row directly. */
import type { PersonalCurrentPayroll } from './payroll-current-read';
import type { PersonalSettlement } from './employee-payroll-history';
import { roundEmployeeEarnings } from './employee-payroll-estimate';
export type PayrollViewer = { id: number; role: string; isActive: boolean; portalArea: string };
export type PersonalPayrollRow = {
  userId: number | null;
  employeeName?: string;
  grossPay: number;
  advance: number;
  dayPay?: number;
};
export type PersonalPayrollRun = {
  status: string;
  period: { periodKey: string };
  employeeResults: PersonalPayrollRow[];
};
export type EmployeePayrollDependencies = {
  currentPeriod: () => string;
  findFinal: (period: string, userId: number) => Promise<PersonalPayrollRun | null>;
  findCurrent?: (period: string, userId: number) => Promise<PersonalCurrentPayroll | null>;
  findSettlement?: (period: string, userId: number) => Promise<PersonalSettlement | null>;
};

export async function readEmployeePayroll(
  viewer: PayrollViewer | null,
  query: URLSearchParams,
  dependencies: EmployeePayrollDependencies,
) {
  if (!viewer) return { status: 401, body: { error: 'Войдите в приложение.' } };
  if (!viewer.isActive || viewer.role !== 'EMPLOYEE' || viewer.portalArea !== 'WORKDAY') {
    return { status: 403, body: { error: 'Личный расчёт недоступен.' } };
  }
  // Do not accept employee IDs/names, even when they happen to match the viewer.
  if ([...query.keys()].some(key => key !== 'month') || query.getAll('month').length > 1) {
    return { status: 400, body: { error: 'Некорректный запрос.' } };
  }
  const current = dependencies.currentPeriod();
  const period = query.get('month') ?? current;
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period) || period > current) {
    return { status: 400, body: { error: 'Выберите текущий или прошедший месяц.' } };
  }
  try {
    const run = await dependencies.findFinal(period, viewer.id);
    const unavailable = { status: 200, body: { month: period, state: 'unavailable' as const } };
    if (!run) {
      if (period !== current || !dependencies.findCurrent) return unavailable;
      const daily = await dependencies.findCurrent(period, viewer.id);
      if (!daily || daily.userId !== viewer.id || daily.periodKey !== period || !Number.isFinite(daily.grossPay)
        || !/^\d{4}-\d{2}-\d{2}$/.test(daily.verifiedThrough) || !daily.verifiedThrough.startsWith(period + '-')) return unavailable;
      const estimate = roundEmployeeEarnings(daily.earnings);
      if (!estimate) return unavailable;
      return { status: 200, body: { month: period, state: 'current_estimate' as const,
        ...estimate,
        ...(daily.daysUnmarked ? { daysUnmarked: true } : {}),
        verifiedThrough: daily.verifiedThrough,
        ...(daily.sourceFallback ? { sourceFallback: true } : {}),
        // No zero or browser-local advance can masquerade as a verified payment.
        savedAdvance: daily.advance !== undefined && daily.advance !== null && Number.isFinite(daily.advance) && daily.advance >= 0 ? daily.advance : null,
      } };
    }
    if (run.status !== 'FINAL' || run.period.periodKey !== period) return unavailable;
    // Stable user ID only. Reused trainee aliases and similar names grant no access.
    const rows = run.employeeResults.filter(row => row.userId === viewer.id);
    if (rows.length !== 1) return unavailable;
    const row = rows[0];
    if (![row.grossPay, row.advance].every(Number.isFinite) || row.advance < 0) return unavailable;
    const settlement = await dependencies.findSettlement?.(period, viewer.id);
    if (!settlement || !Number.isFinite(settlement.accrued) || settlement.accrued < 0) return unavailable;
    const verifiedPayments = settlement.paid !== null && settlement.remaining !== null
      && [settlement.paid, settlement.remaining].every(value => Number.isFinite(value) && value >= 0)
      && Number.isFinite(settlement.creditedFromEarlier ?? 0) && (settlement.creditedFromEarlier ?? 0) >= 0
      && Math.round((settlement.paid + settlement.remaining + (settlement.creditedFromEarlier ?? 0)) * 100) === Math.round(settlement.accrued * 100);
    return { status: 200, body: {
      month: period,
      state: 'confirmed' as const,
      accrued: settlement.accrued,
      paid: verifiedPayments ? settlement.paid : null,
      remaining: verifiedPayments ? settlement.remaining : null,
      ...(verifiedPayments && settlement.creditedFromEarlier ? { creditedFromEarlier: settlement.creditedFromEarlier } : {}),
      ...(settlement.sourceFallback ? { sourceFallback: true, checkedAt: settlement.checkedAt } : {}),
    } };
  } catch {
    return { status: 503, body: { error: 'Расчёт временно недоступен. Попробуйте позже.' } };
  }
}
