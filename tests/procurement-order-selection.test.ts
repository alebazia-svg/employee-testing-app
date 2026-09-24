import test from 'node:test';
import assert from 'node:assert/strict';
import { ordersForRequest, reviewRequestCondition } from '../lib/procurement-order-selection';

test('request linking includes every financial state within 90 calendar days only', () => {
  const rows = [
    { ref: 'old', planningState: 'needs_review', orderPaymentGap: 0 },
    { ref: 'debt', planningState: 'receipt_debt', orderPaymentGap: 1000 },
    { ref: 'paid', planningState: 'settled', orderPaymentGap: 1000 },
    { ref: 'small', planningState: 'small_balance', orderPaymentGap: 464 },
    ...[0, 11, 464, 500].map(orderPaymentGap => ({ ref: String(orderPaymentGap), orderPaymentGap })),
  ];
  const dated = rows.map(row => ({ ...row, date: '2026-09-24' }));
  assert.deepEqual(ordersForRequest(dated, '2026-09-24').map(row => row.ref), rows.map(row => row.ref));
  assert.deepEqual(ordersForRequest([
    { date: '2026-06-26', ref: 'outside' }, { date: '27.06.2026 12:00:00', ref: 'first' },
    { date: '2026-09-24', ref: 'today' }, { date: '2026-09-25', ref: 'future' },
    { date: '', ref: 'invalid' },
  ], '2026-09-24').map(row => row.ref), ['first', 'today']);
});

test('manager receives review warning, original order number and purchaser explanation', () => {
  const note = reviewRequestCondition([{ planningState: 'needs_review', number: '000123', planningReason: 'Есть авансы' }], 'Новая поставка');
  assert.match(note, /000123/);
  assert.match(note, /не подтверждена/);
  assert.match(note, /Есть авансы/);
  assert.match(note, /Новая поставка/);
  assert.equal(reviewRequestCondition([{ planningState: 'receipt_debt' }], 'обычная оплата'), 'обычная оплата');
});
