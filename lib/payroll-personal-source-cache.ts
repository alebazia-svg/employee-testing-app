import type { PayrollCashRead } from './payroll-one-c-payments';
import type { PayrollLedgerRead } from './payroll-one-c-ledger';
import { employeePayrollMonthAt, employeePayrollMonths } from './employee-payroll-view';

type Source = { cash: PayrollCashRead; ledger: PayrollLedgerRead };
type Snapshot = { source: Source; sourceFallback: boolean; checkedAt: string };

/** Two shared source months, never a per-employee cache or a browser database.
 * Retain validated evidence on an outage, and throttle retries without hiding
 * the evidence date. Authentication and personal projection remain outside. */
export function createPersonalPayrollSourceCache(load: (period: string, today: string) => Promise<Source>, now = Date.now) {
  const saved = new Map<string, { source: Source; at: number }>();
  const pending = new Map<string, Promise<Snapshot>>();
  const retryAfter = new Map<string, number>();
  const visible = () => employeePayrollMonths(employeePayrollMonthAt(new Date(now())));
  const asSnapshot = (source: Source, fallback: boolean): Snapshot => ({ source, sourceFallback: fallback,
    checkedAt: new Date(Math.min(Date.parse(source.cash.checkedAt), Date.parse(source.ledger.checkedAt))).toISOString() });
  function snapshot(period: string, fallback: boolean): Snapshot | null {
    const entry = saved.get(period);
    if (!entry) return null;
    return asSnapshot(entry.source, fallback);
  }
  return async (period: string, today: string, storedOnly = false): Promise<Snapshot | null> => {
    const months = visible();
    for (const key of saved.keys()) if (!months.includes(key)) saved.delete(key);
    for (const [key, expires] of retryAfter) if (expires <= now() || !months.includes(key.slice(0, 7))) retryAfter.delete(key);
    if (!months.includes(period) || today !== new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date(now()))) return null;
    const entry = saved.get(period);
    const fresh = !!entry && entry.source.cash.dateTo === today && now() - entry.at < 300_000;
    if (storedOnly || fresh) return snapshot(period, !fresh);
    const requestKey = `${period}:${today}`;
    if ((retryAfter.get(requestKey) ?? 0) > now()) {
      const previous = snapshot(period, true);
      if (previous) return previous;
      throw Error('Personal payroll source temporarily unavailable');
    }
    let task = pending.get(requestKey);
    if (!task) {
      task = Promise.resolve().then(async () => {
        try {
          const source = await load(period, today);
          if ([source.cash, source.ledger].some(row => row.dateFrom !== `${period}-01` || row.dateTo !== today
            || !Number.isFinite(Date.parse(row.checkedAt)))) throw Error('Personal payroll source date mismatch');
          if (!visible().includes(period)) throw Error('Personal payroll month expired');
          // A request started yesterday must not overwrite a newer day's read.
          const latest = saved.get(period);
          if (!latest || latest.source.cash.dateTo <= source.cash.dateTo) saved.set(period, { source, at: now() });
          retryAfter.delete(requestKey);
          const actualToday = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date(now()));
          return asSnapshot(source, today !== actualToday);
        } catch (error) {
          if (visible().includes(period)) retryAfter.set(requestKey, now() + 30_000);
          const previous = visible().includes(period) ? snapshot(period, true) : null;
          if (previous) return previous;
          throw error;
        }
      }).finally(() => pending.delete(requestKey));
      pending.set(requestKey, task);
    }
    return task;
  };
}
