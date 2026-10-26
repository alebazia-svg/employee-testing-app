import test from 'node:test';
import assert from 'node:assert/strict';
import { handoverCashExpenses, handoverExpenseLabel } from '../lib/handover-cash-expenses';
import { handoverCashResult } from '../lib/workday-handover-view';
const now=Date.parse('2026-10-25T18:40:00+03:00');
function source(status='not_approved',paid=false){return {
 ref:'request',number:'001141',date:'25.10.2026 17:00:00',amount:16000,posted:true,deletionMark:false,
 status:{key:status},cashbox:{ref:'cash'},currency:{name:'руб'},paymentForm:{cash:true,cashless:false,card:false},
 completeness:{complete:true},execution:{complete:true,state:paid?'fully_executed':'not_executed',amounts_consistent:true,executed_amount:paid?16000:0,remaining_amount:paid?0:16000},
 linkedCashExpenseOrders:{complete:true,rows:paid?[{ref:'rko',number:'001958',date:'25.10.2026 18:28:45',posted:true,deletion_mark:false,amount:16000,request_amount:16000,executed_amount:16000,request_amount_conflict:false,cashbox:{ref:'cash'},source_paths:['payment_line.request']}]:[]}
};}
const input=(s:unknown)=>({actual:2390,expected:18390,capturedAt:'2026-10-25T18:01:00+03:00',cashboxRef:'cash',uniqueOwner:true,complete:true,checkedAt:new Date(now-1000).toISOString(),now,rows:[{source:s,seenAt:new Date(now-1000).toISOString(),cycle:1}]});
test('same shortage moves from owner approval to employee RKO then documented without changing count',()=>{
 const pending=handoverCashExpenses(input(source()))!;
 assert.equal(pending.state,'awaiting_approval');assert.equal(pending.approvalAmount,16000);assert.equal(pending.payableAmount,0);
 assert.equal(handoverExpenseLabel(pending),'К согласованию');
 const payable=handoverCashExpenses(input(source('payable')))!;
 assert.equal(payable.state,'awaiting_documents');assert.equal(payable.payableAmount,16000);
 const paid=handoverCashExpenses(input(source('payable',true)))!;
 assert.equal(paid.state,'documented');assert.deepEqual(paid.documentRefs,['rko']);
 const check={status:'waiting' as const,actual:2390,expected:18390,handoverExpenses:pending};
 assert.deepEqual(handoverCashResult(2390,check),{label:'К согласованию',tone:'amber',difference:16000});
 assert.equal(handoverCashResult(2390,{...check,handoverExpenses:paid}).label,'Подтверждено расходником');
});
test('late multi-cashbox request is explained only by direct own-cashbox RKO allocation',()=>{
 const s=source('payable',true);s.cashbox.ref='';s.date='25.10.2026 18:09:01';s.amount=103000;s.execution.executed_amount=103000;
 s.linkedCashExpenseOrders.rows.push({...s.linkedCashExpenseOrders.rows[0],ref:'other1',amount:50000,request_amount:50000,executed_amount:50000,cashbox:{ref:'liana'}},{...s.linkedCashExpenseOrders.rows[0],ref:'other2',amount:37000,request_amount:37000,executed_amount:37000,cashbox:{ref:'reserve'}});
 assert.equal(handoverCashExpenses(input(s))?.documentedAmount,16000);
 s.linkedCashExpenseOrders.rows[0].cashbox.ref='other';assert.equal(handoverCashExpenses(input(s)),null);
});
test('no false explanation on mismatched amount, late unallocated request, reversed RKO, stale or incomplete data',()=>{
 const pending=source();pending.date='25.10.2026 18:09:01';assert.equal(handoverCashExpenses(input(pending)),null);
 for(const change of [
 (s:ReturnType<typeof source>)=>{s.linkedCashExpenseOrders.rows[0].posted=false;},
 (s:ReturnType<typeof source>)=>{s.linkedCashExpenseOrders.rows[0].request_amount_conflict=true;},
 (s:ReturnType<typeof source>)=>{s.linkedCashExpenseOrders.complete=false;},
 (s:ReturnType<typeof source>)=>{s.linkedCashExpenseOrders.rows[0].date='25.10.2026 17:59:00';},
 (s:ReturnType<typeof source>)=>{s.linkedCashExpenseOrders.rows[0].date='26.10.2026 18:28:00';},
 ]){const s=source('payable',true);change(s);assert.ok(handoverCashExpenses(input(s))==null);}
 assert.equal(handoverCashExpenses({...input(source()),actual:2391}),null);
 assert.equal(handoverCashExpenses({...input(source()),complete:false}),undefined);
 assert.equal(handoverCashExpenses({...input(source()),uniqueOwner:false}),undefined);
 assert.equal(handoverCashExpenses({...input(source()),checkedAt:new Date(now-400000).toISOString()}),undefined);
});

