import { expenseRecord as record, expenseText as text, expenseListStage } from './expense-request-list-view';
import { employeeExpenseSnapshot, expenseOutstanding } from './employee-expense-policy';
import { parseOneCDateTime } from './one-c-date';
export type HandoverCashExpenses = {
  state: 'awaiting_approval' | 'awaiting_documents' | 'documented';
  approvalAmount: number; payableAmount: number; documentedAmount: number;
  checkedAt: string; requestRefs: string[]; documentRefs: string[];
};
/** Full explanation only: direct cashbox ownership/allocation, never comment parsing or subset sums. */
export function handoverCashExpenses(input: {actual:number;expected:number|null;capturedAt:string;cashboxRef:string;uniqueOwner:boolean;complete:boolean;checkedAt:string|null;now:number;rows:Array<{source:unknown;seenAt:string;cycle:number}>}): HandoverCashExpenses | null | undefined {
 const captured=Date.parse(input.capturedAt), countedDay=new Date(input.capturedAt).toLocaleDateString('sv-SE',{timeZone:'Europe/Moscow'}), difference=Math.round(((input.expected??input.actual)-input.actual)*100);
 if(input.expected===null||difference<=0||!Number.isFinite(captured))return null;
 const snapshot=employeeExpenseSnapshot(input);
 if(snapshot.state!=='ready')return undefined;
 const before=(date:string)=>{const at=parseOneCDateTime(date);return at!==null&&+at<=captured;};
 const pending=snapshot.pending.filter(x=>before(x.date)), payable=snapshot.payable.filter(x=>before(x.date));
 let documented=0;const docs:string[]=[], refs=new Set<string>();
 for(const row of input.rows){
  const s=record(row.source), links=record(s.linkedCashExpenseOrders), execution=record(s.execution);
  const requestAt=parseOneCDateTime(text(s.date));
  if(!requestAt||requestAt.toLocaleDateString('sv-SE',{timeZone:'Europe/Moscow'})!==countedDay)continue;
  if((expenseOutstanding(s)===null&&expenseListStage(text(record(s.status).key),typeof s.amount==='number'?s.amount:null,s,true,s.deletionMark===true)!=='closed')||s.posted!==true||s.deletionMark!==false||execution.complete!==true||execution.amounts_consistent===false||links.complete!==true||links.truncated===true||!Array.isArray(links.rows))continue;
  if(!['руб','руб.','rub','rur','₽'].includes(text(record(s.currency).name).toLowerCase()))continue;
  if(!['payable','approved','not_approved'].includes(text(record(s.status).key)))continue;
  const seen=Date.parse(row.seenAt);if(!Number.isFinite(seen)||input.now-seen>360000||seen>input.now)continue;
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
