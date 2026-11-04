import 'server-only';
import {recheckOpenKkmShiftCloseIssues} from './kkm-shift-close-control';
import {prefetchKkmCloseReports} from './kkm-close-prefetch';

/** Runs in its own systemd job: OFD failures must not hold up established push delivery. */
export async function runKkmCloseBackgroundCycle(sources={prefetch:prefetchKkmCloseReports,recheck:recheckOpenKkmShiftCloseIssues}) {
 const kkmClosePrefetch=await sources.prefetch().catch(()=>({checked:0,complete:0,error:'PREFETCH_UNAVAILABLE'}));
 const kkmShiftClose=await sources.recheck().catch(()=>({checked:0,resolved:0,error:'RECHECK_UNAVAILABLE'}));
 return {kkmShiftClose,kkmClosePrefetch};
}
