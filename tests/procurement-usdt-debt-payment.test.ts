import test from 'node:test';
import assert from 'node:assert/strict';
import {matchProcurementPaymentEvidence, type EvidencePlan} from '../lib/procurement-currency-payment-evidence';
import type {SupplierCurrencyPaymentRow} from '../lib/procurement-currency-payment-source';
import {paymentFingerprint} from '../lib/procurement-manual-payment-links';

const plan: EvidencePlan = {id:'debt',planCode:'PAY-DEBT',supplierPartner:'Supplier',supplierCounterparty:'Company',
  orderRefs:[],paymentMethod:'USDT',foreignAmount:8000,plannedAmount:706400,currency:'USDT',status:'APPROVED',createdAt:'2026-10-13T06:57:03Z'};
const payment: SupplierCurrencyPaymentRow = {ref:'rko',number:'TEST',date:'11.11.2026 13:34:58',posted:true,deleted:false,
  documentAmount:8005.95,documentCurrency:'USDT',supplier:'Supplier',counterparty:'Company',baseDocumentRef:'',contract:'',
  registerContractBasis:{versionToken:'v1',contracts:[{ref:'contract',name:'Contract'}]}};
const match=(rows=[payment],plans=[plan])=>matchProcurementPaymentEvidence(plans,[],rows,[],{allowSmallRemainder:true});

