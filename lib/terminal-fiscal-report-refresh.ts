import type {SavedFiscalReport} from './terminal-fiscal-report-cache';

/** Transport/read completeness is distinct from unresolved business evidence. */
export function hasCompleteFiscalSources(report:SavedFiscalReport) {
  const sources=report.sourceComplete??report.complete; // legacy saved reports
  return report.configurationComplete&&sources.bank&&sources.oneC&&sources.ofd;
}
export function selectFiscalReportRefresh(previous:SavedFiscalReport|null,fresh:SavedFiscalReport):{report:SavedFiscalReport;retained:'sources'|'older'|null} {
  if(previous&&Date.parse(fresh.updatedAt)<Date.parse(previous.updatedAt))return {report:previous,retained:'older'};
  if(previous&&hasCompleteFiscalSources(previous)&&!hasCompleteFiscalSources(fresh))return {report:previous,retained:'sources'};
  if(previous?.settlement.complete&&!fresh.settlement.complete){
    // Keep statement evidence independently. Never compare new receipt totals
    // with a stale statement's old green conclusion or old fiscal denominator.
    const fiscalKopecks=fresh.settlement.receiptTotals ? fresh.settlement.fiscalKopecks : fresh.nativeFiscalKopecks;
    const settlement={...previous.settlement,receiptTotals:fresh.settlement.receiptTotals,fiscalKopecks,
      differenceKopecks:previous.settlement.settlementKopecks-fiscalKopecks,
      candidates:[],status:'incomplete' as const};
    return {report:{...fresh,settlement,settlementReused:true,
      settlementUpdatedAt:previous.settlementUpdatedAt??previous.updatedAt},retained:null};
  }
  return {report:{...fresh,settlementUpdatedAt:fresh.settlementUpdatedAt??fresh.updatedAt},retained:null};
}
