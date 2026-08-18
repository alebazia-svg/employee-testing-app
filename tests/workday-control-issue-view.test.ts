import assert from 'node:assert/strict';
import test from 'node:test';
import { workdayIssueView } from '../lib/workday-control-issue-view';

test('credit issue summary is compact and identifies the realization on mobile', () => {
  const view = workdayIssueView({
    ruleKey: 'credit_realization_mismatch',
    title: 'Проверьте кредитную продажу',
    detail: 'Техническая детализация',
    sourceData: {
      documentNumber: '00OF-009620',
      amountKopecks: 13_089_600,
      reasonCode: 'REQUIRED_REALIZATION_FISCAL_RECEIPT_MISSING',
    },
  });

  assert.equal(view.summaryTitle, 'Чек по кредитной продаже');
  assert.equal(view.summaryMeta, '00OF-009620 · 130 896 ₽');
  assert.equal(view.notificationBody, 'Реализация 00OF-009620 · 130 896 ₽. Чек не найден. Проверьте оформление в 1С.');
  assert.equal(view.instruction, 'Чек по реализации не найден. Откройте реализацию в 1С и пробейте чек с передачей суммы в кредит.');
});

test('missing initial-payment receipt instructions name the exact source document', () => {
  const base = { ruleKey: 'credit_realization_mismatch', title: 'Чек по кредитной продаже', detail: '', sourceData: {} };
  assert.match(workdayIssueView({ ...base, sourceData: { reasonCode: 'REQUIRED_CASH_RECEIPT_FISCAL_RECEIPT_MISSING' } }).instruction, /связанный ПКО/);
  assert.match(workdayIssueView({ ...base, sourceData: { reasonCode: 'REQUIRED_ACQUIRING_FISCAL_RECEIPT_MISSING' } }).instruction, /эквайринговую операцию/);
});
