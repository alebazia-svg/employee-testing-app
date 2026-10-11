import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expenseListStage } from '../lib/expense-request-list-view';
const source = () => ({execution:{complete:true,state:'fully_executed',executed_amount:5000,remaining_amount:0},linkedCashExpenseOrders:{complete:true,rows:[{ref:'rko-one',posted:true,deletion_mark:false,amount:5000,request_amount:5000,executed_amount:5000,source_paths:['payment_line.request']}]}});
test('payable remains active until complete direct cash issue evidence is present', () => {
 assert.equal(expenseListStage('payable',5000,{},true,false),'issuance');
 assert.equal(expenseListStage('payable',5000,source(),true,false),'closed');
 assert.equal(expenseListStage('payable',5000,source(),false,false),'issuance');
 const partial=source();partial.execution.executed_amount=2000;partial.execution.remaining_amount=3000;
 assert.equal(expenseListStage('payable',5000,partial,true,false),'issuance');
});
test('duplicates, reversed orders, indirect links and incomplete results cannot close a request', () => {
 for(const change of [
  (s:ReturnType<typeof source>)=>s.linkedCashExpenseOrders.rows.push(s.linkedCashExpenseOrders.rows[0]),
  (s:ReturnType<typeof source>)=>{s.linkedCashExpenseOrders.rows[0].posted=false;},
  (s:ReturnType<typeof source>)=>{s.linkedCashExpenseOrders.rows[0].source_paths=['comment'];},
  (s:ReturnType<typeof source>)=>{s.linkedCashExpenseOrders.complete=false;},
  (s:ReturnType<typeof source>)=>{s.linkedCashExpenseOrders.rows[0].request_amount=1000;},
 ]){const s=source();change(s);assert.equal(expenseListStage('payable',5000,s,true,false),'issuance');}
});
test('unknown status needs review; not approved and intermediate approved still need owner decision',()=>{
 assert.equal(expenseListStage('unknown',5000,{},true,false),'check');
 assert.equal(expenseListStage('not_approved',5000,{},true,false),'decision');
 assert.equal(expenseListStage('approved',5000,{},true,false),'decision');
 assert.equal(expenseListStage('rejected',5000,{},true,false),'closed');
});
