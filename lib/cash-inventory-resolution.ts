import { parseOneCDateTime } from './one-c-date';
import type { OneCCashStatementSummaryResult } from './one-c';

export type CashInventoryResolution = {
  documentRef:string; documentName:string; occurredAt:string; checkedAt:string; difference:number;
};
export type CashInventoryCount = {actual:number|null;expected:number|null;capturedAt:string;cashboxRef:string};
export type CashInventoryInput = CashInventoryCount & {
  statement:OneCCashStatementSummaryResult|null;
  followingStatements?:ReadonlyArray<OneCCashStatementSummaryResult>;
  laterCounts?:ReadonlyArray<CashInventoryCount>;
};
const minor=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.round(value*100):null;
const day=(value:number)=>new Date(value).toLocaleDateString('sv-SE',{timeZone:'Europe/Moscow'});
const nextDay=(date:string)=>day(+new Date(`${date}T12:00:00+03:00`)+86400000);
export type CashInventoryEvaluation = {resolution:CashInventoryResolution|null;canContinue:boolean};
export function cashInventoryResolution(input:CashInventoryInput,now=new Date()):CashInventoryResolution|null { return evaluateCashInventory(input,now).resolution; }
/** Follow one cashbox chronologically; ordinary later movements do not erase an inventory document. */
export function evaluateCashInventory(input:CashInventoryInput,now=new Date()):CashInventoryEvaluation {
 const actual=minor(input.actual),expected=minor(input.expected),captured=Date.parse(input.capturedAt);
 if(actual===null||expected===null||actual===expected||!Number.isFinite(captured)||!input.cashboxRef||!input.statement)return {resolution:null,canContinue:false};
 const statements=[input.statement,...input.followingStatements??[]];
 const all:Array<{at:number;inc:number;out:number;movement:OneCCashStatementSummaryResult['movements'][number];checkedAt:string}>=[];
 let previousDate='',previousClosing:number|null=null,organization='';
 // Validate complete days and their opening/closing continuity before accepting evidence.
 for(const s of statements){
  const checked=Date.parse(s.checkedAt),opening=minor(s.openingBalance),incoming=minor(s.incomingTotal),outgoing=minor(s.outgoingTotal),closing=minor(s.closingBalance);
  if(!s.ok||!s.cashbox||s.params.cashboxRef.toLowerCase()!==input.cashboxRef.toLowerCase()||s.cashbox.ref.toLowerCase()!==input.cashboxRef.toLowerCase()||s.params.date!==s.date||!Number.isFinite(checked)||checked>+now||+now-checked>360000||captured>checked||s.movementsCount!==s.movements.length||opening===null||incoming===null||outgoing===null||closing===null||opening+incoming-outgoing!==closing)return {resolution:null,canContinue:false};
  if(previousDate ? s.date!==nextDay(previousDate)||opening!==previousClosing||s.params.organizationRef!==organization : s.date!==day(captured))return {resolution:null,canContinue:false};
  let totalIn=0,totalOut=0;const refs=new Set<string>();
  for(const movement of s.movements){
   const at=parseOneCDateTime(movement.period),inc=minor(movement.incoming),out=minor(movement.outgoing);
   if(!at||day(+at)!==s.date||+at>checked||inc===null||out===null||inc<0||out<0||inc>0&&out>0||!movement.document.ref||refs.has(movement.document.ref))return {resolution:null,canContinue:false};
   refs.add(movement.document.ref);totalIn+=inc;totalOut+=out;
   all.push({at:+at,inc,out,movement,checkedAt:s.checkedAt});
  }
  if(totalIn!==incoming||totalOut!==outgoing)return {resolution:null,canContinue:false};
  previousDate=s.date;previousClosing=closing;organization=s.params.organizationRef;
 }
 all.sort((a,b)=>a.at-b.at);
 // Later ordinary documents can be posted with an earlier period. Keep the
 // captured baseline immutable instead of reconstructing it from today's ledger.
 const counts=(input.laterCounts??[]).filter(c=>c.cashboxRef.toLowerCase()===input.cashboxRef.toLowerCase()&&Date.parse(c.capturedAt)>captured).sort((a,b)=>Date.parse(a.capturedAt)-Date.parse(b.capturedAt));
 let gap=actual-expected,countIndex=0;const documents:typeof all=[];
 for(const entry of all.filter(m=>m.at>captured)){
  while(countIndex<counts.length&&Date.parse(counts[countIndex].capturedAt)<entry.at){
   const count=counts[countIndex++],a=minor(count.actual),e=minor(count.expected);
   if(a===null||e===null||a-e!==gap)return {resolution:null,canContinue:false}; // A different recount supersedes this discrepancy.
  }
  if(entry.movement.documentType!=='Инвентаризация наличных денежных средств')continue;
  const correction=entry.inc-entry.out;
  if(!correction||Math.sign(correction)!==Math.sign(gap)||Math.abs(correction)>Math.abs(gap))return {resolution:null,canContinue:false};
  gap-=correction;documents.push(entry);
  if(gap===0)return {canContinue:false,resolution:{documentRef:documents.map(d=>d.movement.document.ref).join(','),documentName:documents.map(d=>d.movement.document.name).join('; '),occurredAt:new Date(entry.at).toISOString(),checkedAt:entry.checkedAt,difference:(actual-expected)/100}};
 }
 const end=+new Date(`${nextDay(previousDate)}T00:00:00+03:00`);
 while(countIndex<counts.length&&Date.parse(counts[countIndex].capturedAt)<end){const count=counts[countIndex++],a=minor(count.actual),e=minor(count.expected);if(a===null||e===null||a-e!==gap)return {resolution:null,canContinue:false};}
 return {resolution:null,canContinue:true};
}
