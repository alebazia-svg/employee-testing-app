import test from 'node:test';
import assert from 'node:assert/strict';
import {hasCompleteFiscalSources,selectFiscalReportRefresh} from '../lib/terminal-fiscal-report-refresh';
import {buildDailyFiscalReport} from '../lib/terminal-fiscal-daily-report';
import {compareFiscalSettlement} from '../lib/terminal-fiscal-settlement';
import type {SavedFiscalReport} from '../lib/terminal-fiscal-report-cache';
function report(at:string):SavedFiscalReport{
 const base=buildDailyFiscalReport({from:new Date('2026-11-19T21:00Z'),to:new Date('2026-11-20T21:00Z'),parts:[]});
 return {...base,complete:{bank:true,oneC:true,ofd:true},sourceComplete:{bank:true,oneC:true,ofd:true},configurationComplete:true,updatedAt:at,settlement:{...compareFiscalSettlement(null,{from:'2026-11-20',to:'2026-11-20',fiscalKopecks:0,fiscalComplete:true}),complete:true}};
}
test('fresh complete reads replace the old 14:09 report while unresolved 500-ruble rows stay visible',()=>{
 const old=report('2026-11-20T11:09Z'),fresh=report('2026-11-20T19:00Z');
 fresh.complete.oneC=false;fresh.unlinkedAcquiringCount=1;fresh.unlinkedAcquiringKopecks=50000;fresh.unresolved=1;fresh.status='incomplete';
 fresh.total={...fresh.total,bankKopecks:2530000,oneCKopecks:2530000,ofdKopecks:2480000,fiscalDifferenceKopecks:50000};
 fresh.transactions=[{key:'acq091',status:'review',message:'Нет фискального чека'},{key:'18:41',status:'review',message:'Нет связи с ОФД'},{key:'other',status:'matched',message:'Совпало'}] as any;
 const result=selectFiscalReportRefresh(old,fresh);assert.equal(result.retained,null);assert.equal(hasCompleteFiscalSources(fresh),true);
 assert.equal(result.report.updatedAt,fresh.updatedAt);assert.deepEqual(result.report.transactions,fresh.transactions);assert.deepEqual(result.report.total,fresh.total);assert.equal(result.report.status,'incomplete');
 assert.equal(old.updatedAt,'2026-11-20T11:09Z');
});
test('a real source outage or missing equipment mapping preserves the last full read including unresolved rows',()=>{
 const old=report('2026-11-20T18:00Z');old.complete.oneC=false;old.unlinkedAcquiringCount=1;
 for(const field of ['bank','oneC','ofd'] as const){const fresh=report('2026-11-20T19:00Z');fresh.sourceComplete[field]=false;fresh.complete[field]=false;assert.equal(selectFiscalReportRefresh(old,fresh).report,old);assert.equal(selectFiscalReportRefresh(old,fresh).retained,'sources');}
 const fresh=report('2026-11-20T19:00Z');fresh.configurationComplete=false;assert.equal(selectFiscalReportRefresh(old,fresh).report,old);
});
test('missing statement does not freeze new receipts or retain an old green comparison',()=>{
 const old=report('2026-11-20T11:09Z');old.settlement={...old.settlement,status:'amount_equal',settlementKopecks:100000,fiscalKopecks:100000,differenceKopecks:0};
 const fresh=report('2026-11-20T19:00Z');fresh.settlement.complete=false;fresh.nativeFiscalKopecks=250000;fresh.total.ofdKopecks=250000;
 const r=selectFiscalReportRefresh(old,fresh);assert.equal(r.retained,null);assert.equal(r.report.total.ofdKopecks,250000);assert.equal(r.report.settlement.settlementKopecks,100000);
 assert.equal(r.report.settlement.fiscalKopecks,250000);assert.equal(r.report.settlement.differenceKopecks,-150000);assert.equal(r.report.settlement.status,'incomplete');assert.deepEqual(r.report.settlement.candidates,[]);assert.equal(r.report.settlementUpdatedAt,old.updatedAt);assert.equal(r.report.settlementReused,true);
 const again=selectFiscalReportRefresh(r.report,{...fresh,updatedAt:'2026-11-20T19:01Z'});assert.equal(again.report.settlementUpdatedAt,old.updatedAt);
 const recovered=selectFiscalReportRefresh(r.report,report('2026-11-20T19:02Z'));assert.equal(recovered.report.settlementReused,undefined);assert.equal(recovered.report.settlementUpdatedAt,'2026-11-20T19:02Z');
});
test('late old responses do not overwrite newer data and first incomplete reads remain explicitly incomplete',()=>{
 const fresh=report('2026-11-20T19:00Z'),old=report('2026-11-20T11:09Z');assert.equal(selectFiscalReportRefresh(fresh,old).retained,'older');
 const partial=report('2026-11-20T19:00Z');partial.sourceComplete.ofd=false;partial.complete.ofd=false;partial.status='incomplete';const r=selectFiscalReportRefresh(null,partial);assert.equal(r.report.status,'incomplete');assert.equal(hasCompleteFiscalSources(r.report),false);
 const legacy=report('2026-11-20T11:09Z');delete (legacy as any).sourceComplete;assert.equal(hasCompleteFiscalSources(legacy),true);
});

test('reused bank credits keep the current confirmed RMK and acquiring breakdown',()=>{
 const old=report('2026-11-20T11:09Z'),fresh=report('2026-11-20T19:00Z');
 old.settlement.settlementKopecks=1350000;
 fresh.nativeFiscalKopecks=1170000;
 fresh.settlement={...fresh.settlement,complete:false,fiscalKopecks:1350000,receiptTotals:{complete:true,rmkKopecks:1170000,acquiringKopecks:180000}};
 const result=selectFiscalReportRefresh(old,fresh).report.settlement;
 assert.deepEqual(result.receiptTotals,fresh.settlement.receiptTotals);
 assert.equal(result.differenceKopecks,0);
 assert.equal(result.status,'incomplete');
});
