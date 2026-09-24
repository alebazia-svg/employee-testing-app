import test from 'node:test';
import assert from 'node:assert/strict';
import { procurementWorkingOrders } from '../lib/procurement-working-orders';
import { fetchSupplierOrderFinance } from '../lib/procurement-payment-source';

const row = (ref: string, date: string, gap = 10000, controlGroup = '') => ({ ref, date, orderPaymentGap: gap, controlGroup });
test('90-day boundary; prepayments stay; old orders are history, never rewritten as paid', () => {
  const input = [row('boundary', '2026-06-26'), row('old', '2026-06-25'), row('prepayment', '2026-09-24')];
  const before = structuredClone(input);
  const result = procurementWorkingOrders(input, '2026-09-24');
  assert.deepEqual(result.working.map(r => r.ref), ['boundary', 'prepayment']);
  assert.deepEqual(result.historical.map(r => r.ref), ['old']);
  assert.deepEqual(input, before);
  assert.equal(result.historical[0].orderPaymentGap, 10000);
});
test('old unfinished requests and verified material receipt debt stay in work', () => {
  const result = procurementWorkingOrders([
    row('request', '2025-01-01', 0), row('verified', '2025-01-01', 501, 'verified_receipt_debt'),
    row('unverified', '2025-01-01', 900000), row('tiny', '2025-01-01', 500, 'verified_receipt_debt'),
  ], '2026-09-24', ['request']);
  assert.deepEqual(result.working.map(r => r.ref), ['request', 'verified']);
  assert.deepEqual(result.historical.map(r => r.ref), ['unverified']);
  assert.deepEqual(result.small.map(r => r.ref), ['tiny']);
});
test('invalid date is not a reason to hide; Russian dates and leap-day validation', () => {
  const result = procurementWorkingOrders([
    row('missing', ''), row('invalid', '2026-02-30'), row('ru-old', '01.01.2026 12:00:00'),
    row('ru-new', '24.09.2026 12:00:00'), row('future', '2026-10-01'),
  ], '2026-09-24');
  assert.deepEqual(result.historical.map(r => r.ref), ['ru-old']);
  assert.equal(result.working.length, 4);
  assert.equal(procurementWorkingOrders([row('old', '2020-01-01')], '').working.length, 1);
});
test('small balances do not enter either payment picker; records remain available to accounting', () => {
  const input = [row('a', '2026-09-24', .4), row('b', '2026-01-01', 500), row('c', '2026-09-24', 500.01)];
  const result = procurementWorkingOrders(input, '2026-09-24');
  assert.equal(result.small.length, 2);
  assert.equal(result.working[0].ref, 'c');
  assert.equal(input.length, 3);
});
test('normal source reads once, even with old experimental flag: no global sweep or lost prepayments', async t => {
  const env = { ...process.env }; t.after(() => { process.env = env; });
  process.env.PROCUREMENT_PLANNING_MODE = 'verified-receipts';
  process.env['1C_BASE_URL'] = 'https://one-c.invalid';
  process.env['1C_API_USER'] = 'test'; process.env['1C_API_PASSWORD'] = 'test';
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    urls.push(url);
    return Response.json({ ok: true, completeness: { complete: true }, fulfilled_goods_orders: [],
      active_goods_orders: [{ ref: 'prepay', order_payment_gap: 700000, receipt_amount: 0 }] });
  });
  const source = await fetchSupplierOrderFinance();
  assert.equal(source.complete, true);
  assert.equal(source.rows[0].orderPaymentGap, 700000);
  assert.equal(urls.length, 1);
  assert.ok(urls[0].includes('/supplier-order-finance-control?'));
});
