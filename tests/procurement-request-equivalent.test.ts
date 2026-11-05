import test from 'node:test';
import assert from 'node:assert/strict';
import {requestEquivalent} from '../components/ProcurementRequestEquivalent';
const base={paymentMethod:'CNY',plannedAmount:'57868',foreignAmount:'4255',exchangeRate:'13.6'};
test('shows the opposite saved request currency without a live-rate substitution',()=>{
  assert.deepEqual(requestEquivalent(base),{amount:57868,currency:'RUB'});
  assert.deepEqual(requestEquivalent({...base,foreignAmount:null}),{amount:4255,currency:'CNY'});
  assert.deepEqual(requestEquivalent({...base,paymentMethod:'USDT',plannedAmount:86000,foreignAmount:null,exchangeRate:86}),{amount:1000,currency:'USDT'});
  for(const patch of [{exchangeRate:null},{exchangeRate:0},{exchangeRate:NaN},{paymentMethod:'CASH'},{paymentMethod:'BANK'}])assert.equal(requestEquivalent({...base,...patch}),null);
});
test('partial foreign payments use only confirmed remainder; RUB expenses never invent a foreign remainder',()=>{
  const evidence={state:'PARTIALLY_PAID_BY_ONE_C',verification:'current',remainingAmount:680,remainingForeignAmount:50};
  assert.deepEqual(requestEquivalent({...base,evidence}),{amount:680,currency:'RUB'});
  for(const patch of [{state:'PARTIALLY_ISSUED'},{state:'MISMATCH'},{verification:'last-confirmed'},{paymentAmountNeedsConfirmation:true}])assert.equal(requestEquivalent({...base,evidence:{...evidence,...patch}}),null);
});
