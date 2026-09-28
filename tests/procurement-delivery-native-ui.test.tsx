import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProcurementDeliveryNativeStatus } from '../components/ProcurementDeliveryNativeStatus';
import type { DeliveryNativeStatus } from '../lib/procurement-delivery-native';
const base: DeliveryNativeStatus = { ref: 'test', number: 'test-1', date: '2026-09-28', amount: 15000, state: 'payable', issued: 0, remaining: 15000, cashbox: 'Касса тест', desiredDate: '2026-09-29', checkedAt: new Date().toISOString() };
const render = (s: DeliveryNativeStatus) => renderToStaticMarkup(<ProcurementDeliveryNativeStatus view={{ state: 'linked', status: s }} />);
test('admin copy distinguishes requested cashbox/date from issue evidence', () => {
  const html = render(base); assert.match(html, /К выдаче/); assert.match(html, /Деньги ещё не выданы/); assert.match(html, /По заявке: /); assert.match(html, /Желаемая дата/);
  assert.doesNotMatch(html, /Получите|Заберите|Белла|регистр|версия|UUID/);
});
const buyer = (s: DeliveryNativeStatus, failed = false) => renderToStaticMarkup(<ProcurementDeliveryNativeStatus audience="buyer" failed={failed} view={{ state: 'linked', status: s }} />);
test('buyer sees explicit collection permission, amount and cashbox only for payable', () => {
  const html = buyer(base);
  assert.match(html, /Можно получить/); assert.match(html, /15\s000/); assert.match(html, /Касса тест/);
  assert.doesNotMatch(html, /Заявка|заявке|Желаемая дата|Деньги ещё не выданы|Милана|Белла|Подойдите/);
  for (const state of ['waiting', 'approved', 'review', 'rejected', 'issued', 'partial'] as const) assert.doesNotMatch(buyer({ ...base, state }), /Можно получить/);
});
test('missing cashbox, stale or failed status never invites collection', () => {
  assert.equal(buyer({ ...base, cashbox: null }), '');
  assert.doesNotMatch(buyer({ ...base, cashbox: null }), /Можно получить/);
  for (const html of [buyer({ ...base, checkedAt: '2020-01-01' }), buyer(base, true)]) {
    assert.doesNotMatch(html, /Можно получить|Касса тест/); assert.match(html, /временно недоступен/);
  }
});
test('buyer sees only remaining collectible money; completed issue disappears', () => {
  const issued = buyer({ ...base, state: 'issued', issued: 15000, remaining: 0 });
  assert.equal(issued, '');
  const partial = buyer({ ...base, state: 'partial', issued: 5000, remaining: 10000, canCollect: true });
  assert.match(partial, /Можно получить/); assert.match(partial, /10\s000/);
  assert.doesNotMatch(partial, /Выдано|Осталось выдать|15\s000|5\s000/);
  assert.equal(buyer({ ...base, state: 'partial', issued: 5000, remaining: 10000, canCollect: false }), '');
});
test('partial and confirmed issue are distinct; stale approval hidden', () => {
  assert.match(render({ ...base, state: 'partial', issued: 5000, remaining: 10000 }), /Осталось выдать/);
  assert.match(render({ ...base, state: 'issued', issued: 15000, remaining: 0 }), /Пополнение выдано/);
  const stale = render({ ...base, checkedAt: '2020-01-01' }); assert.match(stale, /временно недоступен/); assert.doesNotMatch(stale, /К выдаче|Касса тест/);
});
