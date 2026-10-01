import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPayrollPeriodAvailable } from '../lib/payroll-period-availability';

test('September remains available on October 1 without a final approval', () => {
  assert.equal(isPayrollPeriodAvailable('2026-09', '2026-09'), true);
  assert.equal(isPayrollPeriodAvailable('2026-09', '2026-10'), true);
  assert.equal(isPayrollPeriodAvailable('2026-08', '2026-10'), true);
});
test('year rollover preserves historical periods, not future periods', () => {
  assert.equal(isPayrollPeriodAvailable('2026-12', '2027-01'), true);
  assert.equal(isPayrollPeriodAvailable('2027-01', '2027-01'), true);
  assert.equal(isPayrollPeriodAvailable('2027-02', '2027-01'), false);
});
test('invalid period values are not available', () => {
  for (const period of ['', '2026-00', '2026-13', '2026-9']) {
    assert.equal(isPayrollPeriodAvailable(period, '2026-10'), false);
  }
});
