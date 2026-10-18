import test from 'node:test';
import assert from 'node:assert/strict';
import { currentPayrollSettlement, completeSettlementTotal } from '../lib/payroll-current-export';
test('monthly headline keeps the selected month separate from accumulated salary debt', () => {
  const row = currentPayrollSettlement('Бэла', {periodPaid:0,advances:0,unassigned:0,
    balance:{remainingMinor:20830000,creditMinor:0},monthly:{remaining:101500}});
  assert.equal(row.remaining,101500);
  assert.equal(row.totalDebt,208300);
  assert.equal(completeSettlementTotal([row],'remaining'),101500);
});
test('paid salary exports zero regardless of unrounded saved calculation', () => {
  const row=currentPayrollSettlement('Милана',{periodPaid:89000,advances:0,unassigned:0,balance:{remainingMinor:0,creditMinor:0}});
  assert.equal(row.remaining,0);assert.equal(row.paid,89000);
});
test('all-period debt and unknown attribution are not fabricated monthly amounts', () => {
  const row=currentPayrollSettlement('Бэла',{periodPaid:0,advances:0,unassigned:1,balance:{remainingMinor:20830000,creditMinor:0}});
  assert.equal(row.remaining,null);assert.equal(row.paid,null);assert.equal(row.totalDebt,208300);
  assert.equal(completeSettlementTotal([row],'remaining'),null);
  assert.equal(currentPayrollSettlement('Нет данных',null).remaining,null);
});
test('advances are included once; credit does not confirm settled payroll',()=>{
 const row=currentPayrollSettlement('Залина',{periodPaid:129000,advances:13000,unassigned:0,balance:{remainingMinor:0,creditMinor:0}});
 assert.equal(completeSettlementTotal([row],'paid'),129000);
 assert.equal(row.advance,13000);
 assert.equal(currentPayrollSettlement('Аванс',{periodPaid:7500,advances:7500,unassigned:0,balance:{remainingMinor:0,creditMinor:750000}}).remaining,null);
});
