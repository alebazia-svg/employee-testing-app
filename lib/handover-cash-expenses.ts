import { expenseRecord as record, expenseText as text, expenseListStage } from './expense-request-list-view';
import { employeeExpenseSnapshot, expenseOutstanding } from './employee-expense-policy';
import { parseOneCDateTime } from './one-c-date';
const branchComplete = (value: Record<string, unknown>) => value.complete === true && value.truncated !== true
  && (!Array.isArray(value.errors) || value.errors.length === 0)
  && (!Array.isArray(value.missing_fields) || value.missing_fields.length === 0);

export type HandoverCashExpenses = {
  state: 'awaiting_approval' | 'awaiting_documents' | 'documented';
  approvalAmount: number; payableAmount: number; documentedAmount: number;
  checkedAt: string; requestRefs: string[]; documentRefs: string[];
};
/** Full explanation only: direct cashbox ownership/allocation, never comment parsing or subset sums. */
type HandoverCashExpenseInput = {actual:number;expected:number|null;capturedAt:string;cashboxRef:string;uniqueOwner:boolean;complete:boolean;checkedAt:string|null;now:number;rows:Array<{source:unknown;seenAt:string;cycle:number}>};
export function handoverCashExpenses(input:HandoverCashExpenseInput): HandoverCashExpenses | null | undefined {
 // Prefer the complete set of requests already known at the count. Later
 // multi-cashbox allocations are fallback evidence, never extra earlier spending.
 const anchored=evaluateExpenses(input,false);
 return anchored===null ? evaluateExpenses(input,true) : anchored;
}
function evaluateExpenses(input:HandoverCashExpenseInput,includeLateAllocations:boolean): HandoverCashExpenses | null | undefined {
 const captured=Date.parse(input.capturedAt), countedDay=new Date(input.capturedAt).toLocaleDateString('sv-SE',{timeZone:'Europe/Moscow'}), difference=Math.round(((input.expected??input.actual)-input.actual)*100);
 if(input.expected===null||difference<=0||!Number.isFinite(captured))return null;
 const snapshot=employeeExpenseSnapshot({...input,rows:input.rows.filter(row=>{const at=parseOneCDateTime(text(record(row.source).date));return at!==null&&+at<=captured;})});
 if(snapshot.state!=='ready')return undefined;
 const before=(date:string)=>{const at=parseOneCDateTime(date);return at!==null&&+at<=captured;};
 const pending=snapshot.pending.filter(x=>before(x.date)), payable=snapshot.payable.filter(x=>before(x.date));
 let documented=0;const docs:string[]=[], refs=new Set<string>();
 for(const row of input.rows){
  const s=record(row.source), links=record(s.linkedCashExpenseOrders), execution=record(s.execution);
  const requestAt=parseOneCDateTime(text(s.date));
  if(!requestAt||requestAt.toLocaleDateString('sv-SE',{timeZone:'Europe/Moscow'})!==countedDay)continue;
  const ownRequest=text(record(s.cashbox).ref).toLowerCase()===input.cashboxRef.toLowerCase();
  const ownAllocation=Array.isArray(links.rows)&&links.rows.some(value=>text(record(record(value).cashbox).ref).toLowerCase()===input.cashboxRef.toLowerCase());
  if(!ownRequest&&!ownAllocation)continue;
  // A later ordinary request belongs to a later cash operation, not this count.
  // Late multi-cashbox requests retain their explicit allocation evidence.
  if(+requestAt>captured && (ownRequest || !includeLateAllocations))continue;
  if(s.deletionMark===true||s.posted===false||text(record(s.status).key)==='rejected')continue;
  // Paid rows also need fresh, explicit evidence. Absence/staleness is not a reversal.
  const seen=Date.parse(row.seenAt);
  if(!Number.isFinite(seen)||input.now-seen>360000||seen>input.now)return undefined;
  if((expenseOutstanding(s)===null&&expenseListStage(text(record(s.status).key),typeof s.amount==='number'?s.amount:null,s,true,s.deletionMark===true)!=='closed')||s.posted!==true||s.deletionMark!==false||record(s.completeness).complete===false||!branchComplete(execution)||execution.amounts_consistent===false||!branchComplete(links)||!Array.isArray(links.rows))return undefined;
  if(!['руб','руб.','rub','rur','₽'].includes(text(record(s.currency).name).toLowerCase()))return undefined;
  if(!['payable','approved','not_approved'].includes(text(record(s.status).key)))continue;
  for(const value of links.rows){
   const r=record(value), at=parseOneCDateTime(text(r.date)), amount=Number(r.executed_amount), ref=text(r.ref);
   if(r.posted!==true||r.deletion_mark!==false||r.request_amount_conflict===true||!at||+at<=captured||+at>input.now||text(record(r.cashbox).ref).toLowerCase()!==input.cashboxRef.toLowerCase())continue;
   if(!ref||!Number.isFinite(amount)||amount<=0||amount!==Number(r.request_amount)||amount>Number(r.amount)||!Array.isArray(r.source_paths)||!r.source_paths.some(x=>x==='header.request'||x==='payment_line.request'))continue;
   if(docs.includes(ref))return null;
   docs.push(ref);documented+=Math.round(amount*100);refs.add(text(s.ref));
  }
 }
 const approval=pending.reduce((s,x)=>s+Math.round(x.remaining*100),0), toPay=payable.reduce((s,x)=>s+Math.round(x.remaining*100),0);
 if(approval+toPay+documented!==difference)return null;
 for(const r of [...pending,...payable])refs.add(r.ref);
 return {state:approval?'awaiting_approval':toPay?'awaiting_documents':'documented',approvalAmount:approval/100,payableAmount:toPay/100,documentedAmount:documented/100,checkedAt:input.checkedAt!,requestRefs:[...refs],documentRefs:docs};
}
export function handoverExpenseLabel(e: HandoverCashExpenses): string {
 return e.state==='awaiting_approval'?'К согласованию':e.state==='awaiting_documents'?'Оформите расходник':'Подтверждено расходником';
}
