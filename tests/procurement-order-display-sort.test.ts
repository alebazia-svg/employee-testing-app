import assert from 'node:assert/strict';
import test from 'node:test';
import { ordersForNewPayment, sortByUnplannedAmount, sortPaymentPickerOrders } from '../lib/procurement-payment-priority';

const row = (ref: string, supplierPartner: string, orderPaymentGap: number, unplannedAmount = orderPaymentGap) =>
  ({ ref, supplierPartner, orderPaymentGap, unplannedAmount });

test('new planning excludes balances through 500 rubles but preserves exact source balances', () => {
  const rows = [0, .36, .4, 1, 10, 100, 499.99, 500, 500.01, 9000].map((value, i) => row(String(i), 'A', value));
  const before = JSON.stringify(rows);
  assert.deepEqual(ordersForNewPayment(rows).map(x => x.orderPaymentGap), [500.01, 9000]);
  assert.equal(JSON.stringify(rows), before);
});

test('already planned orders are excluded, but partial reservation is not mistaken for a small order balance', () => {
  assert.deepEqual(ordersForNewPayment([row('reserved', 'A', 10000, 0), row('part', 'A', 10000, 100)]).map(x => x.ref), ['part']);
});

test('planning shows largest unplanned amounts first without removing small balances', () => {
  const rows = [row('kopecks', 'A', .4), row('large', 'B', 90000, 3000), row('small', 'C', 500), row('medium', 'D', 5000)];
  const before = [...rows];
  assert.deepEqual(sortByUnplannedAmount(rows).map(x => x.ref), ['medium', 'large', 'small', 'kopecks']);
  assert.deepEqual(rows, before);
});

test('picker ranks supplier totals then order balances and preserves groups', () => {
  const rows = [row('a-small', 'A', .4), row('b', 'B', 10000), row('a-large', 'A', 9000), row('a-medium', 'A', 5000), row('c', 'C', 500)];
  assert.deepEqual(sortPaymentPickerOrders(rows).map(x => x.ref), ['a-large', 'a-medium', 'a-small', 'b', 'c']);
  assert.equal(rows[0].ref, 'a-small');
});

test('debt-only picker uses supplier debt and equal amounts keep stable order', () => {
  assert.deepEqual(sortPaymentPickerOrders([row('debt:A', 'A', 0, 500), row('debt:B', 'B', 0, 9000)]).map(x => x.ref), ['debt:B', 'debt:A']);
  assert.deepEqual(sortPaymentPickerOrders([row('one', 'A', 500), row('two', 'A', 500)]).map(x => x.ref), ['one', 'two']);
  assert.deepEqual(sortPaymentPickerOrders([]), []);
});
