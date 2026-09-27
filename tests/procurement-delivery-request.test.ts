import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseDeliveryRequest, deliveryAmountFromText, readDeliveryDetails } from '../lib/procurement-delivery-request';
import { ProcurementDeliveryRequestDialog } from '../components/ProcurementDeliveryRequestDialog';
import { ProcurementDeliveryAdmin } from '../components/ProcurementDeliveryAdmin';

test('amount entry accepts rubles/kopecks, never rounds invalid input or accepts extra authority', () => {
  for (const text of ['32 741,50', '32741.50', '32\u202f741,50']) assert.equal(deliveryAmountFromText(text), 32741.5);
  for (const text of ['', '0', '-10', '1e4', '1.001', 'Infinity', '1,2,3']) assert.equal(deliveryAmountFromText(text), null);
  for (const data of [null, [], {}, { amount: NaN }, { amount: 0 }, { amount: 1.111 }, { amount: '100' }, { amount: 100, cashbox: 'cash' }, { amount: 100, comment: 'x'.repeat(501) }]) assert.equal(parseDeliveryRequest(data), null);
  assert.deepEqual(parseDeliveryRequest({ amount: 50000, comment: '  Срочная доставка  ' }), { amount: 50000, comment: 'Срочная доставка' });
});

test('old text-only records are not presented as a guessed amount', () => {
  assert.equal(readDeliveryDetails('Астемир запросил пополнение.'), null);
  assert.equal(readDeliveryDetails(JSON.stringify({ version: 1, amount: 100 })), null);
});

test('dialog prefills the gap, explains it once, supports cancel and optional comment', () => {
  const html = renderToStaticMarkup(React.createElement(ProcurementDeliveryRequestDialog, {
    balance: 2259, pending: false, available: true, error: '', onCancel() {}, onSubmit() {},
  }));
  for (const pattern of [/value="32741"/, /Сумма пополнения/, /необязательно/, /Отправить запрос/, /Отмена/, /после согласования/]) assert.match(html, pattern);
  assert.doesNotMatch(html, /Белла|Касса|Выдача согласована/);
});

test('admin separates the requested amount and historical balance from current recommendation; escapes comments', () => {
  const html = renderToStaticMarkup(React.createElement(ProcurementDeliveryAdmin, { view: {
    snapshot: { balance: 1000, checkedAt: new Date().toISOString(), lastIssue: null }, requested: true, requestedByBuyer: true, requestStateAvailable: true,
    requestDetails: { amount: 40000, comment: '<script>delivery</script>', balance: 2259, checkedAt: new Date().toISOString(), requestedAt: new Date().toISOString() },
  } }));
  assert.match(html, /Астемир запросил/); assert.match(html, /40\s000/); assert.match(html, /34\s000/); assert.match(html, /2\s259/);
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>|Выдача согласована/);
});
