import test from 'node:test';
import assert from 'node:assert/strict';
import {completionRemainder,COMPLETED_WITHOUT_TOPUP} from '../lib/procurement-payment-completion';
import {attachSettlementOrderLinks} from '../lib/procurement-settlement-payment-link';
import {matchProcurementPaymentEvidence} from '../lib/procurement-currency-payment-evidence';
import {calculateOrderPlanning} from '../lib/procurement-payment-control';
import {usdtReservedByPlans} from '../lib/procurement-usdt-reserve';

const now=new Date('2026-09-26T10:00:00Z');
const payment={ref:'rko',date:'26.09.2026 12:28:02',number:'1759',posted:true,deleted:false,documentAmount:74900,documentCurrency:'РУБ',baseDocumentRef:'',supplier:'Supplier'};
const movement={source_recorder_ref:'rko',settlement_object_ref:'order',settlement_document_ref:'rko',movement_date:payment.date,movement_type:'Приход',raw_debt:0,raw_prepayment:74900,currency_name:'руб'};
const detail={ok:true,complete:true,write_operations:false,contract_version:'supplier-document-evidence-v1',as_of:'26.09.2026 13:00:00',order:[{order_ref:'order',supplier_name:'Supplier',posted:true,deleted:false}],due_date_movements:[movement]};
const plan={id:'one',planCode:'PAY-ONE',supplierPartner:'Supplier',supplierCounterparty:'',orderRefs:['order'],plannedAmount:75000,paymentMethod:'CASH',status:'APPROVED',createdAt:'2026-09-25T00:00:00Z'};
test('exact settlement movement finds an RKO with no header basis; duplicate documents do not double payment',()=>{
  const linked=attachSettlementOrderLinks([payment,payment],[detail],now);
  assert.equal(linked[0].settlementOrderRef,'order');
  const e=matchProcurementPaymentEvidence([plan],[],linked,[]).get('one')!;
  assert.equal(e.issuedAmount,74900);assert.equal(e.remainingAmount,100);assert.equal(e.state,'PARTIALLY_ISSUED');
});
test('no fuzzy links, partial allocations, repeated movements, conflicting orders or incomplete sources',()=>{
  for(const changes of [{raw_prepayment:100},{raw_debt:1},{movement_type:'Расход'},{currency_name:'USDT'},{settlement_document_ref:'other'},{movement_date:'26.09.2026 12:28:03'}]){
    assert.equal(attachSettlementOrderLinks([payment],[{...detail,due_date_movements:[{...movement,...changes}]}],now)[0].settlementOrderRef,undefined);
  }
  assert.equal(attachSettlementOrderLinks([{...payment,supplier:'Other'}],[detail],now)[0].settlementOrderRef,undefined);
  assert.equal(attachSettlementOrderLinks([payment],[{...detail,due_date_movements:[movement,movement]}],now)[0].settlementOrderRef,undefined);
  assert.equal(attachSettlementOrderLinks([payment],[detail,{...detail,order:[{...detail.order[0],order_ref:'other'}],due_date_movements:[{...movement,settlement_object_ref:'other'}]}],now)[0].settlementOrderRef,undefined);
  for(const changes of [{complete:false},{as_of:'25.09.2026 13:00:00'},{write_operations:true}])assert.throws(()=>attachSettlementOrderLinks([payment],[{...detail,...changes}],now));
});
test('inactive orders remain unlinked without blocking valid orders; missing flags still fail closed',()=>{
  for(const flags of [{posted:false,deleted:false},{posted:true,deleted:true}]){
    const inactive={...detail,order:[{...detail.order[0],...flags}]};
    assert.equal(attachSettlementOrderLinks([payment],[inactive],now)[0].settlementOrderRef,undefined);
    assert.equal(attachSettlementOrderLinks([payment],[inactive,detail],now)[0].settlementOrderRef,'order');
  }
  assert.throws(()=>attachSettlementOrderLinks([payment],[{...detail,order:[{...detail.order[0],posted:undefined}]}],now));
});
test('completed request keeps old payment; next payment goes only to the new request',()=>{
  const closed={...plan,status:COMPLETED_WITHOUT_TOPUP,completedPaymentRefs:['rko']};
  const linked={...payment,baseDocumentRef:'order'};
  const e=matchProcurementPaymentEvidence([{...plan,id:'new',planCode:'PAY-NEW'},closed],[],[linked,{...linked,ref:'new-rko',documentAmount:100}],[]);
  assert.equal(e.get('one')!.issuedAmount,74900);assert.equal(e.get('new')!.issuedAmount,100);
});
test('completed USDT request keeps old payment without swallowing later payment',()=>{
  const closed={...plan,paymentMethod:'USDT',foreignAmount:100,status:COMPLETED_WITHOUT_TOPUP,completedPaymentRefs:['rko']};
  const p={...payment,documentCurrency:'USDT',baseDocumentRef:'order',documentAmount:99};
  const e=matchProcurementPaymentEvidence([{...plan,id:'new',paymentMethod:'USDT',foreignAmount:100},closed],[],[p,{...p,ref:'new-rko',documentAmount:1}],[]);
  assert.equal(e.get('one')!.paidForeignAmount,99);assert.equal(e.get('new')!.paidForeignAmount,1);
});
test('only confirmed partial payments can be completed; remainder is not rounded away',()=>{
  const e={state:'PARTIALLY_ISSUED',issuedAmount:74999.99,paidAmount:0,paidForeignAmount:0,remainingForeignAmount:null};
  assert.deepEqual(completionRemainder(plan,e),{remainingAmount:0.01,remainingForeignAmount:null});
  for(const state of ['NO_EVIDENCE','NEEDS_REVIEW','MISMATCH','ISSUED_BY_ONE_C'])assert.throws(()=>completionRemainder(plan,{...e,state}));
  assert.throws(()=>completionRemainder(plan,{...e,paymentAmountNeedsConfirmation:true}));
  assert.deepEqual(completionRemainder({...plan,paymentMethod:'USDT',foreignAmount:100},{...e,state:'PARTIALLY_PAID_BY_ONE_C',issuedAmount:0,paidForeignAmount:99,remainingForeignAmount:1}),{remainingAmount:75000,remainingForeignAmount:1});
});
test('closed residual is excluded from order and USDT reservations, not supplier balances',()=>{
  assert.equal(calculateOrderPlanning([{ref:'order',orderPaymentGap:100}], [{...plan,status:COMPLETED_WITHOUT_TOPUP}])[0].plannedActiveAmount,0);
  assert.equal(usdtReservedByPlans([{...plan,paymentMethod:'USDT',foreignAmount:100,status:COMPLETED_WITHOUT_TOPUP}],90),0);
});
