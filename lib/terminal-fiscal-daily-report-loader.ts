import 'server-only';
import {loadFiscalSettlement} from './terminal-fiscal-settlement-loader';
import { prisma } from './prisma';
import { runTerminalFiscalHistoricalDryRun } from './terminal-fiscal-runner';
import { technicalHash } from './terminal-fiscal-sources';
import { buildDailyFiscalReport, type DailyFiscalEvidence } from './terminal-fiscal-daily-report';
export async function loadDailyFiscalReport(day:string) {
  const from=new Date(`${day}T00:00:00+03:00`),to=new Date(from.getTime()+86400000);
  const [mappings,workstations]=await Promise.all([
    prisma.terminalFiscalMapping.findMany({where:{isActive:true,effectiveFrom:{lt:to},OR:[{effectiveTo:null},{effectiveTo:{gt:from}}]},select:{id:true,workstationId:true}}),
    prisma.retailWorkstation.findMany({where:{isActive:true,createdAt:{lt:to}},select:{id:true}}),
  ]);
  const results=await Promise.all(mappings.map(async m=>{
    try {const r=await runTerminalFiscalHistoricalDryRun({mappingId:m.id,periodFrom:from,periodTo:to,persist:false,includeEvidence:true});
      if(r.acquired&&r.evidence&&r.output)return {...r.evidence,
        oneCChecks:r.evidence.oneCChecks.filter(c=>c.sourceType==='acquiring_operation'
          ? c.cardPayments.some(p=>p.acquiringTerminalRef===r.evidence!.mapping.oneCAcquiringTerminalRef)
          : c.cashRegisterRef===r.evidence!.mapping.oneCCashRegisterRef),
        records:r.output.records} satisfies DailyFiscalEvidence;
    } catch { /* Partial data never becomes a zero-valued confirmed day. */ }
    return {bankOperations:[],oneCChecks:[],ofdReceipts:[],records:[],complete:{bank:false,oneC:false,ofd:false}} satisfies DailyFiscalEvidence;
  }));
  const report=buildDailyFiscalReport({from,to,parts:results});
  const configurationComplete=workstations.every(w=>mappings.filter(m=>m.workstationId===w.id).length===1);
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
  const settlement=await loadFiscalSettlement(day,report.nativeFiscalKopecks,report.nativeFiscalComplete&&configurationComplete);
  return {...report,settlement,configurationComplete,updatedAt:new Date().toISOString()};
}
