import {AMOUNT_COVERED_REASON,fiscalAmountCoverageEligible} from './terminal-fiscal-coverage-policy';
import {bankOperationKey,canonicalFiscalKey,type BankOperation,type OneCCheck,type OfdReceipt,type MatchingAuditRecord} from './terminal-fiscal-matching';
import type {DailyFiscalEvidence} from './terminal-fiscal-daily-report';
export type FiscalReportCell={key:string;at:string;amountKopecks:number;label:string;cashier?:string};
export type FiscalTransactionRow={key:string;at:string;manager:string;bank:FiscalReportCell[];oneC:FiscalReportCell[];ofd:FiscalReportCell[];status:'matched'|'covered'|'review'|'incomplete';message:string;reviewHref?:string;chain:boolean;complete:{bank:boolean;oneC:boolean;ofd:boolean}};
const receiptKey=(r:OfdReceipt)=>`${r.kktRegistrationNumber}|${canonicalFiscalKey(r)??`${r.receiptAt}|${r.operationType}|${r.totalKopecks}`}`;
export function buildFiscalTransactions(input:{from:Date;to:Date;parts:DailyFiscalEvidence[]}):FiscalTransactionRow[]{
 const inside=(s:string)=>Date.parse(s)>=+input.from&&Date.parse(s)<+input.to;
 const banks=new Map(input.parts.flatMap(p=>p.bankOperations.map(b=>[bankOperationKey(b),b] as const)));
 const checks=new Map(input.parts.flatMap(p=>p.oneCChecks.filter(c=>c.electronicKopecks!==0).map(c=>[c.sourceRef,c] as const)));
 const receipts=new Map(input.parts.flatMap(p=>p.ofdReceipts.filter(r=>r.electronicKopecks!==0).map(r=>[receiptKey(r),r] as const)));
 const records=new Map(input.parts.flatMap(p=>p.records.map(r=>[r.bankOperationKey,r] as const)));
 const bankPart=(key:string)=>input.parts.filter(p=>p.bankOperations.some(b=>bankOperationKey(b)===key));
 const completeFor=(parts:DailyFiscalEvidence[])=>({bank:parts.length>0&&parts.every(p=>p.complete.bank),oneC:parts.length>0&&parts.every(p=>p.complete.oneC),ofd:parts.length>0&&parts.every(p=>p.complete.ofd)});
 const usedBank=new Set<string>(),usedCheck=new Set<string>(),usedOfd=new Set<string>(),result:FiscalTransactionRow[]=[];
 function add(key:string,bs:BankOperation[],cs:OneCCheck[],rs:MatchingAuditRecord[],chain=false){
  const linked:OfdReceipt[]=[];
  for(const c of cs){const identity=canonicalFiscalKey(c);if(!identity||c.sourceType==='acquiring_operation')continue;
   const found=[...receipts.values()].filter(f=>canonicalFiscalKey(f)===identity&&f.kktRegistrationNumber===c.kktRegistrationNumber);
   if(found.length===1&&!usedOfd.has(receiptKey(found[0]))){linked.push(found[0]);usedOfd.add(receiptKey(found[0]));}
  }
  const parts=bs.length?bs.flatMap(b=>bankPart(bankOperationKey(b))):input.parts.filter(p=>p.oneCChecks.some(c=>cs.some(v=>v.sourceRef===c.sourceRef)));
  const complete=completeFor(parts),allComplete=Object.values(complete).every(Boolean);
  const matched=!chain&&bs.length>0&&rs.length===bs.length&&rs.every(r=>r.status==='confirmed')&&cs.length>0&&linked.length===cs.length;
  const sumBank=bs.reduce((n,b)=>n+(b.type==='Credit'?-1:1)*b.amountKopecks,0),sumChecks=cs.reduce((n,c)=>n+(c.operationType==='refund'?-1:1)*c.electronicKopecks,0);
  const covered=chain&&allComplete&&bs.length>0&&cs.length>0&&linked.length===cs.length&&sumBank===sumChecks;
  const names=[...new Set(cs.map(c=>c.cashier?.name).filter(Boolean))];
  const alternatives=rs.some(r=>(r.evidence?.chain?.alternatives??0)>1);
  const message=!allComplete?'Неполные данные':covered?'Сумма покрыта':chain?'Возможная связь':matched?'Совпало':alternatives?'Несколько вариантов':rs.some(r=>r.reasonCode==='OFD_CANDIDATE_REQUIRES_LINK')?'Проверить связь с ОФД':!cs.length?'Нет связи с 1С':cs.every(c=>c.sourceType==='acquiring_operation')?'Нет фискального чека':!linked.length?'Нет связи с ОФД':!bs.length?'Нет связи с оплатой':'Нужна проверка';
  const times=[...bs.map(b=>b.transactionDate),...cs.map(c=>c.dateTime)].sort((a,b)=>Date.parse(a)-Date.parse(b));
  for(const b of bs)usedBank.add(bankOperationKey(b));for(const c of cs)usedCheck.add(c.sourceRef);
  result.push({key,at:times[0],manager:names.join(', ')||'Не определён',chain,complete,status:!allComplete?'incomplete':matched?'matched':covered?'covered':'review',message,
   bank:bs.map(b=>({key:bankOperationKey(b),at:b.transactionDate,amountKopecks:(b.type==='Credit'?-1:1)*b.amountKopecks,label:b.type==='Credit'?'Возврат':'Оплата'})),
   oneC:cs.map(c=>({key:c.sourceRef,at:c.dateTime,amountKopecks:(c.operationType==='refund'?-1:1)*c.electronicKopecks,cashier:c.cashier?.name,label:c.sourceType==='acquiring_operation'?`Эквайринг ${c.sourceRef.match(/Эквайринговая операция\s+([^\s|]+)/u)?.[1]??''}`.trim():`${c.operationType==='refund'?'Возврат':'Чек'} № ${c.fiscalDocumentNumber??'—'}`})),
   ofd:linked.map(f=>({key:receiptKey(f),at:f.receiptAt,amountKopecks:(f.operationType===2?-1:1)*f.electronicKopecks,label:`${f.operationType===2?'Возврат':'Чек'} № ${f.fiscalDocumentNumber}`}))});
 }
 // A single hypothesis may group payments and receipts, but never marks them confirmed.
 const hypotheses=new Map<string,{bs:BankOperation[];cs:OneCCheck[];record:MatchingAuditRecord}>();
 for(const r of records.values()){
  const chain=r.evidence?.chain,primary=banks.get(r.bankOperationKey);if(!chain||chain.alternatives!==1||!primary)continue;
  const bs=chain.payments.flatMap(p=>{const found=[...banks.values()].filter(b=>b.terminalKey===primary.terminalKey&&b.transactionDate===p.at&&b.amountKopecks===p.amountKopecks&&b.type==='Debit');return found.length===1?found:[];});
  const cs=chain.checks.flatMap(c=>checks.has(c.ref)?[checks.get(c.ref)!]:[]);
  if(!bs.length||bs.length!==chain.payments.length||cs.length!==chain.checks.length||!bs.some(b=>inside(b.transactionDate)))continue;
  const key=[...bs.map(bankOperationKey).sort(),...cs.map(c=>c.sourceRef).sort()].join('::');hypotheses.set(key,{bs,cs,record:r});
 }
 for(const [key,h] of hypotheses){
  const overlaps=[...hypotheses.entries()].some(([other,v])=>other!==key&&(v.bs.some(b=>h.bs.some(a=>bankOperationKey(a)===bankOperationKey(b)))||v.cs.some(c=>h.cs.some(a=>a.sourceRef===c.sourceRef))));
  if(overlaps)continue;
  add(key,h.bs,h.cs,[h.record],true);
 }
 // Once exact/unique composition links are set aside, compare the remaining
 // complete workplace/day by sale and refund separately. Balanced leftovers
 // establish amount coverage, not an invented pairing of identical receipts.
 const exactBank=new Set([...records.values()].filter(r=>r.status==='confirmed'&&r.reasonCode!==AMOUNT_COVERED_REASON).map(r=>r.bankOperationKey));
 const exactChecks=new Set([...records.values()].filter(r=>r.status==='confirmed'&&r.reasonCode!==AMOUNT_COVERED_REASON&&r.oneCCheckKey).map(r=>r.oneCCheckKey!));
 for(const p of input.parts){
  if(!p.complete.bank||!p.complete.oneC||!p.complete.ofd)continue;
  const bs=[...new Map(p.bankOperations.filter(b=>inside(b.transactionDate)&&!usedBank.has(bankOperationKey(b))&&!exactBank.has(bankOperationKey(b))&&records.has(bankOperationKey(b))&&fiscalAmountCoverageEligible(records.get(bankOperationKey(b))!)).map(b=>[bankOperationKey(b),b])).values()];
  const cs=[...new Map(p.oneCChecks.filter(c=>inside(c.dateTime)&&!usedCheck.has(c.sourceRef)&&!exactChecks.has(c.sourceRef)&&![...records.values()].some(r=>r.oneCCheckKey===c.sourceRef&&!fiscalAmountCoverageEligible(r)&&r.reasonCode!==AMOUNT_COVERED_REASON)&&['sale_check','refund_check'].includes(c.sourceType)&&c.electronicKopecks>0).map(c=>[c.sourceRef,c])).values()];
  if(!bs.length||!cs.length||new Set(bs.map(b=>b.terminalKey)).size!==1||new Set(cs.map(c=>c.cashRegisterRef)).size!==1)continue;
  if(cs.some(c=>{const identity=canonicalFiscalKey(c);const fs=[...receipts.values()].filter(f=>identity&&canonicalFiscalKey(f)===identity&&f.kktRegistrationNumber===c.kktRegistrationNumber);
   return (p.mapping&&c.kktRegistrationNumber!==p.mapping.kktRegistrationNumber)||c.fiscalState!=='confirmed'||c.fiscalConflict||!identity||[...checks.values()].filter(v=>canonicalFiscalKey(v)===identity).length!==1||fs.length!==1||usedOfd.has(receiptKey(fs[0]))||fs[0].electronicKopecks!==c.electronicKopecks||fs[0].totalKopecks!==c.totalKopecks||fs[0].operationType!==(c.operationType==='refund'?2:1);
  }))continue;
  if(bs.some(b=>b.type==='Other'))continue;
  const bankSales=bs.filter(b=>b.type==='Debit').reduce((n,b)=>n+b.amountKopecks,0),bankRefunds=bs.filter(b=>b.type==='Credit').reduce((n,b)=>n+b.amountKopecks,0);
  const checkSales=cs.filter(c=>c.operationType==='sale').reduce((n,c)=>n+c.electronicKopecks,0),checkRefunds=cs.filter(c=>c.operationType==='refund').reduce((n,c)=>n+c.electronicKopecks,0);
  if(bankSales!==checkSales||bankRefunds!==checkRefunds)continue;
  const key=`day:${bs.map(bankOperationKey).sort().join('::')}`;
  add(key,bs,cs,bs.flatMap(b=>records.has(bankOperationKey(b))?[records.get(bankOperationKey(b))!]:[]),true);
 }
 for(const [key,b] of banks){
  if(usedBank.has(key)||!inside(b.transactionDate))continue;
  const r=records.get(key),c=r?.oneCCheckKey?checks.get(r.oneCCheckKey):undefined;
  // Reused check assignments stay grouped as a review, never repeated as two proven receipts.
  const bs=c?[...banks.values()].filter(v=>!usedBank.has(bankOperationKey(v))&&inside(v.transactionDate)&&records.get(bankOperationKey(v))?.oneCCheckKey===c.sourceRef):[b];
  add(key,bs,c&&!usedCheck.has(c.sourceRef)?[c]:[],bs.flatMap(v=>records.has(bankOperationKey(v))?[records.get(bankOperationKey(v))!]:[]));
 }
 for(const [key,c] of checks)if(!usedCheck.has(key)&&inside(c.dateTime))add(`oneC:${key}`,[],[c],[]);
 for(const [key,f] of receipts)if(!usedOfd.has(key)&&inside(f.receiptAt)){
  const complete=completeFor(input.parts.filter(p=>p.ofdReceipts.some(r=>receiptKey(r)===key)));
  result.push({key:`ofd:${key}`,at:f.receiptAt,manager:'Не определён',bank:[],oneC:[],ofd:[{key,at:f.receiptAt,amountKopecks:(f.operationType===2?-1:1)*f.electronicKopecks,label:`Чек № ${f.fiscalDocumentNumber}`}],status:Object.values(complete).every(Boolean)?'review':'incomplete',message:'Нет связи с 1С',chain:false,complete});
 }
 return result.sort((a,b)=>Number(a.status==='matched'||a.status==='covered')-Number(b.status==='matched'||b.status==='covered')||Date.parse(a.at)-Date.parse(b.at));
}
