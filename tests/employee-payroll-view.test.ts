import assert from 'node:assert/strict';
import test from 'node:test';
import { employeePayrollMonthAt, employeePayrollMonthDelay, employeePayrollMonths, rememberEmployeePayroll, validEmployeePayrollView, type EmployeePayrollView } from '../lib/employee-payroll-view';
const periods = ['2026-10', '2026-09'];
const value = (month = '2026-10'): EmployeePayrollView => ({ month, state: 'current_estimate', estimatedAccrued: 30000, earnings: [{ label: 'Выходы', amount: 30000 }], savedAdvance: 0 });
test('only the selected month and consistent validated sums can be displayed', () => {
  assert.equal(validEmployeePayrollView(value(), periods[0]), true);
  for (const patch of [{ month: '2026-09' }, { estimatedAccrued: NaN }, { estimatedAccrued: 1 }, { savedAdvance: -1 }, { earnings: [{ label: 'Выходы', amount: Infinity }] }]) assert.equal(validEmployeePayrollView({ ...value(), ...patch }, periods[0]), false);
});
test('unknown payments are not zero; a confirmed zero remaining is valid', () => {
  for (const payment of [{ paid: null, remaining: null }, { paid: 30000, remaining: 0 }]) assert.equal(validEmployeePayrollView({ month: periods[1], state: 'confirmed', accrued: 30000, ...payment }, periods[1]), true);
  assert.equal(validEmployeePayrollView({ month: periods[1], state: 'confirmed', accrued: 30000, paid: 30000, remaining: 5000 }, periods[1]), false);
});
test('earlier credit must be finite and reconcile all displayed amounts exactly', () => {
  const confirmed = { month: periods[1], state: 'confirmed', accrued: 89100, paid: 89000, remaining: 0, creditedFromEarlier: 100 };
  assert.equal(validEmployeePayrollView(confirmed, periods[1]), true);
  for (const creditedFromEarlier of [-100, 0, 50, 200, NaN, Infinity]) {
    assert.equal(validEmployeePayrollView({ ...confirmed, creditedFromEarlier }, periods[1]), false);
  }
});
test('valid negative return components retain the existing calculation semantics', () => {
  assert.equal(validEmployeePayrollView({ ...value(), estimatedAccrued: -100, earnings: [{ label: 'Аксессуары', amount: -100 }] }, periods[0]), true);
});
test('the volatile store retains at most the two visible months, without mutating old state', () => {
  let saved = new Map<string, EmployeePayrollView>();
  for (let i = 1; i <= 10; i++) saved = rememberEmployeePayroll(saved, value(`2026-${String(i).padStart(2, '0')}`), periods);
  assert.equal(saved.size, 2);
  const next = rememberEmployeePayroll(saved, { month: periods[1], state: 'unavailable' }, periods);
  assert.equal(next.has(periods[1]), false); assert.equal(saved.has(periods[1]), true);
  assert.equal(rememberEmployeePayroll(saved, value('2026-11'), ['2026-11', '2026-10', '2026-09']).has('2026-08'), false);
});
test('the month pair rolls forward, including January across years', () => {
  assert.deepEqual(employeePayrollMonths('2026-10'), ['2026-10', '2026-09']);
  assert.deepEqual(employeePayrollMonths('2026-11'), ['2026-11', '2026-10']);
  assert.deepEqual(employeePayrollMonths('2026-12'), ['2026-12', '2026-11']);
  assert.deepEqual(employeePayrollMonths('2027-01'), ['2027-01', '2026-12']);
});
test('rollover uses Moscow midnight, not UTC or device timezone', () => {
  const before = new Date('2026-12-31T20:59:59.000Z');
  assert.equal(employeePayrollMonthAt(before), '2026-12');
  assert.equal(employeePayrollMonthDelay(before), 1000);
  assert.equal(employeePayrollMonthAt(new Date(before.getTime() + 1000)), '2027-01');
  assert.equal(employeePayrollMonthDelay(new Date('2027-01-01T00:00:00Z')), 86400000);
});
