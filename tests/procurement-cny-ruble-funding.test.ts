import test from 'node:test';
import assert from 'node:assert/strict';
import {matchProcurementPaymentEvidence,type EvidencePlan} from '../lib/procurement-currency-payment-evidence';
import type {SupplierCurrencyPaymentRow} from '../lib/procurement-currency-payment-source';
import {SMALL_REMAINDER_COMPLETED,smallForeignRubleFundingRemainder} from '../lib/procurement-small-remainder';
import {needsReceiptSinceRollout} from '../lib/procurement-receipt-policy';

const plan:EvidencePlan={id:'cny',planCode:'CNY-TEST',supplierPartner:'Supplier CNY',supplierCounterparty:'',
  orderRefs:['order-cny'],plannedAmount:20666.1,paymentMethod:'CNY',currency:'CNY',foreignAmount:1514,
  status:'APPROVED',createdAt:'2026-11-06T08:00:00Z',plannedDate:'2026-11-06'};
const rub:SupplierCurrencyPaymentRow={ref:'rko-cny',number:'TEST',date:'06.11.2026 17:06:13',posted:true,deleted:false,
  documentAmount:20660,documentCurrency:'РУБ',baseDocumentRef:'order-cny',supplier:'Supplier CNY'};
const match=(plans=[plan],payments=[rub],complete=true,requests:any[]=[])=>
  matchProcurementPaymentEvidence(plans,requests,payments,[],{allowSmallRemainder:complete});

test('CNY RUB funding closes small conversion remainders and preserves source money and receipt requirement',()=>{
  for(const [plannedAmount,paid,foreignAmount,remainder] of [[20666.1,20660,1514,6.1],[302347.5,302340,22150,7.5]]){
    const p={...plan,plannedAmount,foreignAmount};
    const row=match([p],[{...rub,documentAmount:paid}]).get(p.id)!;
    assert.equal(row.state,SMALL_REMAINDER_COMPLETED);
    assert.equal(row.issuedAmount,paid);assert.equal(row.remainingAmount,remainder);
    assert.equal(row.paidAmount,0);assert.equal(row.paidForeignAmount,0);
    assert.equal(row.actualExchangeRate,null);assert.equal(row.remainingForeignAmount,null);
    assert.deepEqual(row.currencyPayments,[]);assert.deepEqual(row.cashOrders.map(r=>r.ref),[rub.ref]);
    assert.equal(needsReceiptSinceRollout({...p,evidence:row},0),true);
    assert.equal(needsReceiptSinceRollout({...p,evidence:row},1),false);
    assert.equal(match([p],[{...rub,documentAmount:paid}],false).get(p.id)!.state,'PARTIALLY_ISSUED');
  }
});

test('CNY funding enforces both inclusive limits, status, currency and revision guards',()=>{
  for(const [target,paid,closed] of [[25000,24500,true],[24999,24499,false],
    [100000,99499.99,false],[1000,980,true],[1000,979.99,false]] as const){
    const p={...plan,plannedAmount:target};
    assert.equal(match([p],[{...rub,documentAmount:paid}]).get(p.id)!.state===SMALL_REMAINDER_COMPLETED,closed);
  }
  for(const changes of [{hasPendingRevision:true},{status:'SUBMITTED'},{status:'CANCELLED'},{currency:'USDT'},
    {plannedAmount:NaN},{plannedAmount:20666.101}]){
    assert.equal(smallForeignRubleFundingRemainder({...plan,...changes},20660),null);
  }
  assert.equal(match([{...plan,hasPendingRevision:true}]).get(plan.id)!.state,'PARTIALLY_ISSUED');
});

test('CNY completion still requires independent posted exact RKO proof, not a saved/native paid flag',()=>{
  const request:any={ref:'native',comment:plan.planCode,partner:{name:plan.supplierPartner},amount:plan.plannedAmount,
    linked_cash_expense_orders:{rows:[{ref:rub.ref,number:rub.number,date:rub.date,amount:rub.documentAmount,
      executed_amount:rub.documentAmount,posted:true,deletion_mark:false}]}};
  assert.equal(match([plan],[rub],true,[request]).get(plan.id)!.state,SMALL_REMAINDER_COMPLETED);
  for(const rows of [[],[{...rub,posted:false}],[{...rub,deleted:true}],[{...rub,supplier:'Other'}],
    [{...rub,baseDocumentRef:''}],[rub,{...rub,documentAmount:20000}]]){
    assert.notEqual(match([plan],rows,true,[request]).get(plan.id)!.state,SMALL_REMAINDER_COMPLETED);
  }
});

test('orderless CNY funding requires a confirmed native contract and cannot guess between requests',()=>{
  const p={...plan,orderRefs:[]};
  const payment={...rub,baseDocumentRef:'',contract:'Contract CNY'};
  assert.equal(match([p],[payment]).get(p.id)!.state,SMALL_REMAINDER_COMPLETED);
  assert.notEqual(match([p],[{...payment,contract:''}]).get(p.id)!.state,SMALL_REMAINDER_COMPLETED);
  const ambiguous=match([p,{...p,id:'other',planCode:'OTHER'}],[payment]);
  for(const row of ambiguous.values()){assert.equal(row.state,'NEEDS_REVIEW');assert.equal(row.issuedAmount,0);}
});

test('CNY split cashboxes sum once and subsequent requests retain their own RKO',()=>{
  const p={...plan,plannedAmount:28500};
  const a={...rub,ref:'a',documentAmount:20000,cashbox:'First'};
  const b={...rub,ref:'b',documentAmount:8200,cashbox:'Second'};
  const row=match([p],[a,b,a]).get(p.id)!;
  assert.equal(row.state,SMALL_REMAINDER_COMPLETED);assert.equal(row.issuedAmount,28200);
  assert.equal(row.cashOrders.length,2);
  for(const rows of [[a],[a,{...b,posted:false}],[a,{...b,deleted:true}]]){
    assert.notEqual(match([p],rows).get(p.id)!.state,SMALL_REMAINDER_COMPLETED);
  }
  const next={...plan,id:'next',planCode:'NEXT',plannedAmount:10000,createdAt:'2026-11-06T14:30:00Z'};
  const later={...rub,ref:'later',date:'06.11.2026 18:00:00',documentAmount:10000};
  for(const plans of [[plan,next],[next,plan]]){
    const result=match(plans,[later,rub]);
    assert.equal(result.get(plan.id)!.state,SMALL_REMAINDER_COMPLETED);
    assert.equal(result.get(next.id)!.state,'ISSUED_BY_ONE_C');
    assert.deepEqual(result.get(plan.id)!.cashOrders.map(p=>p.ref),[rub.ref]);
    assert.deepEqual(result.get(next.id)!.cashOrders.map(p=>p.ref),[later.ref]);
    assert.equal(match(plans,[later]).get(next.id)!.state,'NEEDS_REVIEW');
  }
});
