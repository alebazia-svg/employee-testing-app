/** A final approval is not a prerequisite for reading a past working period. */
export function isPayrollPeriodAvailable(periodKey: string, currentPeriodKey: string): boolean {
  const valid = /^20\d{2}-(0[1-9]|1[0-2])$/;
  return valid.test(periodKey) && valid.test(currentPeriodKey) && periodKey <= currentPeriodKey;
}
