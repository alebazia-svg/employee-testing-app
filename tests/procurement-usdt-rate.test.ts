import assert from 'node:assert/strict';
import test from 'node:test';
import { latestUsdtRateFromPayload } from '../lib/procurement-usdt-rate';

test('latest posted conversion rate is selected from the 1C costing payload', () => {
  const result = latestUsdtRateFromPayload({ events: [
    { event_type: 'buy', date: '2026-09-01T10:00:00', number: '1', currency_amount: 1000, rub_value: 88000, document_rate: 88 },
    { event_type: 'supplier_payment', date: '2026-09-02T10:00:00', currency_amount: 500, document_rate: 0 },
    { event_type: 'buy', date: '2026-09-09T12:00:00', number: '2', currency_amount: 8000, rub_value: 712000, document_rate: 89 },
  ] }, '2026-09-09T13:00:00.000Z');
  assert.equal(result.rate, 89);
  assert.equal(result.conversionAt, '2026-09-09T09:00:00.000Z');
  assert.equal(result.documentNumber, '2');
  assert.equal(result.currencyAmount, 8000);
  assert.equal(result.rubValue, 712000);
});

test('effective rate is derived when the document rate is absent', () => {
  const result = latestUsdtRateFromPayload({ events: [
    { event_type: 'buy', date: '2026-09-09T12:00:00', currency_amount: 4000, rub_value: 356000 },
  ] });
  assert.equal(result.rate, 89);
});

test('1C presentation dates are normalized before reaching the interface', () => {
  const result = latestUsdtRateFromPayload({ events: [
    { event_type: 'buy', date: '09.09.2026 12:00:00', currency_amount: 4000, rub_value: 356000, document_rate: 89 },
  ] });
  assert.match(result.conversionAt, /^2026-09-09T/);
});
