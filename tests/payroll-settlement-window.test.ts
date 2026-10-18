import test from 'node:test';
import assert from 'node:assert/strict';
import { payrollSettlementWindow } from '../lib/payroll-settlement-window';
import { payrollPaymentDateColumn } from '../lib/payroll-settlement-month';
test('a late issuance on the first is not mislabeled as the planned payment date', () => {
  assert.equal(payrollPaymentDateColumn('2026-08','2026-09-01'),'first');
  assert.equal(payrollPaymentDateColumn('2026-08','2026-09-16'),'second');
  assert.equal(payrollPaymentDateColumn('2026-08','2026-10-01'),'other');
  assert.equal(payrollPaymentDateColumn('2025-12','2026-01-01'),'first');
});
test('old months include payments after the next month, without changing earning month', () => {
  assert.deepEqual(payrollSettlementWindow('2026-08', '2026-10-18'), {dateFrom:'2026-08-01',dateTo:'2026-10-18'});
  assert.deepEqual(payrollSettlementWindow('2025-12', '2026-10-18'), {dateFrom:'2025-12-01',dateTo:'2026-10-18'});
});
test('current month ends today and invalid/future windows are rejected', () => {
  assert.deepEqual(payrollSettlementWindow('2026-10','2026-10-18'),{dateFrom:'2026-10-01',dateTo:'2026-10-18'});
  for (const [period,today] of [['2026-11','2026-10-18'],['2026-13','2026-10-18'],['2026-02','2026-02-30']]) assert.equal(payrollSettlementWindow(period,today),null);
});