test('sole approved USDT debt closes with native contract proof and preserves the exact excess',()=>{
  const before=JSON.stringify({plan,payment});
  for(const rows of [[payment],[payment,payment]]){
    const result=match(rows).get(plan.id)!;
    assert.equal(result.state,'PAID_BY_ONE_C');assert.equal(result.paidForeignAmount,8000);
    assert.equal(result.remainingForeignAmount,0);assert.equal(result.currencyPayments.length,1);
    assert.equal(result.currencyPayments[0].documentForeignAmount,8005.95);
    assert.equal(result.currencyPayments[0].unallocatedForeignAmount,5.95);
    assert.equal(result.actualExchangeRate,null,'native RUB settlement money is not an exchanger rate');
  }
  assert.equal(JSON.stringify({plan,payment}),before);
});
test('several partial USDT RKOs accumulate once in chronological order',()=>{
  const a={...payment,ref:'first',documentAmount:3000,date:'09.11.2026 12:00:00'};
  const b={...payment,documentAmount:5000};
  assert.equal(match([a]).get(plan.id)!.state,'PARTIALLY_PAID_BY_ONE_C');
  for(const rows of [[a,b],[b,a,b]]){
    const result=match(rows).get(plan.id)!;assert.equal(result.state,'PAID_BY_ONE_C');
    assert.equal(result.paidForeignAmount,8000);assert.equal(result.currencyPayments.length,2);
  }
});
test('earlier RUB-funded history releases a later USDT debt only with current complete proof',()=>{
  const old={...plan,id:'old',planCode:'OLD',createdAt:'2026-10-01',foreignAmount:500,plannedAmount:50032.8};
  const rub={...payment,ref:'rub',date:'12.10.2026 16:45:12',documentAmount:50000,documentCurrency:'РУБ',contract:'Contract',registerContractBasis:undefined};
  const result=match([payment,rub],[old,plan]);
  assert.equal(result.get(old.id)!.state,'SMALL_REMAINDER_COMPLETED');
  assert.equal(result.get(plan.id)!.state,'PAID_BY_ONE_C');
  for(const rows of [[payment],[payment,{...rub,posted:false}],[payment,{...rub,date:payment.date}],[payment,{...rub,date:'12.11.2026 16:45:12'}]]){
    assert.equal(match(rows,[old,plan]).get(plan.id)!.paidForeignAmount,0);
  }
});
test('earlier USDT-covered debt does not swallow a later RKO; cancelling it restores ambiguity',()=>{
  const old={...plan,id:'old',planCode:'OLD',createdAt:'2026-10-01',foreignAmount:1000};
  const deposit={...payment,ref:'deposit',date:'12.10.2026 16:45:12',documentAmount:1000};
  const result=match([payment,deposit],[old,plan]);
  assert.equal(result.get(old.id)!.paidForeignAmount,1000);assert.equal(result.get(plan.id)!.paidForeignAmount,8000);
  assert.equal(match([payment,{...deposit,deleted:true}],[old,plan]).get(plan.id)!.paidForeignAmount,0);
});
test('multiple outstanding requests, including other managers or methods, are never selected by amount',()=>{
  for(const other of [{...plan,id:'other',planCode:'OTHER',foreignAmount:10,managerName:'Other'},
    {...plan,id:'other',orderRefs:['other-order']},{...plan,id:'other',paymentMethod:'BANK',foreignAmount:null}]){
    for(const plans of [[plan,other],[other,plan]])assert.equal(match([payment],plans).get(plan.id)!.paidForeignAmount,0);
  }
});
test('unknown proof, mismatched counterparty, invalid or future data and unapproved plans stay guarded',()=>{
  for(const patch of [{registerContractBasis:undefined},{counterparty:'Different company'},{supplier:'Other'},
    {posted:false},{deleted:true},{date:'bad'},{date:'11.11.2099 13:34:58'},{documentAmount:NaN},{documentAmount:9000}]){
    assert.equal(match([{...payment,...patch}]).get(plan.id)!.paidForeignAmount,0);
  }
  for(const patch of [{status:'SUBMITTED'},{status:'CANCELLED'},{hasPendingRevision:true},
    {createdAt:'2026-11-12'},{foreignAmount:null},{foreignAmount:0}]){
    assert.equal(match([payment],[{...plan,...patch}]).get(plan.id)!.paidForeignAmount,0);
  }
});
test('explicit order and manual ownership win over supplier debt fallback',()=>{
  const order={...plan,id:'order',planCode:'ORDER',orderRefs:['order-ref']};
  const native={...payment,baseDocumentRef:'order-ref'};
  assert.equal(match([native],[plan,order]).get(plan.id)!.paidForeignAmount,0);
  assert.equal(match([native],[plan,{...order,status:'SUBMITTED'}]).get(plan.id)!.paidForeignAmount,0);
  assert.equal(match([native],[plan,{...order,status:'CANCELLED'}]).get(plan.id)!.paidForeignAmount,0);
  const manual={...order,manualRubleLinks:[{ref:payment.ref,fingerprint:paymentFingerprint(payment)}]};
  assert.equal(match([payment],[plan,manual]).get(plan.id)!.paidForeignAmount,0);
  assert.equal(match([{...payment,documentAmount:7000}],[plan,manual]).get(plan.id)!.paidForeignAmount,0);
});
test('RUB and USDT payments are never summed as independent funding of the same debt',()=>{
  const rub={...payment,ref:'rub',date:'10.11.2026 16:45:12',documentAmount:10000,documentCurrency:'РУБ',contract:'Contract',registerContractBasis:undefined};
  const result=match([rub,payment]).get(plan.id)!;
  assert.equal(result.paidForeignAmount,0);assert.equal(result.state,'NEEDS_REVIEW');
});
test('a conflicting duplicate or removal of the RKO reopens derived payment state',()=>{
  assert.equal(match([payment,{...payment,documentAmount:8000}]).get(plan.id)!.paidForeignAmount,0);
  assert.equal(match([]).get(plan.id)!.state,'NO_EVIDENCE');
});
test('explicit native header contract is also admissible; a large excess stays unassigned',()=>{
  const native={...payment,registerContractBasis:undefined,contract:'Contract'};
  assert.equal(match([native]).get(plan.id)!.state,'PAID_BY_ONE_C');
  assert.equal(match([{...native,documentAmount:100000}]).get(plan.id)!.paidForeignAmount,0);
});
test('an excess or later extra RKO cannot fund another request that did not yet exist',()=>{
  const future={...plan,id:'future',planCode:'FUTURE',foreignAmount:5.95,createdAt:'2026-11-12'};
  const extra={...payment,ref:'extra',date:'11.11.2026 14:00:00',documentAmount:5.95};
  const result=match([payment,extra],[plan,future]);
  assert.equal(result.get(plan.id)!.paidForeignAmount,8000);
  assert.equal(result.get(future.id)!.paidForeignAmount,0);
  assert.deepEqual(result.get(plan.id)!.currencyPayments.map(p=>p.ref),[payment.ref]);
});
test('a changed native document version invalidates a manual fingerprint without reallocating its RKO',()=>{
  const owner={...plan,manualRubleLinks:[{ref:payment.ref,fingerprint:paymentFingerprint(payment)}]};
  const changed={...payment,registerContractBasis:{...payment.registerContractBasis!,versionToken:'v2'}};
  const other={...plan,id:'other',planCode:'OTHER'};
  const result=match([changed],[owner,other]);
  assert.equal(result.get(owner.id)!.paidForeignAmount,0);assert.equal(result.get(other.id)!.paidForeignAmount,0);
});
test('several fractional RUB history payments use kopecks when releasing the next USDT request',()=>{
  const old={...plan,id:'old',planCode:'OLD',createdAt:'2026-10-01',foreignAmount:1,plannedAmount:50.3};
  const rub={...payment,documentCurrency:'РУБ',contract:'Contract',registerContractBasis:undefined};
  const result=match([{...rub,ref:'a',date:'09.10.2026 12:00:00',documentAmount:20.1},
    {...rub,ref:'b',date:'12.10.2026 12:00:00',documentAmount:30.2},payment],[old,plan]);
  assert.equal(result.get(old.id)!.issuedAmount,50.3);assert.equal(result.get(plan.id)!.state,'PAID_BY_ONE_C');
});
test('an earlier unassigned payment does not block a later independently owned full payment',()=>{
  const later={...payment,ref:'owned',date:'11.11.2026 14:00:00',documentAmount:8000};
  const owner={...plan,manualRubleLinks:[{ref:later.ref,fingerprint:paymentFingerprint(later)}]};
  const other={...plan,id:'other',planCode:'OTHER'};
  const result=match([{...payment,documentAmount:20},later],[owner,other]);
  assert.equal(result.get(owner.id)!.state,'PAID_BY_ONE_C');assert.equal(result.get(owner.id)!.paidForeignAmount,8000);
  assert.equal(result.get(other.id)!.paidForeignAmount,0);
});
