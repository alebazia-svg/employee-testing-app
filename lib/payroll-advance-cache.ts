import type { PayrollAdvanceRead } from './payroll-one-c-advances';

// Shared per process/period, never per employee. Cache failures as well as
// successes so repeated opens/retries cannot hammer an unavailable 1C server.
export function createPayrollAdvanceCache(
  load: (period: string, dateFrom: string, dateTo: string) => Promise<PayrollAdvanceRead>,
  now: () => number = Date.now,
) {
  const entries = new Map<string, { expires: number; task: Promise<PayrollAdvanceRead | null> }>();
  return async (period: string): Promise<PayrollAdvanceRead | null> => {
    const time = now();
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date(time));
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period) || period !== today.slice(0, 7)) return null;
    const key = `${period}:${today}`;
    const saved = entries.get(key);
    if (saved && time < saved.expires) return saved.task;
    // Deferred load also coalesces simultaneous requests before I/O starts.
    const task = Promise.resolve().then(() => load(period, `${period}-01`, today)).catch(() => null);
    if (entries.size >= 24) entries.delete(entries.keys().next().value!);
    entries.set(key, { expires: time + 300_000, task });
    return task;
  };
}
