import { requestAusnRefresh } from '../lib/ausn-processing';

// Daily job: keeps the taxes page and the limit notifications on fresh figures
// even when nobody uploads a document. Exits non-zero so the timer logs a failure.
const result = await requestAusnRefresh();
console.log(JSON.stringify({ at: new Date().toISOString(), status: result.status, message: result.message }));
if (result.status !== 'completed') process.exitCode = 1;
