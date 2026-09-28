import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chooseDeliveryCashbox, parseDeliveryFundingAmount } from '../lib/procurement-delivery-cashbox-choice';
import type { DeliveryFunding } from '../lib/procurement-delivery-funding';
import type { DeliveryView } from '../lib/procurement-delivery-reminders';
import { ProcurementDeliveryCashboxChoice } from '../components/ProcurementDeliveryCashboxChoice';
import { DeliveryFundingContent } from '../components/ProcurementDeliveryFunding';

const now = Date.now();
const data = (): DeliveryFunding => ({ checkedAt: new Date(now).toISOString(), cashboxes: [
  { ref: 'b', name: 'Касса Ахобекова', balance: 13535, pending: 0, count: 0 },
  { ref: 'a', name: 'Касса Абшаева', balance: 20960, pending: 0, count: 0 },
  { ref: 'c', name: 'Касса Костеренко', balance: 223, pending: 0, count: 0 },
], topups: [], unassignedCount: 0, unassignedAmount: 0, reviewCount: 0 });
const view = (): DeliveryView => ({ snapshot: { balance: 2259, checkedAt: new Date(now).toISOString(), lastIssue: null }, requested: true, requestedByBuyer: false, requestStateAvailable: true });

test('largest book balance wins among boxes able to cover the whole amount', () => {
  const source = data(), result = chooseDeliveryCashbox(source, 10000, now);
  assert.equal(result.selected?.ref, 'a');
  assert.deepEqual(result.candidates.map(b => b.ref), ['a', 'b']);
  assert.equal(result.preliminary, false);
  assert.equal(source.cashboxes[0].ref, 'b', 'source ordering not mutated');
  assert.equal(chooseDeliveryCashbox(source, 32741, now).state, 'insufficient', 'never sums multiple boxes');
  assert.equal(chooseDeliveryCashbox(source, 20960, now).selected?.ref, 'a');
  assert.equal(chooseDeliveryCashbox(source, 20960.01, now).state, 'insufficient');
});

test('allocated pending money is protected, unknown and negative balances excluded', () => {
  const source = data(); source.cashboxes[1].pending = 12000;
  assert.equal(chooseDeliveryCashbox(source, 10000, now).selected?.ref, 'b');
  source.cashboxes[1].pending = null;
  assert.equal(chooseDeliveryCashbox(source, 10000, now).selected?.ref, 'b');
  assert.equal(chooseDeliveryCashbox(source, 10000, now).preliminary, true);
  source.cashboxes[0].balance = -100;
  assert.equal(chooseDeliveryCashbox(source, 10000, now).state, 'unknown');
});

test('ranking uses book balance, not net difference; ties use stable identity', () => {
  const source = data(); source.cashboxes[1].pending = 5000;
  source.cashboxes[0].balance = 20000;
  assert.equal(chooseDeliveryCashbox(source, 10000, now).selected?.ref, 'a');
  source.cashboxes[0].balance = 20960;
  assert.equal(chooseDeliveryCashbox(source, 10000, now).selected?.ref, 'a');
});

test('organization uncertainty is a caveat, not deducted from an arbitrary cashbox', () => {
  const source = data(); source.unassignedCount = 11; source.unassignedAmount = 1014200;
  const result = chooseDeliveryCashbox(source, 10000, now);
  assert.equal(result.selected?.ref, 'a'); assert.equal(result.preliminary, true);
  assert.equal(result.selected?.balance, 20960);
});

test('stale, future, invalid data and native top-ups cannot produce a new choice', () => {
  const source = data();
  assert.equal(chooseDeliveryCashbox(source, 10000, now + 300001).state, 'stale');
  assert.equal(chooseDeliveryCashbox(source, 10000, now - 60001).state, 'stale');
  source.topups = [{ ref: 'r', number: '001', date: '', status: 'not_approved', remaining: null }];
  assert.equal(chooseDeliveryCashbox(source, 10000, now).state, 'existing_request');
  assert.equal(chooseDeliveryCashbox({ ...data(), cashboxes: [] }, 10000, now).state, 'no_cashboxes');
  for (const amount of [null, NaN, Infinity, 0, -1, 1.001, Number.MAX_SAFE_INTEGER]) {
    assert.equal(chooseDeliveryCashbox(data(), amount, now).state, 'invalid_amount');
  }
});

test('RUB input supports comma, space and kopecks, rejects partial or ambiguous amounts', () => {
  for (const text of ['10 000', '10000', '10\u00a0000,00']) assert.equal(parseDeliveryFundingAmount(text), 10000);
  assert.equal(parseDeliveryFundingAmount('123,45'), 123.45);
  for (const text of ['', '0', '-1', '1e4', '1,001', '10.00.00', '100р', 'Infinity']) assert.equal(parseDeliveryFundingAmount(text), null);
});

test('buyer amount takes priority and cash recommendation does not issue or approve anything', () => {
  const v = view(); v.requestedByBuyer = true;
  v.requestDetails = { amount: 10000, comment: '', balance: 2259, checkedAt: new Date(now).toISOString(), requestedAt: new Date(now).toISOString() };
  const html = renderToStaticMarkup(<DeliveryFundingContent data={data()} view={v} now={now} />);
  assert.match(html, /value="10000"/); assert.match(html, /По запросу Астемира/); assert.match(html, /Абшаева/);
  assert.match(html, /10.?960/); assert.match(html, /Сменить/);
  assert.doesNotMatch(html, /Остатки касс менеджеров|Костеренко|Согласовать|Выдать деньги/);
});

test('default amount is recommendation, not buyer request; no cash split is invented', () => {
  const html = renderToStaticMarkup(<ProcurementDeliveryCashboxChoice data={data()} view={view()} now={now} />);
  assert.match(html, /value="32741"/); assert.match(html, /Это не запрос Астемира/);
  assert.match(html, /Одной кассы на эту сумму не хватает/); assert.doesNotMatch(html, /Предлагаем кассу/);
});

test('missing request state or stale reserve does not silently seed an amount', () => {
  assert.equal(renderToStaticMarkup(<ProcurementDeliveryCashboxChoice data={data()} view={{ ...view(), requestStateAvailable: false }} now={now} />), '');
  const html = renderToStaticMarkup(<ProcurementDeliveryCashboxChoice data={data()} view={view()} now={now + 300001} />);
  assert.match(html, /value=""/); assert.doesNotMatch(html, /value="32741"|Предлагаем кассу/);
});

test('existing native request hides new amount input', () => {
  const source = data(); source.topups = [{ ref: 'r', number: '001', date: '', status: 'approved', remaining: 10000 }];
  const html = renderToStaticMarkup(<DeliveryFundingContent data={source} view={view()} now={now} />);
  assert.match(html, /Заявка № 001/); assert.match(html, /уже есть в 1С/);
  assert.doesNotMatch(html, /<input|Предлагаем кассу/);
});
