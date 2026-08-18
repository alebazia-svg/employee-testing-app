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
      reasonCode: 'REQUIRED_FISCAL_RECEIPT_MISSING',
    },
  });

  assert.equal(view.summaryTitle, 'Чек по кредитной продаже');
  assert.equal(view.summaryMeta, '00OF-009620 · 130 896 ₽');
  assert.equal(view.notificationBody, 'Реализация 00OF-009620 · 130 896 ₽. Чек не найден. Проверьте оформление в 1С.');
});
