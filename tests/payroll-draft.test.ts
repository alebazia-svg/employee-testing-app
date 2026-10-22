import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
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
import { canSavePayrollDraft } from '../lib/payroll-draft';
import { payrollDraftComparisonFingerprint, payrollDraftDifferences } from '../lib/payroll-draft';
test('blank records and legacy agreed Muhammad days do not create October conflicts', () => {
  const saved = { manual: {}, fixed: {}, purchase: { advance: '', deduction: '', comment: '' }, bonuses: [] };
  const local = { ...saved, manual: {
    'Кумахова Диана': { workedDays: '', lateCount: '', advance: '', comment: '', agentCreditCommission: '' },
    'Кумыков Мухаммед': { workedDays: '16', lateCount: '', advance: '', comment: '' },
  } };
  const original = JSON.stringify(local);
  assert.equal(payrollDraftComparisonFingerprint(local, '2026-10'), payrollDraftComparisonFingerprint(saved, '2026-10'));
  assert.deepEqual(payrollDraftDifferences(local, saved, '2026-10'), []);
  assert.notEqual(payrollDraftComparisonFingerprint(local, '2026-09'), payrollDraftComparisonFingerprint(saved, '2026-09'));
  assert.equal(JSON.stringify(local), original, 'comparison must not modify recovery/save data');
});
test('real corrections and explicit zero remain conflicts', () => {
  const saved = { manual: {}, fixed: {}, purchase: { advance: '', deduction: '', comment: '' }, bonuses: [] };
  for (const patch of [{ advance: '0' }, { advance: '7500' }, { lateCount: '0' }, { workedDays: '12' }, { comment: 'Проверить' }]) {
    const local = { ...saved, manual: { 'Кумахова Диана': { workedDays: '', lateCount: '', advance: '', comment: '', ...patch } } };
    assert.notEqual(payrollDraftComparisonFingerprint(local, '2026-10'), payrollDraftComparisonFingerprint(saved, '2026-10'));
    assert.equal(payrollDraftDifferences(local, saved, '2026-10').length, 1);
  }
});
test('conflict UI keeps comparison collapsed and protects writes without disabling inspection', () => {
  const ui = readFileSync('app/(dashboard)/admin/payroll/PayrollDraftSync.tsx', 'utf8');
  assert.doesNotMatch(ui, /<fieldset disabled=\{!sync.ready/);
  assert.match(ui, /onClickCapture=\{guard\} onChangeCapture=\{guard\} onBeforeInputCapture=\{guard\} onSubmitCapture=\{guard\}/);
  assert.match(ui, /control\?\.hasAttribute\('data-payroll-read-action'\)/);
  assert.doesNotMatch(ui, /<details[^>]*\bopen[ >]/);
  const overview = readFileSync('app/(dashboard)/admin/payroll/PayrollOverviewPreview.tsx', 'utf8');
  assert.match(overview, /<button data-payroll-read-action[^\n]*aria-controls="payroll-preview-checks"/);
  assert.match(overview, /<button data-payroll-read-action[^>]*onClick=\{\(\)=>p.onEmployee/);
  assert.doesNotMatch(overview, /<button data-payroll-read-action[^>]*onClick=\{p.onSave\}/);
});
test('saved drafts do not add persistent labels or disabled save buttons to the overview', () => {
  const ui = readFileSync('app/(dashboard)/admin/payroll/PayrollDraftSync.tsx', 'utf8');
  assert.doesNotMatch(ui, /Правки сохранены|Ручных правок нет|Есть несохранённые правки/);
  assert.match(ui, /if \(historyOnly \? !state.record\?\.revision : !label && !showSave\) return null/);
  assert.match(ui, /!historyOnly && showSave && <button/);
  assert.match(ui, /setTimeout\(\(\) => setShowSaved\(false\), 3000\)/);
  assert.match(ui, /historyOnly && <button data-payroll-read-action/);
  const page = readFileSync('app/(dashboard)/admin/payroll/PayrollClient.tsx', 'utf8');
  assert.match(page, /← Вернуться к расчёту<\/button>\}\s*<PayrollDraftStatus sync=\{draftSync\} historyOnly \/>/);
});
test('first confirmation needs no invented correction, later unchanged drafts and locked/loading states stay protected', () => {
  const initial = { enabled: true, ready: true, locked: false, saving: false, dirty: false, revision: 0 };
  assert.equal(canSavePayrollDraft(initial), true);
  for (const patch of [{ enabled: false }, { ready: false }, { locked: true }, { saving: true }, { revision: undefined }, { revision: 1 }]) {
    assert.equal(canSavePayrollDraft({ ...initial, ...patch }), false);
  }
  assert.equal(canSavePayrollDraft({ ...initial, revision: 1, dirty: true }), true);
});
