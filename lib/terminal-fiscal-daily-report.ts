import {buildFiscalTransactions} from './terminal-fiscal-transaction-report';
import { bankOperationKey, canonicalFiscalKey, type BankOperation, type OneCCheck, type OfdReceipt, type MatchingAuditRecord } from './terminal-fiscal-matching';
export type DailyFiscalEvidence = {
  bankOperations: BankOperation[]; oneCChecks: OneCCheck[]; ofdReceipts: OfdReceipt[];
  mapping?:{oneCCashRegisterRef:string;kktRegistrationNumber:string;terminalKey:string};
  records: MatchingAuditRecord[]; complete: {bank:boolean;oneC:boolean;ofd:boolean};
};
export type DailyFiscalRow = {key:string;name:string;bankKopecks:number;oneCKopecks:number;ofdKopecks:number;bankDifferenceKopecks:number;fiscalDifferenceKopecks:number};
export function buildDailyFiscalReport(input:{from:Date;to:Date;parts:DailyFiscalEvidence[]}) {
  const inside=(at:string)=>Date.parse(at)>=input.from.getTime()&&Date.parse(at)<input.to.getTime();
  const complete={bank:input.parts.length>0&&input.parts.every(p=>p.complete.bank),oneC:input.parts.length>0&&input.parts.every(p=>p.complete.oneC),ofd:input.parts.length>0&&input.parts.every(p=>p.complete.ofd)};
  const banks=new Map(input.parts.flatMap(p=>p.bankOperations.filter(b=>inside(b.transactionDate)).map(b=>[bankOperationKey(b),b] as const)));
  const checks=new Map(input.parts.flatMap(p=>p.oneCChecks.map(c=>[c.sourceRef,c] as const)));
  const receipts=new Map(input.parts.flatMap(p=>p.ofdReceipts.filter(r=>inside(r.receiptAt)).map(r=>[`${r.kktRegistrationNumber}|${canonicalFiscalKey(r)??r.receiptAt}`,r] as const)));
  const records=new Map(input.parts.flatMap(p=>p.records.map(r=>[r.bankOperationKey,r] as const)));
  const transactions=buildFiscalTransactions(input);
  const rows=new Map<string,DailyFiscalRow>();
  const row=(cashier?:OneCCheck['cashier'])=>{
    const key=cashier?.ref?`cashier:${cashier.ref}`:'unassigned';
    if(!rows.has(key))rows.set(key,{key,name:cashier?.ref?(cashier.name||'Кассир 1С без имени'):'Не распределено',bankKopecks:0,oneCKopecks:0,ofdKopecks:0,bankDifferenceKopecks:0,fiscalDifferenceKopecks:0});return rows.get(key)!;
  };
  const movements: Array<{key:string;managerKey:string;source:'bank'|'oneC'|'ofd';at:string;amountKopecks:number;reference:string;reviewHref?:string}>=[];
  let nativeFiscalKopecks=0;
  let nativeFiscalComplete=input.parts.length>0&&input.parts.every(p=>p.complete.oneC);
  let unresolved=0,lateLinkedKopecks=0,unlinkedAcquiringKopecks=0,unlinkedAcquiringCount=0;
  const checkUses=new Map<string,number>();
  for(const r of records.values())if(r.oneCCheckKey)checkUses.set(r.oneCCheckKey,(checkUses.get(r.oneCCheckKey)??0)+1);
  // A uniquely linked posted 1C document contributes to the 1C column even
  // while its fiscal receipt is unresolved. This is not financial confirmation.
  const matchedAcquiring=new Set([...records.values()].filter(r=>r.oneCCheckKey
    && checkUses.get(r.oneCCheckKey)===1 && r.reasonCode!=='ONE_C_CHECK_REUSED').map(r=>r.oneCCheckKey));
  for(const b of banks.values()){
    const record=records.get(bankOperationKey(b));const c=record?.status==='confirmed'&&record.oneCCheckKey?checks.get(record.oneCCheckKey):undefined;
    const value=(b.type==='Credit'?-1:1)*b.amountKopecks;
    if(b.type==='Other'){complete.bank=false;continue;}
    const covered=transactions.find(t=>t.status==='covered'&&t.bank.some(v=>v.key===bankOperationKey(b)));
    const coveredCashiers=covered?.oneC.flatMap(v=>checks.get(v.key)?.cashier.ref?[checks.get(v.key)!.cashier]:[])??[];
    const groupCashier=coveredCashiers.length&&new Set(coveredCashiers.map(v=>v.ref)).size===1?coveredCashiers[0]:undefined;
    const owner=row(c?.cashier??groupCashier); owner.bankKopecks+=value;
    movements.push({key:bankOperationKey(b),managerKey:owner.key,source:'bank',at:b.transactionDate,amountKopecks:value,reference:b.type==='Credit'?'Возврат по терминалу':'Оплата по терминалу'});
    if(record?.status!=='confirmed'&&!covered)unresolved++;
    if(c&&!inside(c.dateTime))lateLinkedKopecks+=value;
  }
  for(const c of checks.values()){
    if(!inside(c.dateTime)||c.electronicKopecks===0)continue;
    if(c.sourceType==='sale_check'||c.sourceType==='refund_check')nativeFiscalKopecks+=(c.operationType==='refund'?-1:1)*c.electronicKopecks;
    if(c.sourceType==='acquiring_operation'&&!matchedAcquiring.has(c.sourceRef)){
      unlinkedAcquiringCount++;unlinkedAcquiringKopecks+=(c.operationType==='refund'?-1:1)*c.electronicKopecks;continue;
    }
    if(!['sale_check','refund_check','acquiring_operation'].includes(c.sourceType))continue;
    const owner=row(c.cashier),value=(c.operationType==='refund'?-1:1)*c.electronicKopecks;owner.oneCKopecks+=value;
    movements.push({key:c.sourceRef,managerKey:owner.key,source:'oneC',at:c.dateTime,amountKopecks:value,reference:c.sourceType==='acquiring_operation'?`Эквайринговая операция ${c.sourceRef.match(/Эквайринговая операция\s+([^\s|]+)/u)?.[1]??''}`.trim():`${c.operationType==='refund'?'Возврат':'Чек'} № ${c.fiscalDocumentNumber??'—'}`});
  }
  for(const receipt of receipts.values()){
    if(receipt.electronicKopecks===0)continue;
    if(![1,2].includes(receipt.operationType)){complete.ofd=false;continue;}
    const matches=[...checks.values()].filter(c=>c.sourceType!=='acquiring_operation'&&canonicalFiscalKey(c)===canonicalFiscalKey(receipt)&&c.kktRegistrationNumber===receipt.kktRegistrationNumber);
    const owner=row(matches.length===1?matches[0].cashier:undefined),value=(receipt.operationType===2?-1:1)*receipt.electronicKopecks;owner.ofdKopecks+=value;
    movements.push({key:canonicalFiscalKey(receipt)??receipt.receiptAt,managerKey:owner.key,source:'ofd',at:receipt.receiptAt,amountKopecks:value,reference:`${receipt.operationType===2?'Возврат':'Чек'} № ${receipt.fiscalDocumentNumber}`});
  }
  if(unlinkedAcquiringCount)complete.oneC=false;
  const fiscalIdentities=new Set<string>();
  for(const c of checks.values()) {
    if(c.sourceType==='acquiring_operation'||!inside(c.dateTime))continue;
    const identity=canonicalFiscalKey(c);if(!identity)continue;
    if(fiscalIdentities.has(identity)){complete.oneC=false;nativeFiscalComplete=false;}fiscalIdentities.add(identity);
  }
  const result=[...rows.values()].map(r=>({...r,bankDifferenceKopecks:r.bankKopecks-r.oneCKopecks,fiscalDifferenceKopecks:r.oneCKopecks-r.ofdKopecks})).sort((a,b)=>a.key==='unassigned'?1:b.key==='unassigned'?-1:a.name.localeCompare(b.name,'ru'));
  const total=result.reduce((a,r)=>({...a,bankKopecks:a.bankKopecks+r.bankKopecks,oneCKopecks:a.oneCKopecks+r.oneCKopecks,ofdKopecks:a.ofdKopecks+r.ofdKopecks,bankDifferenceKopecks:a.bankDifferenceKopecks+r.bankDifferenceKopecks,fiscalDifferenceKopecks:a.fiscalDifferenceKopecks+r.fiscalDifferenceKopecks}),{key:'total',name:'Итого',bankKopecks:0,oneCKopecks:0,ofdKopecks:0,bankDifferenceKopecks:0,fiscalDifferenceKopecks:0});
  return {transactions,rows:result,total,complete,nativeFiscalKopecks,nativeFiscalComplete,unresolved,movements,lateLinkedKopecks,unlinkedAcquiringKopecks,unlinkedAcquiringCount,
    status:!complete.bank||!complete.oneC||!complete.ofd?'incomplete':total.bankDifferenceKopecks||total.fiscalDifferenceKopecks?'difference':unresolved||result.some(r=>r.bankDifferenceKopecks!==0||r.fiscalDifferenceKopecks!==0)?'review':'balanced'};
}
export type DailyFiscalReport=ReturnType<typeof buildDailyFiscalReport>;
