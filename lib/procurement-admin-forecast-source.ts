import 'server-only';
import { loadProcurementForecastHistory } from './procurement-forecast-history';
import { loadOwnerCashForecastShadow } from './procurement-cash-forecast-loader';
import { fetchPayrollForecastEvidence } from './procurement-payroll-one-c';
import { fetchTBankOwnerTransferControl } from './tbank-owner-transfer-one-c';
import { fetchProcurementPriorityDebts } from './procurement-cash-forecast-settlements';
import type { AdminForecastSources } from './procurement-admin-forecast';

// Only in-flight deduplication. Completed/error results are never cached as fresh.
const pending = new Map<string, Promise<AdminForecastSources>>();
export function loadAdminForecastSources(asOf: string): Promise<AdminForecastSources> {
  const current = pending.get(asOf);
  if (current) return current;
  const read = Promise.allSettled([
    loadProcurementForecastHistory(), loadOwnerCashForecastShadow(asOf),
    fetchPayrollForecastEvidence(asOf), fetchTBankOwnerTransferControl(asOf),
    fetchProcurementPriorityDebts(asOf),
  ]).then(([history,owner,payroll,tbank,debts]) => ({
    asOf,
    history: history.status === 'fulfilled' ? history.value : null,
    owner: owner.status === 'fulfilled' ? owner.value : null,
    payroll: payroll.status === 'fulfilled' ? payroll.value : null,
    tbank: tbank.status === 'fulfilled' ? tbank.value : null,
    debts: debts.status === 'fulfilled' ? debts.value : null,
  })).finally(() => pending.delete(asOf));
  pending.set(asOf, read);
  return read;
}
