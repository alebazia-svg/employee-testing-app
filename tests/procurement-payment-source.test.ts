import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSupplierOrder, normalizeSupplierOrders, ordersForManager, ordersRequiringPayment } from '@/lib/procurement-payment-source';

test('manager filter is exact after harmless spelling normalization', () => {
  const rows = [
    normalizeSupplierOrder({ ref: '1', manager: 'Астемир Тохов', supplier_partner: 'A' }),
    normalizeSupplierOrder({ ref: '2', manager: 'Диана', supplier_partner: '95 РУЗИ' }),
    normalizeSupplierOrder({ ref: '3', manager: 'Астемир Тохов помощник', supplier_partner: 'B' }),
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));
  assert.deepEqual(ordersForManager(rows, '  астемир   тохов ').map((row) => row.ref), ['1']);
});

test('order without 1C ref is rejected', () => {
  assert.equal(normalizeSupplierOrder({ manager: 'Астемир Тохов' }), null);
});

test('only orders with a positive payment gap require a payment date', () => {
  const rows = [
    normalizeSupplierOrder({ ref: 'paid', order_payment_gap: 0 }),
    normalizeSupplierOrder({ ref: 'open', order_payment_gap: 12500 }),
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));
  assert.deepEqual(ordersRequiringPayment(rows).map((row) => row.ref), ['open']);
});

test('active and goods-fulfilled orders are both available for payment planning', () => {
  const result = normalizeSupplierOrders(
    [{ ref: 'active', manager: 'Астемир Тохов', supplier_partner: 'A', order_payment_gap: 100 }],
    [{ ref: 'fulfilled', manager: 'Астемир Тохов', supplier_partner: 'B', order_payment_gap: 200 }],
  );
  assert.deepEqual(result.rows.map((row) => row.ref), ['active', 'fulfilled']);
});
