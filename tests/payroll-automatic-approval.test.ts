import { test } from 'node:test';
import assert from 'node:assert/strict';
import { automaticPayrollApprovalIssues, automaticPayrollDisplayedTotal, payrollApprovalReview } from '../lib/payroll-automatic-approval';

test('saved automatic totals sum displayed employee cents without changing raw calculation', () => {
  const rows = [{ grossPay: 1.004 }, { grossPay: 2.004 }];
  assert.equal(automaticPayrollDisplayedTotal(rows, 'grossPay'), 3);
  assert.equal(rows[0].grossPay, 1.004);
  assert.equal(automaticPayrollDisplayedTotal([{ netPay: 1.005 }, { netPay: -0.25 }], 'netPay'), 0.76);
});

const complete = { kind: 'automatic-1c-v1', periodKey: '2026-09', verifiedThrough: '2026-09-30', approvalIssues: [] };
const lateness = 'Кумахова Диана: Не указаны опоздания';
test('explicit employee remark acceptance requires a reason and leaves source immutable', () => {
  const source = { ...complete, approvalIssues: [lateness] };
  assert.ok(payrollApprovalReview(source, 1, [lateness], '').pending.length);
  assert.deepEqual(payrollApprovalReview(source, 1, [lateness], 'Бонус 0 ₽ подтверждаю').pending, []);
  assert.deepEqual(source.approvalIssues, [lateness]);
});
test('acceptance cannot bypass source, unknown, stale or hidden review issues', () => {
  for (const issue of ['Себестоимость не завершена', 'Итог не совпадает', 'Finbox не внесён']) {
    const result = payrollApprovalReview({ ...complete, approvalIssues: [lateness, issue] }, 1, [lateness], 'Бонус 0 ₽ подтверждаю');
    assert.ok(result.pending.includes(issue));
  }
  assert.ok(payrollApprovalReview({ ...complete, verifiedThrough: '2026-09-29', approvalIssues: [lateness] }, 1, [lateness], 'Подтверждаю').pending.length);
  assert.ok(payrollApprovalReview({ ...complete, approvalIssues: [lateness] }, 2, [lateness], 'Подтверждаю').pending.length);
  assert.ok(payrollApprovalReview({ ...complete, approvalIssues: [lateness] }, 1, ['Другой сотрудник'], 'Подтверждаю').pending.length);
});
test('complete checked automatic month can be approved', () => {
  assert.deepEqual(automaticPayrollApprovalIssues(complete, 0), []);
});
test('missing employee inputs and source warnings prevent approval', () => {
  assert.ok(automaticPayrollApprovalIssues(complete, 1).length);
  assert.deepEqual(automaticPayrollApprovalIssues({ ...complete, approvalIssues: ['Finbox не внесён'] }, 0), ['Finbox не внесён']);
});
test('partial or wrong-month source cannot become final', () => {
  for (const verifiedThrough of ['2026-09-29', '2026-08-31', '', null]) assert.ok(automaticPayrollApprovalIssues({ ...complete, verifiedThrough }, 0).length);
});
test('month coverage handles leap year and missing checks fail closed', () => {
  assert.deepEqual(automaticPayrollApprovalIssues({ ...complete, periodKey: '2028-02', verifiedThrough: '2028-02-29' }, 0), []);
  assert.ok(automaticPayrollApprovalIssues({ ...complete, approvalIssues: undefined }, 0).length);
});
test('existing manual and historical snapshots retain their workflow', () => {
  for (const value of [null, {}, { status: 'REVIEW' }]) assert.deepEqual(automaticPayrollApprovalIssues(value, 1), []);
});
