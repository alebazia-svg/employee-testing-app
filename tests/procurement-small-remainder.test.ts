import test from 'node:test';
import assert from 'node:assert/strict';
import { smallRubleRemainder, SMALL_REMAINDER_COMPLETED as CLOSED, isFinishedPaymentState } from '../lib/procurement-small-remainder';
import { matchProcurementPaymentEvidence, type EvidencePlan } from '../lib/procurement-currency-payment-evidence';
import type { SupplierCurrencyPaymentRow } from '../lib/procurement-currency-payment-source';
import { planningRequestOverlap } from '../lib/procurement-planning-overlap';
import { debtRequestConflict } from '../lib/procurement-debt-request';

const plan: EvidencePlan = { id:'first',planCode:'PAY-FIRST',supplierPartner:'Supplier',supplierCounterparty:'',
  orderRefs:['order'],plannedAmount:30025,paymentMethod:'BANK',currency:'RUB',status:'APPROVED',
  createdAt:'2026-10-01T09:00:00Z',plannedDate:'2026-10-03' };
const payment: SupplierCurrencyPaymentRow = {ref:'rko',number:'TEST',date:'03.10.2026 12:30:00',posted:true,deleted:false,
  documentCurrency:'РУБ',documentAmount:30000,baseDocumentRef:'order',supplier:'Supplier'};
const match=(plans=[plan],payments=[payment],allowSmallRemainder=true)=>matchProcurementPaymentEvidence(plans,[],payments,[],{allowSmallRemainder});

