import test from 'node:test';
import assert from 'node:assert/strict';
import {usdtReservedByPlans, type UsdtReservePlan} from '../lib/procurement-usdt-reserve';
import {COMPLETED_WITHOUT_TOPUP} from '../lib/procurement-payment-completion';
const plan: UsdtReservePlan = {status:'APPROVED',paymentMethod:'USDT',plannedAmount:0,foreignAmount:1000};
test('foreign-only request remains reserved without rubles or rate',()=>{
  assert.equal(usdtReservedByPlans([plan],null),1000);
});
test('partial foreign evidence determines reserve, not ruble ratio',()=>{
  assert.equal(usdtReservedByPlans([{...plan,evidence:{state:'PARTIALLY_PAID_BY_ONE_C',remainingAmount:0,remainingForeignAmount:600}}],89),600);
});
test('unknown exchange rate does not silently reserve zero',()=>{
  assert.equal(usdtReservedByPlans([{...plan,foreignAmount:null,plannedAmount:700000}],null),null);
});
test('mixed pending and approved requests reserve cumulatively',()=>{
  assert.equal(usdtReservedByPlans([plan,{...plan,status:'SUBMITTED',foreignAmount:null,plannedAmount:89000}],89),2000);
});
test('paid and cancelled requests release reserve',()=>{
  assert.equal(usdtReservedByPlans([{...plan,status:'CANCELLED'},{...plan,evidence:{state:'PAID_BY_ONE_C',remainingAmount:3,remainingForeignAmount:0}}],null),0);
});
test('ambiguous payment cannot imply free money',()=>{
  assert.equal(usdtReservedByPlans([{...plan,evidence:{state:'NEEDS_REVIEW',remainingAmount:0,remainingForeignAmount:0}}],89),null);
});
test('all financially finished states release reserve even without a foreign transfer amount',()=>{
  for (const state of ['ISSUED_BY_ONE_C','PAID_BY_ONE_C','SMALL_REMAINDER_COMPLETED']) {
    assert.equal(usdtReservedByPlans([{...plan,evidence:{state,remainingAmount:32.8,remainingForeignAmount:null}}],null),0,state);
    assert.equal(usdtReservedByPlans([{...plan,foreignAmount:null,plannedAmount:500032.8,evidence:{state,remainingAmount:32.8,remainingForeignAmount:null}}],null),0,state);
  }
});
test('partial requests completed without top-up do not reserve the cancelled remainder',()=>{
  assert.equal(usdtReservedByPlans([{...plan,status:COMPLETED_WITHOUT_TOPUP,evidence:{state:'PARTIALLY_PAID_BY_ONE_C',remainingAmount:60000,remainingForeignAmount:600}}],100),0);
});
test('mixed list reserves only open unpaid foreign amounts, not historical requests',()=>{
  const plans:UsdtReservePlan[]=[
    {...plan,status:'SUBMITTED',foreignAmount:4688},
    {...plan,evidence:{state:'PARTIALLY_PAID_BY_ONE_C',remainingAmount:70000,remainingForeignAmount:700}},
    {...plan,foreignAmount:5000,evidence:{state:'ISSUED_BY_ONE_C',remainingAmount:0,remainingForeignAmount:null}},
    {...plan,foreignAmount:5000,evidence:{state:'SMALL_REMAINDER_COMPLETED',remainingAmount:32.8,remainingForeignAmount:null}},
    {...plan,status:'CANCELLED'},
    {...plan,status:COMPLETED_WITHOUT_TOPUP},
  ];
  assert.equal(usdtReservedByPlans(plans,100),5388);
  assert.equal(usdtReservedByPlans(plans,100)!-1500,3888);
});
