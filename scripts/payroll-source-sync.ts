import { prisma } from '../lib/prisma';
import { payrollFeatureState } from '../lib/payroll-features';
import { refreshPayrollOneCControl } from '../lib/payroll-one-c-refresh';
import { refreshPayrollAttendance } from '../lib/payroll-attendance-refresh';
import { withPayrollSourceLock } from '../lib/payroll-source-lock';
import { payrollSyncPeriods, syncPayrollSources } from '../lib/payroll-source-sync';
import { isPayrollSourceSyncEligible } from '../lib/payroll-source-sync-store';

async function main() {
  // Dry-run is deliberately source-free and read-only. No environment switch
  // alone grants permission to persist snapshots from an ad-hoc command.
  const now = new Date();
  if (!process.argv.includes('--confirm-snapshot-write')) {
    console.log(JSON.stringify({ persisted: false, periods: payrollSyncPeriods(now).map(p => p.periodKey) }));
    return;
  }
  if (!payrollFeatureState().draftsEnabled) throw Error('PAYROLL_DRAFTS_DISABLED');
  const results = await withPayrollSourceLock(() => syncPayrollSources(now, {
    eligible: ({ periodKey }) => isPayrollSourceSyncEligible(periodKey),
    sales: refreshPayrollOneCControl,
    attendance: refreshPayrollAttendance,
  }));
  console.log(JSON.stringify({ persisted: results !== null, state: results === null ? 'busy' : 'completed', results }));
  if (results?.some(row => row.state === 'incomplete')) process.exitCode = 1;
}

// Hard process bound also stops a stalled upstream read and releases the DB lock.
const deadline = setTimeout(() => {
  console.error('PAYROLL_SOURCE_SYNC_TIMEOUT');
  process.exit(1);
}, 8 * 60_000);
deadline.unref();
main().catch(() => {
  // No raw source errors, credentials, employees or financial rows in journals.
  console.error('PAYROLL_SOURCE_SYNC_FAILED');
  process.exitCode = 1;
}).finally(async () => { clearTimeout(deadline); await prisma.$disconnect(); });
