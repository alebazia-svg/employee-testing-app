import test from 'node:test';
import assert from 'node:assert/strict';
import {rublePaymentFitsRemaining} from '../lib/procurement-small-remainder';
import {manualPaymentCurrencyMatches, paymentFingerprint} from '../lib/procurement-manual-payment-links';
import {matchProcurementPaymentEvidence, type EvidencePlan} from '../lib/procurement-currency-payment-evidence';
import {PROCUREMENT_CARGO as cargo} from '../lib/procurement-cargo';
import type {SupplierCurrencyPaymentRow} from '../lib/procurement-currency-payment-source';

const plan: EvidencePlan = {id:'cargo',planCode:'TEST',supplierPartner:cargo.supplierPartner,supplierCounterparty:cargo.supplierCounterparty,
  paymentPurpose:'DELIVERY',orderRefs:[],plannedAmount:468270,paymentMethod:'USDT',foreignAmount:5445,status:'APPROVED',createdAt:'2026-10-13T00:00:00Z'};
const payment: SupplierCurrencyPaymentRow = {ref:'test-rko',number:'TEST',date:'24.10.2026 17:35:45',posted:true,deleted:false,
  documentAmount:468300,documentCurrency:'РУБ',baseDocumentRef:'',supplier:cargo.supplierPartner,counterparty:cargo.supplierCounterparty,
  contract:cargo.contractName,registerContractBasis:{versionToken:'test',contracts:[{ref:cargo.contractRef,name:cargo.contractName}]}};
const match=(rows=[payment],plans=[plan],allowSmallRemainder=true)=>matchProcurementPaymentEvidence(plans,[],rows,[],{allowSmallRemainder});

test('Cargo: 30 RUB excess covers budget, preserving the RKO without inventing USDT',()=>{
  const row=match().get(plan.id)!;
  assert.equal(row.state,'ISSUED_BY_ONE_C'); assert.equal(row.issuedAmount,468300);
  assert.equal(row.remainingAmount,0); assert.equal(row.cashOrders[0].amount,468300);
  assert.equal(row.paidForeignAmount,0); assert.deepEqual(row.currencyPayments,[]);
  assert.equal(row.actualExchangeRate,null);
  assert.equal(match([payment],[plan],false).get(plan.id)!.state,'NEEDS_REVIEW');
});
test('excess bounds inclusive, integer kopecks, zero/invalid balance never accepts money',()=>{
  for(const [target,amount,accepted] of [[50000,50500,true],[50000,50500.01,false],[1000,1010,true],[1000,1010.01,false],
    [100,100.01,true],[100,99,true],[0,1,false],[-1,1,false],[NaN,1,false],[100,Infinity,false],[100,0,false],[100,100.001,false]] as const){
    assert.equal(rublePaymentFitsRemaining(target,amount,true),accepted,`${target}/${amount}`);
  }
  assert.equal(rublePaymentFitsRemaining(1000,1000.01),false);
});
test('excess uses unpaid remainder, not original budget; partial payments and duplicates remain exact',()=>{
  const first={...payment,ref:'first',date:'23.10.2026 12:00:00',documentAmount:467000};
  assert.equal(match([first]).get(plan.id)!.state,'PARTIALLY_ISSUED');
  assert.equal(match([first,{...payment,documentAmount:1300}]).get(plan.id)!.state,'NEEDS_REVIEW');
  const row=match([first,{...payment,documentAmount:1282.70}]).get(plan.id)!;
  assert.equal(row.state,'ISSUED_BY_ONE_C'); assert.equal(row.issuedAmount,468282.70);
  assert.equal(match([payment,payment]).get(plan.id)!.issuedAmount,468300);
  assert.equal(match([payment,{...payment,documentAmount:468301}]).get(plan.id)!.issuedAmount,0);
});
test('ambiguous, unposted, deleted, wrong contract, wrong counterparty and pending changes never auto-close',()=>{
  for(const change of [{posted:false},{deleted:true},{contract:'',registerContractBasis:undefined},
    {registerContractBasis:{versionToken:'bad',contracts:[{ref:'wrong',name:'wrong'}]}},{counterparty:'Other'},{date:'12.10.2026 12:00:00'}]){
    assert.equal(match([{...payment,...change}]).get(plan.id)!.issuedAmount,0);
  }
  for(const change of [{hasPendingRevision:true},{status:'SUBMITTED'},{status:'CANCELLED'}]){
    assert.equal(match([payment],[{...plan,...change}]).get(plan.id)!.issuedAmount,0);
  }
  const other={...plan,id:'other',plannedAmount:468300};
  for(const plans of [[plan,other],[other,plan]])for(const row of match([payment],plans).values())assert.equal(row.issuedAmount,0);
  assert.equal(match([]).get(plan.id)!.state,'NO_EVIDENCE');
});
test('one RKO is never reused; earlier paid plan releases only its own later payments',()=>{
  const later={...payment,ref:'later',date:'25.10.2026 12:00:00'};
  assert.equal(match([payment,later]).get(plan.id)!.issuedAmount,468300);
  const other={...plan,id:'later-plan',createdAt:'2026-10-25T00:00:00Z'};
  const rows=match([payment,later],[plan,other]);
  assert.equal(rows.get(plan.id)!.issuedAmount,468300);assert.equal(rows.get(other.id)!.issuedAmount,468300);
});
test('manual RUB funding supports USDT without allowing other foreign currencies or mixed evidence',()=>{
  for(const method of ['CASH','BANK','ACCOUNTABLE_QR','USDT','CNY'])for(const currency of ['RUB','РУБ'])assert.ok(manualPaymentCurrencyMatches(method,currency));
  assert.ok(manualPaymentCurrencyMatches('USDT','USDT'));
  for(const pair of [['CASH','USDT'],['CNY','USDT'],['USDT','USD'],['USDT','CNY'],['UNKNOWN','RUB']])assert.equal(manualPaymentCurrencyMatches(...pair as [string,string]),false);
  const linked={...plan,manualRubleLinks:[{ref:payment.ref,fingerprint:paymentFingerprint(payment)}]};
  assert.equal(match([payment],[linked,{...plan,id:'other'}]).get(plan.id)!.issuedAmount,468300);
  const foreign={...payment,ref:'wallet',date:'23.10.2026 12:00:00',documentCurrency:'USDT',documentAmount:100};
  const row=match([foreign,payment],[linked]).get(plan.id)!;
  assert.equal(row.state,'NEEDS_REVIEW');assert.equal(row.issuedAmount,0);
});
