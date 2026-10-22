import test from 'node:test';
import assert from 'node:assert/strict';
import { employeeExpenseSnapshot, expenseOutstanding, expenseNotificationKey } from '../lib/employee-expense-policy';
import { pendingCashExpenseEvidence, confirmCashExpenseDocuments } from '../lib/cash-expense-evidence';
const now = Date.parse('2026-10-21T12:00:00Z');
const source = (remaining = 3000, status = 'not_approved') => ({ ref: 'request-a', number: '001120', date: '21.10.2026 10:00:00', amount: 3000, posted: true, deletionMark: false,
  status: { key: status }, cashbox: { ref: 'own-cashbox' }, currency: {name:'руб'}, paymentForm: {cash:true,cashless:false,card:false}, counterparty: {name:'Доставка'},
  execution: { complete:true, executed_amount:3000-remaining, remaining_amount:remaining }, linkedCashExpenseOrders: { complete:true, rows: remaining === 3000 ? [] : [{ref:'rko',posted:true,deletion_mark:false,date:'21.10.2026 15:01:00',amount:3000-remaining,request_amount:3000-remaining,executed_amount:3000-remaining,cashbox:{ref:'own-cashbox'},source_paths:['payment_line.request']}] } });
const snapshot = (rows = [source()], extra = {}) => employeeExpenseSnapshot({cashboxRef:'own-cashbox',uniqueOwner:true,complete:true,checkedAt:new Date(now-1000).toISOString(),now,rows:rows.map(source=>({source,seenAt:new Date(now-2000).toISOString(),cycle:1})),...extra});
test('own pending, payable, partial and fully posted requests have distinct outcomes',()=>{
 assert.equal(snapshot().pending.length,1);
 assert.equal(snapshot([source(3000,'payable')]).payable.length,1);
 assert.equal(snapshot([source(1000,'payable')]).payable[0].remaining,1000);
 assert.equal(snapshot([source(0,'payable')]).payable.length,0);
 assert.equal(expenseOutstanding(source(0)),0);
});
test('cashbox ownership, freshness and payment form fail closed without borrowing a colleague request',()=>{
 const foreign=source();foreign.cashbox.ref='someone-else'; assert.equal(snapshot([foreign]).pending.length,0);
 assert.equal(snapshot(undefined,{uniqueOwner:false}).state,'unmapped');
 assert.equal(snapshot(undefined,{complete:false}).state,'unavailable');
 assert.equal(snapshot(undefined,{checkedAt:new Date(now-400000).toISOString()}).state,'unavailable');
 const card=source();card.paymentForm={cash:false,cashless:false,card:true};assert.equal(snapshot([card]).pending.length,0);
 const unavailable=snapshot(undefined,{complete:false});assert.deepEqual(unavailable.payable,[]);
});
test('duplicates, reversed orders, foreign cashboxes, indirect links and allocation conflicts do not confirm execution',()=>{
 for(const mutate of [
  (s:ReturnType<typeof source>)=>s.linkedCashExpenseOrders.rows.push(s.linkedCashExpenseOrders.rows[0]),
  (s:ReturnType<typeof source>)=>{s.linkedCashExpenseOrders.rows[0].posted=false},
  (s:ReturnType<typeof source>)=>{s.linkedCashExpenseOrders.rows[0].source_paths=['comment']},
  (s:ReturnType<typeof source>)=>{s.linkedCashExpenseOrders.rows[0].request_amount=1},
  (s:ReturnType<typeof source>)=>{s.execution.complete=false},
 ]){const s=source(0);mutate(s);assert.equal(expenseOutstanding(s),null);assert.equal(snapshot([s]).state,'unavailable')}
});
test('fully settled requests paid from another cashbox do not disable current work or prove this cashbox balance',()=>{
 const paid=source(0,'payable');paid.linkedCashExpenseOrders.rows[0].cashbox.ref='other';
 assert.equal(expenseOutstanding(paid),null,'foreign cash cannot prove a recount');
 assert.equal(snapshot([paid]).state,'ready');
 assert.equal(snapshot([paid]).payable.length,0);
 const pending=source();pending.ref='pending-request';
 assert.equal(snapshot([paid,pending]).pending.length,1,'an old settled request must not suppress current pending work');
 const partial=source(1000,'payable');partial.linkedCashExpenseOrders.rows[0].cashbox.ref='other';
 assert.equal(snapshot([partial]).state,'unavailable','partial cross-cashbox execution still needs review');
 const inconsistent=source(0,'payable');inconsistent.linkedCashExpenseOrders.rows[0].executed_amount=1;
 assert.equal(snapshot([inconsistent]).state,'unavailable');
});
test('only an exact full pending amount explains a shortage; never a surplus or arbitrary subset',()=>{
 const input={actual:17000,expected:20000,capturedAt:new Date(now).toISOString(),cashboxRef:'own-cashbox',snapshot:snapshot()};
 const evidence=pendingCashExpenseEvidence(input)!;
 assert.equal(evidence.state,'awaiting_documents');
 for(const actual of [17000.01,19999,23000,20000])assert.equal(pendingCashExpenseEvidence({...input,actual}),undefined);
 assert.equal(pendingCashExpenseEvidence({...input,snapshot:snapshot([source(3000,'payable')])}),undefined);
 assert.equal(pendingCashExpenseEvidence({...input,snapshot:snapshot(undefined,{complete:false})}),undefined);
 assert.deepEqual(confirmCashExpenseDocuments(evidence,input.capturedAt,[source(0)]),['rko']);
 const before=source(0);before.linkedCashExpenseOrders.rows[0].date='21.10.2026 14:00:00';assert.equal(confirmCashExpenseDocuments(evidence,input.capturedAt,[before]),null);
 assert.equal(confirmCashExpenseDocuments(evidence,input.capturedAt,[source(1000)]),null);
});
test('notification identity is stable on partial posting and changes only on approval cycle or owner',()=>{
 const s=snapshot([source(3000,'payable')]).payable[0];
 assert.equal(expenseNotificationKey(2,'box',s),expenseNotificationKey(2,'box',{...s,remaining:1000}));
 assert.notEqual(expenseNotificationKey(2,'box',s),expenseNotificationKey(3,'box',s));
 assert.notEqual(expenseNotificationKey(2,'box',s),expenseNotificationKey(2,'box',{...s,cycle:2}));
});
