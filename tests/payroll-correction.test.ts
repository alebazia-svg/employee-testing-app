import assert from 'node:assert/strict';
import { test } from 'node:test';
import { payrollCorrectionDraft, payrollCorrectionMatches } from '../lib/payroll-correction';

test('correction preserves saved manual inputs, deductions, Finbox and individual premiums without changing the final', () => {
  const empty = { workedDays: null, lateCount: null, advance: null, agentCreditCommission: null, fixedBonus: null, fixedDeduction: null, purchaseAdvance: null, purchaseDeduction: null, comment: '' };
  const run = { manualInputs: [
    { ...empty, employeeName: 'Диана', inputType: 'sales', workedDays: '0', lateCount: '', agentCreditCommission: '88961.47', advance: '7500', source: 'manualCorrection' },
    { ...empty, employeeName: 'Оклад', inputType: 'fixed', fixedBonus: '500', fixedDeduction: '100' },
    { ...empty, employeeName: 'Закупки', inputType: 'purchase', purchaseAdvance: '300', purchaseDeduction: '40', comment: 'Согласовано' },
  ], employeeResults: [{ employeeName: 'Диана', adjustments: [{ id: 12, type: 'ONE_TIME_BONUS', amount: 1500, reason: 'Премия' }, { id: 13, type: 'OTHER', amount: 99, reason: 'Не премия' }] }] };
  const before = JSON.stringify(run);
  const draft = payrollCorrectionDraft(run);
  assert.equal(draft.manual['Диана'].workedDays, '0');
  assert.equal(draft.manual['Диана'].lateCount, '');
  assert.equal(draft.manual['Диана'].agentCreditCommission, '88961.47');
  assert.equal(draft.manual['Диана'].advance, '7500');
  assert.equal(draft.fixed['Оклад'].deduction, '100');
  assert.deepEqual(draft.purchase, { advance: '300', deduction: '40', comment: 'Согласовано' });
  assert.deepEqual(draft.bonuses, [{ id: 'saved-12', employeeName: 'Диана', amount: '1500', reason: 'Премия' }]);
  draft.manual['Диана'].workedDays = '15';
  assert.equal(JSON.stringify(run), before);
});

test('only the exact current final grants correction access', () => {
  assert.equal(payrollCorrectionMatches(12, 12), true);
  for (const requested of [undefined, null, 11, 0, -1, 12.5, '12', NaN]) assert.equal(payrollCorrectionMatches(12, requested), false);
  assert.equal(payrollCorrectionMatches(undefined, 12), false);
});

test('automatic final advances are re-read from 1C rather than deducted twice as manual input', () => {
  const input = { employeeName: 'Милана', inputType: 'sales', workedDays: '20', lateCount: '0', advance: '9500', agentCreditCommission: null, fixedBonus: null, fixedDeduction: null, purchaseAdvance: null, purchaseDeduction: null, comment: '', source: 'attendance' };
  const draft = payrollCorrectionDraft({ sourceSummary: { kind: 'automatic-1c-v1' }, manualInputs: [input], employeeResults: [{ employeeName: 'Милана', calculationDetails: [{ component: 'Аванс', comment: 'Расходник №123 от 01.10.2026: 9500' }] }] });
  assert.equal(draft.manual['Милана'].advance, '');
  assert.equal(draft.manual['Милана'].workedDays, '20');
  assert.equal(input.advance, '9500');
  const manual = payrollCorrectionDraft({ sourceSummary: { kind: 'automatic-1c-v1' }, manualInputs: [input], employeeResults: [] });
  assert.equal(manual.manual['Милана'].advance, '9500', 'an undocumented manual advance must not be dropped');
});
