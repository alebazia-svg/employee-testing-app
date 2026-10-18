import test from 'node:test';
import assert from 'node:assert/strict';
import { payrollPaymentBreakdown, confirmedPayrollPaymentBreakdown } from '../lib/payroll-payment-breakdown';
const payment = { amount: 23000, comment: '13000 аванс 09.2026', documentDate: '2026-10-01', advancePeriod: null };
test('confirmed September mixed issuance is explained without double deduction', () => {
  const parts = payrollPaymentBreakdown(payment, true)!;
  assert.deepEqual(parts, { period: '2026-09', advance: 13000, days: 10000 });
  assert.equal(parts.advance + parts.days, payment.amount);
});
test('both supported period formats and year boundary', () => {
  assert.equal(payrollPaymentBreakdown({ ...payment, comment: '13000 аванс за 2026.09' }, true)?.period, '2026-09');
  assert.equal(payrollPaymentBreakdown({ ...payment, comment: '13000 аванс 12.2025', documentDate: '2026-01-01' }, true)?.period, '2025-12');
});
test('other month, day, excessive advance and extra wording stay unresolved', () => {
  for (const change of [{ comment: '13000 аванс 10.2026' }, { documentDate: '2026-10-02' }, { amount: 12000 }, { comment: '13000 аванс 09.2026 и другое' }]) {
    assert.equal(payrollPaymentBreakdown({ ...payment, ...change }, true), null);
  }
});
test('no calendar allocation without confirmed payment schedule', () => {
  assert.equal(payrollPaymentBreakdown(payment), null);
});
test('historical decision follows only the confirmed employee and unchanged document', () => {
  const document = { ...payment, documentNumber: '00OF-001802' };
  assert.deepEqual(confirmedPayrollPaymentBreakdown('Ахобекова Залина', document), {period:'2026-09', advance:13000, days:10000});
  assert.equal(confirmedPayrollPaymentBreakdown('Другой сотрудник', document), null);
  for (const change of [{documentNumber:'00OF-001803'}, {amount:24000}, {documentDate:'2026-10-02'}, {comment:'13000 аванс 10.2026'}]) {
    assert.equal(confirmedPayrollPaymentBreakdown('Ахобекова Залина', {...document,...change}), null);
  }
});
