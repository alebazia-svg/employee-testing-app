/** Calendar selection is independent of the payment schedule for the prior month. */
export function currentPayrollWorkspacePeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit' }).formatToParts(now);
  return { year: parts.find(p => p.type === 'year')!.value, month: String(Number(parts.find(p => p.type === 'month')!.value) - 1) };
}
export function matchingFinalPayrollRun<T extends { id: number; status: string; period: { periodKey: string } }>(run: T | null | undefined, periodKey: string, finalId: number | undefined): T | null {
  return run?.status === 'FINAL' && run.id === finalId && run.period.periodKey === periodKey ? run : null;
}
