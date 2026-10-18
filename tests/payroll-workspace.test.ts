import assert from 'node:assert/strict';
import test from 'node:test';
import { currentPayrollWorkspacePeriod, matchingFinalPayrollRun } from '../lib/payroll-workspace';
import { isPayrollPeriodAvailable } from '../lib/payroll-period-availability';

test('workspace opens current Moscow month, including days 1–7 and year boundary', () => {
  assert.deepEqual(currentPayrollWorkspacePeriod(new Date('2026-10-01T08:00:00Z')), {month:'9',year:'2026'});
  assert.deepEqual(currentPayrollWorkspacePeriod(new Date('2026-10-07T08:00:00Z')), {month:'9',year:'2026'});
  assert.deepEqual(currentPayrollWorkspacePeriod(new Date('2026-12-31T21:30:00Z')), {month:'0',year:'2027'});
});
test('saved final is selected only for the exact period, identity and final status', () => {
  const run = {id:12,status:'FINAL',period:{periodKey:'2026-09'}};
  assert.equal(matchingFinalPayrollRun(run,'2026-09',12),run);
  assert.equal(matchingFinalPayrollRun(run,'2026-10',12),null);
  assert.equal(matchingFinalPayrollRun(run,'2026-09',13),null);
  assert.equal(matchingFinalPayrollRun({...run,status:'SUPERSEDED'},'2026-09',12),null);
  assert.equal(matchingFinalPayrollRun({...run,status:'DRAFT'},'2026-09',12),null);
  assert.equal(matchingFinalPayrollRun(null,'2026-09',12),null);
});
test('unapproved past period remains available independently of final snapshot', () => {
  assert.equal(isPayrollPeriodAvailable('2026-09','2026-10'),true);
  assert.equal(isPayrollPeriodAvailable('2026-10','2026-10'),true);
  assert.equal(isPayrollPeriodAvailable('2026-11','2026-10'),false);
});
