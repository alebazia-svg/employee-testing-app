import test from 'node:test';
import assert from 'node:assert/strict';
import {compatiblePaymentOrders,singlePaymentRequest} from '../lib/procurement-single-payment';
import {validatePaymentPlan} from '../lib/procurement-payment-control';
import {usdtReservedByPlans} from '../lib/procurement-usdt-reserve';

const order={ref:'one',number:'445',supplierPartner:'Supplier',supplierCounterparty:'legal-one'};
const draft={plannedDate:'2026-10-12',plannedAmount:'8950',paymentMethod:'USDT',foreignAmount:'100',exchangeRate:'89.5',fundingSource:'CASH_EXCHANGE',condition:''};

test('new payment has one order, one amount and date without assigning funding',()=>{
  const request=singlePaymentRequest([order],draft);
  assert.equal(request.url,'/api/procurement/payment-plans');
  assert.ok('orderRefs' in request.body);
  assert.deepEqual(request.body.orderRefs,['one']);
  assert.equal(request.body.plannedAmount,'8950');
  assert.equal(request.body.foreignAmount,'100');
  assert.equal(request.body.fundingSource,null);
  assert.equal(request.body.plannedDate,'2026-10-12');
  assert.equal('rows' in request.body,false);
});
test('do not combine different suppliers, counterparties or settlement bases',()=>{
  for(const next of [{...order,ref:'two',supplierPartner:'Other'},{...order,ref:'two',supplierCounterparty:'other-legal'},{...order,ref:'debt:Supplier'}]){
    assert.equal(compatiblePaymentOrders(order,next),false);
    assert.throws(()=>singlePaymentRequest([order,next],draft));
  }
});
test('reject empty choice and repeated order',()=>{
  assert.throws(()=>singlePaymentRequest([],draft));
  assert.throws(()=>singlePaymentRequest([order,order],draft));
  assert.throws(()=>singlePaymentRequest([order,{...order,ref:'two'}],draft));
});
test('USDT can still be requested from a known RUB amount without invented FX values',()=>{
  const request=singlePaymentRequest([order],{...draft,plannedAmount:'10000',foreignAmount:'',exchangeRate:''});
  const checked=validatePaymentPlan(request.body);
  assert.equal(checked.ok,true);
  assert.equal(checked.data.plannedAmount,10000);
  assert.equal(checked.data.currency,'USDT');
  assert.equal(checked.data.foreignAmount,null);
  assert.equal(checked.data.exchangeRate,null);
  assert.equal(checked.data.fundingSource,null);
});
test('historical multi-order requests remain supported by the edit validation contract',()=>{
  const checked=validatePaymentPlan({...draft,supplierPartner:'Supplier',orderRefs:['one','two'],orderNumbers:['445','440']});
  assert.equal(checked.ok,true);
  assert.deepEqual(checked.data.orderRefs,['one','two']);
});
test('debt uses supported existing endpoint with exactly one payment',()=>{
  const request=singlePaymentRequest([{...order,ref:'debt:Supplier',number:''}],{...draft,paymentMethod:'CASH'});
  assert.equal(request.url,'/api/procurement/payment-plans/batch');
  assert.ok('rows' in request.body);
  assert.equal(request.body.rows?.length,1);
  assert.equal(request.body.rows?.[0].basis,'DEBT');
  assert.equal(request.body.rows?.[0].plannedAmount,'8950');
  assert.equal(request.body.rows?.[0].fundingSource,null);
});
test('CNY keeps currency and excludes USDT cash source',()=>{
  const request=singlePaymentRequest([order],{...draft,paymentMethod:'CNY'});
  assert.ok('currency' in request.body);
  assert.equal(request.body.currency,'CNY');
  assert.equal(request.body.fundingSource,null);
});
test('buyer USDT request is valid without a source and remains in summary demand',()=>{
  const request=singlePaymentRequest([order],draft);
  const checked=validatePaymentPlan(request.body);
  assert.equal(checked.ok,true);
  assert.equal(checked.data.fundingSource,null);
  assert.equal(checked.data.plannedAmount,8950);
  assert.equal(usdtReservedByPlans([{status:'SUBMITTED',paymentMethod:'USDT',plannedAmount:8950,foreignAmount:100,fundingSource:checked.data.fundingSource}],89.5),100);
});
