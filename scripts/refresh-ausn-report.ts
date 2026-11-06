import path from 'node:path';
import { prisma } from '../lib/prisma';
import { publishTaxTelegramContext } from '../lib/tax-telegram-context';
import { requestAusnRefresh } from '../lib/ausn-processing';
import { loadPortalReports } from '../lib/ausn-portal-view';
import { ausnRefreshState } from '../lib/ausn-refresh-policy';

// Hourly in working hours: refresh only when the newest valid report is older than
// 20 hours, so a temporary outage of the Platforma OFD tunnel (it runs from the
// owner's Mac) is retried within the hour instead of leaving figures stale for days.
// No top-level await: production scripts run through tsx in CommonJS mode.
async function main() {
  const force = process.argv.includes('--force');
  try {
    const documents = await prisma.taxControlDocument.findMany({ orderBy: { createdAt: 'desc' } });
    const context = await publishTaxTelegramContext(documents, path.join(process.env.AUSN_PORTAL_INTAKE_DIR || '/app/runtime/ausn-intake', 'telegram-management-review.json'));
    if (process.argv.includes('--context-only')) { console.log(JSON.stringify({ status: 'context', ...context })); return; }
  } catch {
    if (process.argv.includes('--context-only')) throw new Error('Telegram documentary context was not synchronized.');
    console.error('Telegram documentary context synchronization failed; ordinary report refresh continues independently.');
  }
  const reports = await loadPortalReports(undefined, { latestPerScope: true });
  const { fresh, ageHours } = ausnRefreshState(reports);
  if (!force && fresh) {
    console.log(JSON.stringify({ at: new Date().toISOString(), status: 'fresh', ageHours: Math.round(ageHours * 10) / 10 }));
    return;
  }
  const result = await requestAusnRefresh({ background: true });
  console.log(JSON.stringify({ at: new Date().toISOString(), status: result.status, message: result.message }));
  if (result.status !== 'completed') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
