import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validatePayrollDraft, validatePayrollDraftWrite, payrollDraftFingerprint } from '../lib/payroll-draft';
const payload = () => ({ manual: { 'Тестовый сотрудник': { workedDays: '', lateCount: '', advance: '0', comment: '' } }, fixed: {}, purchase: { advance: '', deduction: '', comment: '' }, bonuses: [] });
test('drafts retain blanks, explicit zero and original decimal input without recalculation', () => {
  const input = payload(); input.manual['Тестовый сотрудник'].advance = '2000,50';
  assert.deepEqual(validatePayrollDraft(input), input);
});
test('rejects negative/invalid amounts, excessive days, fractional lateness, unknown fields and unsafe keys', () => {
  for (const patch of [{ advance: '-1' }, { workedDays: '32' }, { lateCount: '1.5' }, { advance: 'Infinity' }, { advance: '1.234' }, { workedDays: 'hello' }, { role: 'ADMIN' }]) {
    const input = payload(); Object.assign(input.manual['Тестовый сотрудник'], patch);
    assert.throws(() => validatePayrollDraft(input));
  }
  assert.throws(() => validatePayrollDraft({ ...payload(), manual: JSON.parse('{"__proto__":{}}') }));
});
test('validates revision, request identity and month independently from draft contents', () => {
  const input = { period: '2026-10', revision: 0, requestId: '11223344-1122-3344-5566-778899001122', payload: payload() };
  assert.equal(validatePayrollDraftWrite(input).revision, 0);
  for (const patch of [{ revision: -1 }, { period: '2026-13' }, { requestId: '' }, { employeeId: 1 }]) assert.throws(() => validatePayrollDraftWrite({ ...input, ...patch }));
});
test('incomplete bonus drafts are preserved, duplicate bonus IDs rejected', () => {
  const input = { ...payload(), bonuses: [{ id: 'draft1', employeeName: '', amount: '', reason: '' }] };
  assert.deepEqual(validatePayrollDraft(input).bonuses, input.bonuses);
  assert.throws(() => validatePayrollDraft({ ...input, bonuses: [...input.bonuses, ...input.bonuses] }));
});
test('object key order does not create false conflicts', () => {
  assert.equal(payrollDraftFingerprint({ a: 1, b: { c: 2, d: '' } }), payrollDraftFingerprint({ b: { d: '', c: 2 }, a: 1 }));
});
