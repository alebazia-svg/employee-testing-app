import type {DailyFiscalEvidence} from './terminal-fiscal-daily-report';
import {canonicalFiscalKey, type OneCCheck, type OfdReceipt} from './terminal-fiscal-matching';

export function settlementReceiptTotals(from:Date,to:Date,parts:DailyFiscalEvidence[]) {
  const inside=(at:string)=>Date.parse(at)>=+from && Date.parse(at)<+to;
  let complete=parts.length>0 && parts.every(p=>p.complete.oneC && p.complete.ofd);
  let rmkKopecks=0, acquiringKopecks=0;
  const groups=new Map<string,{checks:OneCCheck[];receipts:OfdReceipt[]}>();
  function group(key:string) {
    let entry=groups.get(key);
    if(!entry){entry={checks:[],receipts:[]};groups.set(key,entry);}
    return entry;
  }
  for(const part of parts){
    for(const check of part.oneCChecks){
      if(!['sale_check','refund_check','acquiring_operation'].includes(check.sourceType))continue;
      const key=canonicalFiscalKey(check);
      if(key)group(key).checks.push(check);
      else if(check.electronicKopecks && inside(check.dateTime) && (check.sourceType!=='acquiring_operation' || check.fiscalState==='confirmed' || check.fiscalConflict))complete=false;
    }
    for(const receipt of part.ofdReceipts){
      const key=canonicalFiscalKey(receipt);
      if(key)group(key).receipts.push(receipt);
      else if(receipt.electronicKopecks && inside(receipt.receiptAt))complete=false;
    }
  }
  // The fiscal day belongs to the KKT receipt, even when payment was yesterday.
  for(const {checks,receipts} of groups.values()){
    const receipt=receipts.find(r=>inside(r.receiptAt) && r.electronicKopecks!==0);
    if(!receipt){
      if(!receipts.length && checks.some(c=>c.electronicKopecks && inside(c.fiscalDateTime??c.dateTime)))complete=false;
      continue;
    }
    const refund=receipt.operationType===2;
    const sameReceipt=receipts.every(r=>r.receiptAt===receipt.receiptAt && r.kktRegistrationNumber===receipt.kktRegistrationNumber
      && r.operationType===receipt.operationType && r.totalKopecks===receipt.totalKopecks && r.electronicKopecks===receipt.electronicKopecks);
    const verified=checks.length>0 && checks.every(c=>c.fiscalState==='confirmed' && !c.fiscalConflict
      && !!receipt.kktRegistrationNumber && c.kktRegistrationNumber===receipt.kktRegistrationNumber
      && c.operationType===(refund?'refund':'sale') && c.totalKopecks===receipt.totalKopecks && c.electronicKopecks===receipt.electronicKopecks);
    if(![1,2].includes(receipt.operationType) || !sameReceipt || !verified){complete=false;continue;}
    const native=checks.filter(c=>c.sourceType!=='acquiring_operation');
    const amount=(refund?-1:1)*receipt.electronicKopecks;
    if(native.length)rmkKopecks+=amount;
    else acquiringKopecks+=amount;
  }
  return {rmkKopecks,acquiringKopecks,complete};
}
