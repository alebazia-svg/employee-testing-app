export const payrollRunStatuses = ['DRAFT', 'CHECKED', 'FINAL', 'SUPERSEDED'] as const;

export type PayrollRunStatus = (typeof payrollRunStatuses)[number];

export function isPayrollRunStatus(value: unknown): value is PayrollRunStatus {
  return typeof value === 'string' && payrollRunStatuses.includes(value as PayrollRunStatus);
}

export function isAllowedPayrollRunTransition(currentStatus: string, nextStatus: PayrollRunStatus) {
  if (currentStatus === nextStatus) return true;
  if (currentStatus === 'DRAFT' && (nextStatus === 'CHECKED' || nextStatus === 'FINAL')) return true;
  if (currentStatus === 'CHECKED' && nextStatus === 'FINAL') return true;
  return false;
}

export function canReplacePayrollFinal(currentStatus: string) {
  return currentStatus === 'DRAFT' || currentStatus === 'CHECKED';
}