test('partial own-cashbox RKO and outstanding balance together explain the count',()=>{
 const s=source('payable',true);
 s.execution.state='partially_executed';s.execution.executed_amount=6000;s.execution.remaining_amount=10000;
 Object.assign(s.linkedCashExpenseOrders.rows[0],{amount:6000,request_amount:6000,executed_amount:6000});
 const evidence=handoverCashExpenses(input(s))!;
 assert.equal(evidence.state,'awaiting_documents');assert.equal(evidence.payableAmount,10000);assert.equal(evidence.documentedAmount,6000);
 s.linkedCashExpenseOrders.rows[0].cashbox.ref='other';
 assert.equal(handoverCashExpenses(input(s)),undefined,'partial foreign-cashbox payment remains uncertain, never proves own shortage');
});
test('mixed pending and payable requests preserve both owners and amounts',()=>{
 const a=source(),b=source('payable');a.amount=6000;a.execution.remaining_amount=6000;b.ref='second';b.amount=10000;b.execution.remaining_amount=10000;
 const data=input(a);data.rows.push({source:b,seenAt:new Date(now-1000).toISOString(),cycle:1});
 const evidence=handoverCashExpenses(data)!;
 assert.equal(evidence.approvalAmount,6000);assert.equal(evidence.payableAmount,10000);
});


test('recovered source rechecks the original count; source gaps and reversals never fabricate a match',()=>{
 const paid=source('payable',true), original=input(paid);
 const saved=JSON.stringify(original);
 assert.equal(handoverCashExpenses({...original,complete:false}),undefined);
 assert.equal(handoverCashExpenses(original)?.state,'documented');
 assert.equal(JSON.stringify(original),saved,'facts and original timestamps are immutable');
 const reversed=source('payable',false);
 assert.equal(handoverCashExpenses(input(reversed))?.state,'awaiting_documents');
 assert.equal(handoverCashExpenses({...original,rows:original.rows.map(r=>({...r,seenAt:new Date(now-400000).toISOString()}))}),undefined,'stale paid rows do not prove a reversal');
 const unknown=source('payable',true); unknown.linkedCashExpenseOrders.complete=false;
 assert.equal(handoverCashExpenses(input(unknown)),undefined,'an incomplete linked-order source cannot exonerate or accuse');
 const foreign=source('payable',true);foreign.cashbox.ref='foreign';foreign.linkedCashExpenseOrders.rows[0].cashbox.ref='foreign';
 assert.equal(handoverCashExpenses(input(foreign)),null,'same amount in another cashbox is not evidence');
});


test('paid multi-cashbox rows with provider errors or truncated branches remain unknown',()=>{
 for(const branch of ['execution','linkedCashExpenseOrders'] as const){
  for(const invalid of [{errors:['permission_denied']},{missing_fields:['date']},{truncated:true}]) {
   const s=source('payable',true);s.cashbox.ref='';
   Object.assign(s[branch],invalid);
   assert.equal(handoverCashExpenses(input(s)),undefined);
  }
 }
});

 test('later same-cashbox expense does not contaminate an earlier documented count',()=>{
 const paid=source('payable',true),later=source('payable',true);
 later.ref='later-request';later.date='25.10.2026 18:15:00';later.amount=500;later.execution.executed_amount=500;
 Object.assign(later.linkedCashExpenseOrders.rows[0],{ref:'later-order',amount:500,request_amount:500,executed_amount:500});
 const data=input(paid);data.rows.push({source:later,seenAt:new Date(now-1000).toISOString(),cycle:1});
 const result=handoverCashExpenses(data)!;assert.equal(result.state,'documented');assert.equal(result.documentedAmount,16000);assert.deepEqual(result.documentRefs,['rko']);
 });
