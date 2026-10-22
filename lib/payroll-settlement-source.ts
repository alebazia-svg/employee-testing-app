import 'server-only';
import { payrollSettlementWindow } from './payroll-settlement-window';
import { getPayrollOneCBalances, getPayrollOneCCashPayments, getPayrollOneCLedger, getPayrollOneCAdvances } from './payroll-one-c-control-source';
import { createPayrollAdvanceCache } from './payroll-advance-cache';

// Next may load this service through separate route bundles (and reload it in
// development). Keep the bounded cache once per server process, not per bundle.
const processCache = globalThis as typeof globalThis & {
  __moboPayrollAdvanceReadV1?: ReturnType<typeof createPayrollAdvanceCache>;
};
export const readPersonalPayrollAdvances = processCache.__moboPayrollAdvanceReadV1
  ??= createPayrollAdvanceCache(getPayrollOneCAdvances);

type Result = { balance: Awaited<ReturnType<typeof getPayrollOneCBalances>> | null; cash: Awaited<ReturnType<typeof getPayrollOneCCashPayments>>; ledger: Awaited<ReturnType<typeof getPayrollOneCLedger>>; periodKey: string };
const cache = new Map<string, { at: number; value: Result }>();
const pending = new Map<string, Promise<Result>>();

// Shared read-only source, not an employee-to-ADMIN HTTP call. No database writes.
export async function readPayrollSettlementSource(periodKey: string, today: string, refresh = false, includeBalance = true): Promise<Result> {
  const window = payrollSettlementWindow(periodKey, today);
  if (!window) throw Error('Invalid payroll period');
  const key = `${periodKey}:${today}:${includeBalance}`;
  const saved = cache.get(key);
  if (!refresh && saved && Date.now() - saved.at < 300000) return saved.value;
  let task = pending.get(key);
  if (!task) {
    task = (async () => {
      // Private monthly projection does not need the all-period debt report.
      const balance = includeBalance ? await getPayrollOneCBalances(today) : null;
      const cash = await getPayrollOneCCashPayments(window.dateFrom, window.dateTo);
      const ledger = await getPayrollOneCLedger(window.dateFrom, window.dateTo);
      const value = { balance, cash, ledger, periodKey };
      if (cache.size >= 24) cache.delete(cache.keys().next().value!);
      cache.set(key, { at: Date.now(), value });
      return value;
    })().finally(() => pending.delete(key));
    pending.set(key, task);
  }
  return task;
}
