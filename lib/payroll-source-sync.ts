export type PayrollSyncPeriod = { periodKey: string; year: number; monthIndex: number };
type SourceResponse = { ok?: boolean; snapshot?: { servedFrom?: string; refreshError?: string }; period?: { verifiedThrough?: string } };
export type PayrollSyncDependencies = {
  eligible: (period: PayrollSyncPeriod) => Promise<boolean>;
  sales: (request: Request) => Promise<Response>;
  attendance: (request: Request) => Promise<Response>;
};

export function payrollSyncPeriods(now: Date): PayrollSyncPeriod[] {
  const current = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit' }).format(now);
  const [year, month] = current.split('-').map(Number);
  return [0, -1].map(offset => {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    const y = date.getUTCFullYear(), m = date.getUTCMonth();
    return { periodKey: `${y}-${String(m + 1).padStart(2, '0')}`, year: y, monthIndex: m };
  });
}

/** No payroll runs, drafts, rules or 1C documents are created by this job. */
export async function syncPayrollSources(now: Date, dependencies: PayrollSyncDependencies) {
  const results: Array<{ period: string; state: 'skipped' | 'updated' | 'incomplete'; sales?: boolean; attendance?: boolean; verifiedThrough?: string }> = [];
  for (const period of payrollSyncPeriods(now)) {
    if (!await dependencies.eligible(period)) {
      results.push({ period: period.periodKey, state: 'skipped' });
      continue;
    }
    const request = () => new Request(`http://payroll.internal/source?year=${period.year}&month=${period.monthIndex}`);
    const read = async (source: (r: Request) => Promise<Response>) => {
      try {
        const response = await source(request());
        const body = await response.json() as SourceResponse;
        return { ready: response.ok && body.ok !== false && !body.snapshot?.refreshError && !!body.snapshot,
          through: body.period?.verifiedThrough };
      } catch { return { ready: false, through: undefined }; }
    };
    // Independent adapters retain their own last-good snapshots on failure.
    const sales = await read(dependencies.sales);
    const attendance = await read(dependencies.attendance);
    results.push({ period: period.periodKey, state: sales.ready && attendance.ready ? 'updated' : 'incomplete',
      sales: sales.ready, attendance: attendance.ready,
      ...(sales.ready && sales.through ? { verifiedThrough: sales.through } : {}) });
  }
  return results;
}
