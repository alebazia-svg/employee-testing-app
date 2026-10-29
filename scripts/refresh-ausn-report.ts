import { requestAusnRefresh } from '../lib/ausn-processing';
import { loadPortalReports } from '../lib/ausn-portal-view';

// Hourly in working hours: refresh only when the newest valid report is older than
// 20 hours, so a temporary outage of the Platforma OFD tunnel (it runs from the
// owner's Mac) is retried within the hour instead of leaving figures stale for days.
const force = process.argv.includes('--force');
const reports = await loadPortalReports();
const newest = reports.filter((report) => report.available).map((report) => Date.parse(report.runTimeUtc!)).sort((a, b) => b - a)[0];
const ageHours = newest ? (Date.now() - newest) / 3_600_000 : Infinity;
if (!force && ageHours < 20) {
  console.log(JSON.stringify({ at: new Date().toISOString(), status: 'fresh', ageHours: Math.round(ageHours * 10) / 10 }));
} else {
  const result = await requestAusnRefresh();
  console.log(JSON.stringify({ at: new Date().toISOString(), status: result.status, message: result.message }));
  if (result.status !== 'completed') process.exitCode = 1;
}