test('500 rubles AND one percent are inclusive, without rounding the percentage',()=>{
  for(const [target,paid,expected] of [[30025,30000,25],[30200,30000,200],[50000,49500,500],
    [49999,49499,null],[100000,99499.99,null],[1000,990,10],[1000,989.99,null],
    [1,.99,.01],[.99,.98,null],[30025,0,null],[30025,30025,null],[30025,30100,null]] as const){
    assert.equal(smallRubleRemainder({...plan,plannedAmount:target},paid),expected,`${target}/${paid}`);
  }
});
test('only approved ruble requests without a pending revision qualify',()=>{
  for(const changes of [{status:'SUBMITTED'},{status:'CANCELLED'},{status:'COMPLETED_WITHOUT_TOPUP'},
    {paymentMethod:'USDT'},{currency:'CNY'},{foreignAmount:500},{hasPendingRevision:true},
    {plannedAmount:NaN},{plannedAmount:Infinity},{plannedAmount:30025.001}]){
    assert.equal(smallRubleRemainder({...plan,...changes},30000),null);
  }
  for(const amount of [NaN,Infinity,-1,30000.001])assert.equal(smallRubleRemainder(plan,amount),null);
});
test('automatic completion retains actual amounts and exact RKO, not fully-paid evidence',()=>{
  const row=match().get('first')!;
  assert.equal(row.state,CLOSED);assert.equal(row.issuedAmount,30000);assert.equal(row.remainingAmount,25);
  assert.equal(row.paidAmount,0);assert.deepEqual(row.cashOrders.map(p=>p.ref),['rko']);
  assert.equal(row.collection,undefined);assert.equal(isFinishedPaymentState(row.state),true);
  assert.equal(match([plan],[payment],false).get('first')!.state,'PARTIALLY_ISSUED');
  assert.equal(matchProcurementPaymentEvidence([plan],[],[payment],[]).get('first')!.state,'PARTIALLY_ISSUED','incomplete/unknown source must opt out by default');
});
test('cancellation, disappearance, ambiguous ownership and conflicting copies never close',()=>{
  for(const rows of [[],[{...payment,posted:false}],[{...payment,deleted:true}],
    [{...payment,baseDocumentRef:''}],[payment,{...payment,documentAmount:29999}],
    [{...payment,documentAmount:29000}],[{...payment,documentCurrency:'USDT'}]]){
    assert.notEqual(match([plan],rows).get('first')!.state,CLOSED);
  }
  assert.equal(match([plan,{...plan,id:'second',planCode:'OTHER'}]).get('first')!.state,'NEEDS_REVIEW');
  assert.equal(match([plan],[payment,payment]).get('first')!.issuedAmount,30000);
  assert.equal(match([{...plan,hasPendingRevision:true}]).get('first')!.state,'PARTIALLY_ISSUED');
});
test('supplier-debt matching uses the same residual policy but requires a real basis',()=>{
  const debt={...plan,orderRefs:[]};
  assert.equal(match([debt],[{...payment,baseDocumentRef:'',contract:'Contract'}]).get('first')!.state,CLOSED);
  assert.notEqual(match([debt],[{...payment,baseDocumentRef:'',contract:''}]).get('first')!.state,CLOSED);
  const result=match([debt],[{...payment,baseDocumentRef:'',contract:'Contract'}]);
  assert.equal(debtRequestConflict([debt as EvidencePlan & {status:string}],'Supplier',result),false);
});
test('native request payment cannot override an absent, conflicting, unposted or baseless RKO',()=>{
  const request:any={ref:'native',comment:plan.planCode,partner:{name:'Supplier'},amount:30025,
    linked_cash_expense_orders:{rows:[{ref:'rko',number:'TEST',date:payment.date,amount:30000,executed_amount:30000,posted:true,deletion_mark:false}]}};
  const read=(rows:SupplierCurrencyPaymentRow[])=>matchProcurementPaymentEvidence([plan],[request],rows,[],{allowSmallRemainder:true}).get(plan.id)!;
  assert.equal(read([payment]).state,CLOSED);
  for(const rows of [[],[payment,{...payment,documentAmount:29900}],[{...payment,posted:false}],
    [{...payment,deleted:true}],[{...payment,baseDocumentRef:''}],[{...payment,supplier:'Other'}]]){
    assert.notEqual(read(rows).state,CLOSED);
  }
});
test('later requests cannot consume the closed request RKO and do not compete for the next one',()=>{
  const second={...plan,id:'second',planCode:'SECOND',plannedAmount:10000,createdAt:'2026-10-03T13:00:00Z'};
  const later={...payment,ref:'later',documentAmount:10000,date:'03.10.2026 17:00:00'};
  for(const plans of [[plan,second],[second,plan]]){
    const result=match(plans,[later,payment]);
    assert.equal(result.get('first')!.state,CLOSED);
    assert.equal(result.get('second')!.state,'ISSUED_BY_ONE_C');
    assert.deepEqual(result.get('first')!.cashOrders.map(p=>p.ref),['rko']);
    assert.deepEqual(result.get('second')!.cashOrders.map(p=>p.ref),['later']);
    assert.equal(match(plans,[later]).get('second')!.state,'NEEDS_REVIEW','removing the first payment restores ambiguity');
  }
  assert.equal(planningRequestOverlap([{supplierPartner:'Supplier',orderRefs:['order']}],[plan as EvidencePlan & {status:string}],match()),false);
});
test('a later real top-up on the sole request is retained, not hidden by operational completion',()=>{
  const topup={...payment,ref:'topup',documentAmount:25,date:'03.10.2026 17:00:00'};
  const result=match([plan],[payment,topup]).get(plan.id)!;
  assert.equal(result.state,'ISSUED_BY_ONE_C');
  assert.equal(result.issuedAmount,30025);assert.equal(result.remainingAmount,0);
  assert.deepEqual(result.cashOrders.map(p=>p.ref),['rko','topup']);
});
test('small closed order request releases a new supplier-debt request without claiming its payment',()=>{
  const next={...plan,id:'debt-next',planCode:'NEXT',orderRefs:[],plannedAmount:10000,createdAt:'2026-10-03T13:00:00Z'};
  const later={...payment,ref:'new-debt-rko',documentAmount:10000,date:'03.10.2026 17:00:00'};
  const result=match([plan,next],[later,payment]);
  assert.equal(result.get(plan.id)!.state,CLOSED);
  assert.equal(result.get(next.id)!.issuedAmount,10000);
  assert.deepEqual(result.get(next.id)!.cashOrders.map(p=>p.ref),['new-debt-rko']);
});
