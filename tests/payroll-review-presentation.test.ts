import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payrollReviewPresentation } from '../lib/payroll-review-presentation';
test('review actions distinguish categories, suppliers and stale sources', () => {
  assert.equal(payrollReviewPresentation('Не классифицировано однозначно: 56 строк.').target, 'products');
  assert.equal(payrollReviewPresentation('Нужно решить, учитывать ли 2 новых поставщиков Астемира.').target, 'suppliers');
  assert.equal(payrollReviewPresentation('Новые данные 1С временно недоступны.').title, 'Обновление данных');
});
test('unknown and financial warnings are retained, not downgraded to success', () => {
  for (const issue of ['Неизвестная ошибка', 'Не проверены авансы', 'Себестоимость не завершена']) {
    assert.equal(payrollReviewPresentation(issue).target, 'source');
    assert.ok(payrollReviewPresentation(issue).hint);
  }
});
