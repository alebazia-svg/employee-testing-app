import { requestAusnRefresh } from '../lib/ausn-processing';
import { loadPortalReports } from '../lib/ausn-portal-view';
import { ausnRefreshState } from '../lib/ausn-refresh-policy';

// Hourly in working hours: refresh only when the newest valid report is older than
// 20 hours, so a temporary outage of the Platforma OFD tunnel (it runs from the
// owner's Mac) is retried within the hour instead of leaving figures stale for days.
// No top-level await: production scripts run through tsx in CommonJS mode.
async function main() {
  const force = process.argv.includes('--force');
  const reports = await loadPortalReports();
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
