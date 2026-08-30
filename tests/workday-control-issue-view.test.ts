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
  assert.equal(view.notificationBody, 'Реализация 00OF-009620 · 130 896 ₽. Чек не найден — откройте проверку.');
  assert.equal(view.actionTitle, 'Пробейте чек из реализации');
  assert.equal(view.instruction, 'Откройте реализацию 00OF-009620 в 1С и пробейте чек с передачей всей суммы 130 896 ₽ в кредит.');
});

test('missing initial-payment receipt instructions name the exact source document', () => {
  const base = { ruleKey: 'credit_realization_mismatch', title: 'Чек по кредитной продаже', detail: '', sourceData: {} };
  assert.match(workdayIssueView({ ...base, sourceData: { reasonCode: 'REQUIRED_CASH_RECEIPT_FISCAL_RECEIPT_MISSING' } }).instruction, /ПКО по этой реализации/);
  assert.match(workdayIssueView({ ...base, sourceData: { reasonCode: 'REQUIRED_ACQUIRING_FISCAL_RECEIPT_MISSING' } }).instruction, /эквайринговую операцию/);
});

test('shows the exact linked payment document and credit split', () => {
  const view = workdayIssueView({
    ruleKey: 'credit_realization_mismatch', title: 'Чек по кредитной продаже', detail: '',
    sourceData: {
      documentNumber: 'R-1', amountKopecks: 14_200_600,
      reasonCode: 'REQUIRED_CASH_RECEIPT_FISCAL_RECEIPT_MISSING',
      paymentDocumentNumber: 'PKO-1', paymentAmountKopecks: 1_000_000, expectedCreditKopecks: 13_200_600,
    },
  });
  assert.equal(view.actionTitle, 'Пробейте чек из ПКО');
  assert.match(view.instruction, /ПКО PKO-1/);
  assert.match(view.instruction, /10 000 ₽ первоначальный взнос/);
  assert.match(view.instruction, /132 006 ₽ в кредит/);
});
