import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import { ProcurementDeliveryPanel } from '../components/ProcurementDeliveryPanel';

test('persisted request is neutral, not an approval, and needs no manual refresh', () => {
  const html = renderToStaticMarkup(React.createElement(ProcurementDeliveryPanel, { initial: {
    snapshot: { balance: 2259, checkedAt: new Date().toISOString(), lastIssue: null, reserveAdvice: { target: 35000, warnAt: 20000 } },
    requested: true, requestStateAvailable: true,
  } }));
  assert.match(html, /Запрос на пополнение отправлен/);
  assert.doesNotMatch(html, /Белл|Пелл|Согласовано|Выдача согласована|Запросить пополнение|>Обновить<|Обновите остаток/);
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
