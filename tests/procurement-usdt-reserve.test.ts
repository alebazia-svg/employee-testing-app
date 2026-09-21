import test from 'node:test';
import assert from 'node:assert/strict';
import {usdtReservedByPlans, type UsdtReservePlan} from '../lib/procurement-usdt-reserve';
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
