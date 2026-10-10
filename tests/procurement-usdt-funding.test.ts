import test from 'node:test';
import assert from 'node:assert/strict';
import {walletFundingAvailable} from '../lib/procurement-usdt-funding';
import {usdtReservedByPlans} from '../lib/procurement-usdt-reserve';
import {validatePaymentPlan,calculateCashPreparation} from '../lib/procurement-payment-control';
import {revisionChanges} from '../lib/procurement-plan-revision';
const input={supplierPartner:'Supplier',orderRefs:['order'],plannedDate:'2026-10-12',paymentMethod:'USDT',foreignAmount:100,exchangeRate:90,plannedAmount:1};
test('explicit funding validates enum and amount, recomputes rubles, preserves legacy estimate',()=>{
  assert.equal(validatePaymentPlan({...input,fundingSource:'CASH_EXCHANGE'}).data.plannedAmount,9000);
  assert.equal(validatePaymentPlan({...input,fundingSource:'WALLET'}).ok,true);
  assert.equal(validatePaymentPlan({...input,fundingSource:'MIXED'}).ok,false);
  assert.equal(validatePaymentPlan({...input,fundingSource:'WALLET',foreignAmount:null}).ok,false);
  assert.equal(validatePaymentPlan(input).data.plannedAmount,1);
  assert.equal(validatePaymentPlan({...input,paymentMethod:'CASH',fundingSource:'WALLET'}).data.fundingSource,null);
});
test('wallet requires whole amount and known free balance, including multiple draft rows',()=>{
  assert.equal(walletFundingAvailable(100,100),true);
  for(const value of [null,99,-1,NaN])assert.equal(walletFundingAvailable(100,value),false);
  assert.equal(walletFundingAvailable(60+60,100),false);
  assert.equal(walletFundingAvailable(0,100),false);
});
test('cash exchange never reserves wallet; legacy still reserves conservatively',()=>{
  const plan={...input,status:'SUBMITTED'};
  assert.equal(usdtReservedByPlans([{...plan,fundingSource:'CASH_EXCHANGE'}],90),0);
  assert.equal(usdtReservedByPlans([plan,{...plan,fundingSource:'WALLET'}],90),200);
});
test('preparation never mixes wallet with exchange or adds separate commission',()=>{
  const plan={...input,id:'p',commissionAmount:500};
  assert.equal(calculateCashPreparation([{...plan,plannedAmount:9000,fundingSource:'CASH_EXCHANGE'}],1000,'2026-10-10').rows[0].cashRequired,9000);
  assert.equal(calculateCashPreparation([{...plan,fundingSource:'WALLET'}],1000,'2026-10-10').rows.length,0);
  const result=calculateCashPreparation([{...plan,plannedAmount:9000},{...plan,id:'explicit',fundingSource:'WALLET'}],100,'2026-10-10');
  assert.equal(result.rows[0].cashRequired,9000);
});
test('source change is audited; legacy missing and null are equivalent',()=>{
  const before=validatePaymentPlan(input).data;
  assert.equal(revisionChanges({...before,fundingSource:undefined},before).length,0);
  assert.ok(revisionChanges(before,validatePaymentPlan({...input,fundingSource:'WALLET'}).data).some(c=>c.key==='fundingSource'&&c.after==='Из кассы USDT'));
});
