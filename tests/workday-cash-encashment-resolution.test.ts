import assert from 'node:assert/strict';
import test from 'node:test';
import { requiredCashEncashmentAmount, resolveCarriedCashEncashmentExceptions } from '@/lib/workday-cash-encashment-resolution';
import { buildShiftHandoverSteps } from '@/lib/shift-control-policy';

test('next shift uses its current balance, including the exact 50 000 boundary', () => {
  for (const [balance,expected] of [[49999,false],[50000,false],[50001,true],[115406,true]] as const) {
    const steps=buildShiftHandoverSteps({personalCashBalance:balance,cashCommentRequired:false,isRetail:false,isStoreClosingShift:false,requiresKkmClose:false});
    assert.equal(steps.includes('encashment'),expected);
  }
  assert.equal(requiredCashEncashmentAmount(115406),65406);
});
test('later transfers never reopen or rewrite approved historical exceptions', async () => {
  const db = new Proxy({}, { get() { throw new Error('Historical approvals must not be queried or mutated'); } });
  for (const amount of [0,20000,70000,162000]) {
    const result=await resolveCarriedCashEncashmentExceptions(db as never,{employeeId:7,operationId:12,operationDate:'2026-10-19',operationAmount:amount,operationCreatedAt:new Date('2026-10-19T15:00:00Z'),apply:true});
    assert.deepEqual(result,{resolvedIds:[],requiredAmount:null,reason:'approval_is_final'});
  }
});
