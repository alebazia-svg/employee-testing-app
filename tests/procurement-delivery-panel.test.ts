import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import { ProcurementDeliveryPanel } from '../components/ProcurementDeliveryPanel';
import type { DeliveryView } from '../lib/procurement-delivery-reminders';

test('after issue only updated accountable balance remains, not issued/request-sent banners', () => {
  const now = new Date().toISOString();
  const initial: DeliveryView = {
    snapshot: { balance: 17259, checkedAt: now, lastIssue: { amount: 15000, date: now } },
    requested: true, requestedByBuyer: true, requestStateAvailable: true,
    requestDetails: { amount: 15000, balance: 2259, comment: '', requestedAt: now, checkedAt: now },
    nativeRequest: { state: 'linked', automatic: true, status: { ref: 'test', number: 'test', date: now, amount: 15000, state: 'issued', issued: 15000, remaining: 0, cashbox: 'Касса тест', desiredDate: null, checkedAt: now } },
  };
  for (const balance of [17259, 13699]) {
    const html = renderToStaticMarkup(React.createElement(ProcurementDeliveryPanel, { initial: { ...initial, snapshot: { ...initial.snapshot, balance } } }));
    assert.match(html, /Остаток подотчёта/); assert.match(html, /Запросить пополнение/);
    assert.doesNotMatch(html, /Выдано|выдано|Можно получить|Запрос на пополнение отправлен|Касса тест/);
  }
});

test('persisted request is neutral, not an approval, and needs no manual refresh', () => {
  const html = renderToStaticMarkup(React.createElement(ProcurementDeliveryPanel, { initial: {
    snapshot: { balance: 2259, checkedAt: new Date().toISOString(), lastIssue: null, reserveAdvice: { target: 35000, warnAt: 20000 } },
    requested: true, requestedByBuyer: true, requestStateAvailable: true,
  } }));
  assert.match(html, /Запрос на пополнение отправлен/);
  assert.doesNotMatch(html, /Белл|Пелл|Согласовано|Выдача согласована|Запросить пополнение|>Обновить<|Обновите остаток/);
});

test('automatic or old unknown reminder never claims the buyer sent a request', () => {
  for (const requestedByBuyer of [false, undefined]) {
    const html = renderToStaticMarkup(React.createElement(ProcurementDeliveryPanel, { initial: {
      snapshot: { balance: 2259, checkedAt: new Date().toISOString(), lastIssue: null, reserveAdvice: { target: 35000, warnAt: 20000 } },
      requested: true, requestedByBuyer, requestStateAvailable: true,
    } }));
    assert.match(html, /Требуется пополнение/);
    assert.match(html, /Запросить пополнение/);
    assert.doesNotMatch(html, /Запрос на пополнение отправлен|Низкий остаток/);
  }
});

test('uncertain manual request state does not claim successful submission', () => {
  const html = renderToStaticMarkup(React.createElement(ProcurementDeliveryPanel, { initial: {
    snapshot: { balance: 2259, checkedAt: new Date().toISOString(), lastIssue: null },
    requested: true, requestedByBuyer: true, requestStateAvailable: false,
  } }));
  assert.doesNotMatch(html, /Запрос на пополнение отправлен/);
  assert.match(html, /<button type="button" disabled=""/);
});

test('unavailable data explains automatic recovery and blocks a new request', () => {
  const html = renderToStaticMarkup(React.createElement(ProcurementDeliveryPanel, { initial: {
    snapshot: { balance: null, checkedAt: '', lastIssue: null }, requested: false, requestStateAvailable: false,
  } }));
  assert.match(html, /Данные временно недоступны\. Обновим автоматически\./);
  assert.match(html, /<button type="button" disabled=""/);
  assert.doesNotMatch(html, />Обновить<|Обновите/);
});

test('visible sync is cleaned up, deduplicated and does not reload the calendar', async () => {
  const code = await readFile('components/ProcurementDeliveryPanel.tsx', 'utf8');
  for (const pattern of [/startVisibleSync\(refresh, 60_000\)/, /activeRequest.current \|\|/, /lastRead.current < 10_000/,
    /addEventListener\('online', refresh\)/, /removeEventListener\('online', refresh\)/, /stop\(\)/,
    /controller\?\.abort\(\)/, /activeRequest.current !== controller/]) assert.match(code, pattern);
  assert.doesNotMatch(code, /router\.refresh|location\.reload/);
});
