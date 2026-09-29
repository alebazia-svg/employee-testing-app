import test from 'node:test';
import assert from 'node:assert/strict';
import {attachSettlementOrderLinks} from '../lib/procurement-settlement-payment-link';
import {matchProcurementPaymentEvidence} from '../lib/procurement-currency-payment-evidence';

const now=new Date('2026-09-29T11:00:00Z');
const payment={ref:'rko',number:'1781',date:'29.09.2026 13:50:57',posted:true,deleted:false,
  documentAmount:2725.45,documentCurrency:'USDT',baseDocumentRef:'',supplier:'Supplier',
  settlementAmount:212585.1,settlementCurrency:'руб',settlementMovementsCount:1};
const movement={source_recorder_ref:'rko',settlement_document_ref:'rko',settlement_object_ref:'order',
  movement_date:payment.date,movement_type:'Приход',raw_debt:0,raw_prepayment:212585.1,currency_name:'руб'};
const detail={ok:true,complete:true,write_operations:false,contract_version:'supplier-document-evidence-v1',
  as_of:now.toISOString(),order:[{order_ref:'order',supplier_name:'Supplier',posted:true,deleted:false}],due_date_movements:[movement]};
const plan={id:'plan',planCode:'PAY-TEST',supplierPartner:'Supplier',supplierCounterparty:'',orderRefs:['order'],
  plannedAmount:242124.5,foreignAmount:2720.5,paymentMethod:'USDT',status:'APPROVED',createdAt:'2026-09-28T12:00:00Z'};
const linked=()=>attachSettlementOrderLinks([payment],[detail],now);

test('exact whole FX settlement closes request in document currency, preserving excess separately',()=>{
  assert.equal(linked()[0].settlementOrderRef,'order');
  const e=matchProcurementPaymentEvidence([plan],[],linked(),[]).get(plan.id)!;
  assert.equal(e.state,'PAID_BY_ONE_C');assert.equal(e.remainingForeignAmount,0);
  assert.equal(e.paidForeignAmount,2720.5);assert.equal(e.paidAmount,0);assert.equal(e.actualExchangeRate,null);
  assert.equal(e.currencyPayments[0].documentForeignAmount,2725.45);
  assert.equal(e.currencyPayments[0].unallocatedForeignAmount,4.95);
  assert.equal(e.paidForeignAmount+e.currencyPayments[0].unallocatedForeignAmount!,payment.documentAmount);
});
test('partial, missing, conflicting or mixed-currency register evidence never assigns full USDT document',()=>{
  for(const change of [{settlementAmount:undefined},{settlementAmount:NaN},{settlementAmount:0},
    {settlementAmount:212585.11},{settlementCurrency:''},{settlementCurrency:'USDT'},
    {settlementMovementsCount:undefined},{settlementMovementsCount:2},{posted:false},{deleted:true}]){
    assert.equal(attachSettlementOrderLinks([{...payment,...change}],[detail],now)[0].settlementOrderRef,undefined);
  }
  for(const change of [{raw_prepayment:2725.45},{raw_debt:1},{settlement_document_ref:'other'},
    {source_recorder_ref:'other'},{currency_name:'USDT'},{movement_type:'Расход'},
    {movement_date:'29.09.2026 13:50:58'}]){
    assert.equal(attachSettlementOrderLinks([payment],[{...detail,due_date_movements:[{...movement,...change}]}],now)[0].settlementOrderRef,undefined);
  }
  assert.equal(attachSettlementOrderLinks([payment],[{...detail,due_date_movements:[movement,movement]}],now)[0].settlementOrderRef,undefined);
});
test('duplicate rows do not duplicate money, changed evidence reopens request',()=>{
  const p=linked()[0];
  assert.equal(matchProcurementPaymentEvidence([plan],[],[p,p],[]).get(plan.id)!.paidForeignAmount,2720.5);
  for(const rows of [[],[p,{...p,settlementAmount:1}],[{...p,posted:false}],[{...p,deleted:true}]]){
    assert.equal(matchProcurementPaymentEvidence([plan],[],rows,[]).get(plan.id)!.paidForeignAmount,0);
  }
  assert.equal(attachSettlementOrderLinks([p],[{...detail,due_date_movements:[]}],now)[0].settlementOrderRef,undefined);
});
test('register link never guesses between open requests or consumes another supplier/future/unapproved request',()=>{
  const ambiguous=matchProcurementPaymentEvidence([plan,{...plan,id:'other'}],[],linked(),[]);
  for(const e of ambiguous.values())assert.equal(e.paidForeignAmount,0);
  for(const change of [{supplierPartner:'Other'},{createdAt:'2026-09-30T00:00:00Z'},
    {createdAt:undefined},{status:'SUBMITTED'},{status:'CANCELLED'},{orderRefs:['other']}]){
    assert.equal(matchProcurementPaymentEvidence([{...plan,...change}],[],linked(),[]).get(plan.id)!.paidForeignAmount,0);
  }
});
test('paid earlier request no longer competes; excess is not reused for a future request',()=>{
  const earlier={...plan,id:'earlier',foreignAmount:100,createdAt:'2026-09-25T00:00:00Z'};
  const prior={...linked()[0],ref:'old-rko',date:'27.09.2026 12:00:00',documentAmount:100};
  const later={...plan,id:'future',createdAt:'2026-09-30T00:00:00Z'};
  const e=matchProcurementPaymentEvidence([later,plan,earlier],[],[...linked(),prior],[]);
  assert.equal(e.get(earlier.id)!.paidForeignAmount,100);
  assert.equal(e.get(plan.id)!.paidForeignAmount,2720.5);
  assert.equal(e.get(later.id)!.paidForeignAmount,0);
  assert.equal(e.get(plan.id)!.currencyPayments[0].unallocatedForeignAmount,4.95);
});
