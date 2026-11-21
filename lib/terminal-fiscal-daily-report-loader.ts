import {applyFiscalManagers, type FiscalManager} from './terminal-fiscal-manager';
import {loadFiscalManager} from './terminal-fiscal-manager-loader';
import {bankOperationKey} from './terminal-fiscal-matching';
import 'server-only';
import {loadFiscalSettlementSource} from './terminal-fiscal-settlement-loader';
import {compareFiscalSettlement} from './terminal-fiscal-settlement';
import { prisma } from './prisma';
import { runTerminalFiscalHistoricalDryRun } from './terminal-fiscal-runner';
import { technicalHash } from './terminal-fiscal-sources';
import { buildDailyFiscalReport, type DailyFiscalEvidence } from './terminal-fiscal-daily-report';
import {checkCrossDayClaims} from './terminal-fiscal-cross-day';

import {fiscalReportSources} from './terminal-fiscal-report-sources';

async function readDay(day:string,sources:ReturnType<typeof fiscalReportSources>) {
  const from=new Date(`${day}T00:00:00+03:00`),to=new Date(from.getTime()+86400000);
  const [mappings,workstations]=await Promise.all([
    prisma.terminalFiscalMapping.findMany({where:{isActive:true,effectiveFrom:{lt:to},OR:[{effectiveTo:null},{effectiveTo:{gt:from}}]},select:{id:true,workstationId:true}}),
    prisma.retailWorkstation.findMany({where:{isActive:true,createdAt:{lt:to}},select:{id:true}}),
  ]);
  const results=await Promise.all(mappings.map(async m=>{
    try {const r=await runTerminalFiscalHistoricalDryRun({mappingId:m.id,periodFrom:from,periodTo:to,persist:false,includeEvidence:true},sources);
      if(r.acquired&&r.evidence&&r.output)return {...r.evidence,
        oneCChecks:r.evidence.oneCChecks.filter(c=>c.sourceType==='acquiring_operation'
          ? c.cardPayments.some(p=>p.acquiringTerminalRef===r.evidence!.mapping.oneCAcquiringTerminalRef)
          : c.cashRegisterRef===r.evidence!.mapping.oneCCashRegisterRef),
        records:r.output.records} satisfies DailyFiscalEvidence;
    } catch { /* Partial data never becomes a zero-valued confirmed day. */ }
    return {bankOperations:[],oneCChecks:[],ofdReceipts:[],records:[],complete:{bank:false,oneC:false,ofd:false}} satisfies DailyFiscalEvidence;
  }));
  const configurationComplete=workstations.every(w=>mappings.filter(m=>m.workstationId===w.id).length===1);
  return {from,to,mappings,results,configurationComplete};
}

export async function loadDailyFiscalReport(day:string) {
  const sources=fiscalReportSources(day);
  const loadDay=(date:string)=>readDay(date,sources);
  const settlementSource=loadFiscalSettlementSource(day);
  const {from,to,mappings,results,configurationComplete}=await loadDay(day);
  const report=buildDailyFiscalReport({from,to,parts:results});
  const coveredKeys=new Set(report.transactions.filter(t=>t.status==='covered').flatMap(t=>t.bank.map(b=>b.key)));
  const disputed=await checkCrossDayClaims(day,report.transactions,async other=>{
    const peer=await loadDay(other);
    const otherReport=buildDailyFiscalReport({from:peer.from,to:peer.to,parts:peer.results});
    return {transactions:otherReport.transactions,complete:peer.configurationComplete&&Object.values(otherReport.sourceComplete).every(Boolean)};
  });
  if(disputed.size){
    const records=new Map(results.flatMap(p=>p.records.map(r=>[r.bankOperationKey,r] as const)));
    report.unresolved+=Array.from(disputed).filter(key=>coveredKeys.has(key)||records.get(key)?.status==='confirmed').length;
    if(report.status==='balanced')report.status='review';
  }
  const managers=new Map<string,FiscalManager>();
  for(const transaction of report.transactions){
    // Resolve at each payment's actual instant. Grouped payments must agree.
    if(!transaction.bank.length)continue;
    const contexts=await Promise.all(transaction.bank.map(async bank=>{
      const mappingIds=[...new Set(results.flatMap((part,index)=>part.bankOperations.some(b=>bankOperationKey(b)===bank.key)?[mappings[index].id]:[]))];
      return loadFiscalManager(prisma,{at:new Date(bank.at),mappingId:mappingIds.length===1?mappingIds[0]:null,cashiers:transaction.oneC.flatMap(cell=>results.flatMap(p=>p.oneCChecks).filter(c=>c.sourceRef===cell.key).map(c=>c.cashier))});
    }));
    const unique=new Set(contexts.map(c=>`${c.key}|${c.state}|${c.note}`));
    managers.set(transaction.key,unique.size===1?contexts[0]:{name:transaction.manager,key:'unassigned',state:'conflict' as const,note:'В группе оплат разные ответственные. Проверьте назначения на момент каждой оплаты.'});
  }
  applyFiscalManagers(report,managers);
  if(!configurationComplete){report.complete.bank=false;report.complete.oneC=false;report.complete.ofd=false;report.status='incomplete';}
  const reviews=await prisma.terminalFiscalEmployeeReview.findMany({where:{bankOperationAt:{gte:from,lt:to},status:{in:['admin_review','open']}},select:{id:true,matchingHash:true}});
  for(const movement of report.movements) {
    if(movement.source!=='bank')continue;
    const review=reviews.find(r=>r.matchingHash===technicalHash(`terminal-fiscal:${movement.key}`));
    if(review)movement.reviewHref=`/admin/workday/payment-checks/${review.id}`;
  }
  for(const transaction of report.transactions){
    const review=transaction.bank.map(b=>reviews.find(r=>r.matchingHash===technicalHash(`terminal-fiscal:${b.key}`))).find(Boolean);
    if(review)transaction.reviewHref=`/admin/workday/payment-checks/${review.id}`;
  }
  const source=await settlementSource;
  const settlement=compareFiscalSettlement(source.raw,{from:source.from,to:source.to,fiscalKopecks:report.nativeFiscalKopecks,fiscalComplete:report.nativeFiscalComplete&&configurationComplete});
  return {...report,settlement,configurationComplete,updatedAt:new Date().toISOString()};
}
