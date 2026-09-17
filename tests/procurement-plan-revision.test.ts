import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePaymentPlan} from '../lib/procurement-payment-control';
import {assertRevisionPaymentSafety,revisionChanges} from '../lib/procurement-plan-revision';
const data=validatePaymentPlan({supplierPartner:'Remax',orderRefs:['order'],orderNumbers:['393'],plannedDate:'2026-09-19',plannedAmount:700000,paymentMethod:'CASH'}).data;
test('comment-only and material changes are distinguished; normalized decimals/dates are not changes',()=>{
  assert.deepEqual(revisionChanges({...data,plannedAmount:'700000.00',plannedDate:new Date('2026-09-19')},data),[]);
  assert.deepEqual(revisionChanges(data,{...data,condition:'new comment'}).map(c=>c.key),['condition']);
  assert.deepEqual(revisionChanges(data,{...data,plannedAmount:800000,plannedDate:'2026-09-20'}).map(c=>c.key),['plannedDate','plannedAmount']);
});
test('paid part is protected and completed requests are immutable',()=>{
  const paid={state:'PARTIALLY_ISSUED',issuedAmount:100000,paidAmount:0,paidForeignAmount:0};
  assert.doesNotThrow(()=>assertRevisionPaymentSafety(data,{...data,plannedAmount:200000},paid));
  for(const change of [{plannedAmount:50000},{supplierPartner:'Other'},{orderRefs:['other']},{paymentMethod:'USDT' as const}]) assert.throws(()=>assertRevisionPaymentSafety(data,{...data,...change},paid));
  assert.throws(()=>assertRevisionPaymentSafety(data,data,{...paid,state:'ISSUED_BY_ONE_C'}));
  assert.throws(()=>assertRevisionPaymentSafety(data,data,{...paid,state:'NEEDS_REVIEW'}));
});
