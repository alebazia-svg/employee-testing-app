import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { DeliveryFundingContent, ProcurementDeliveryFunding, DeliveryFundingOrganizationReview } from '../components/ProcurementDeliveryFunding';
import { ProcurementDeliveryAdmin } from '../components/ProcurementDeliveryAdmin';
test('shows accounting balance and plans separately without issuing/approval controls', () => {
  const html = renderToStaticMarkup(<DeliveryFundingContent data={{ checkedAt: new Date().toISOString(),
    cashboxes: [{ ref: 'a', name: 'Касса', balance: 20000, pending: 7000, count: 1 }],
    topups: [{ ref: 'b', number: '001', date: '', status: 'not_approved', remaining: null }], unassignedCount: 2, unassignedAmount: 3000, reviewCount: 1 }} />);
  assert.match(html, /Кассы менеджеров/); assert.doesNotMatch(html, /Без указанной кассы|3.?000/); assert.match(html, /Не согласована/); assert.match(html, /Остаток нужно проверить/);
  assert.doesNotMatch(html, /Согласовать|Выдать деньги|Свободно|Рекомендуем|<button/);
  assert.doesNotMatch(html, /<details|<input/); assert.match(html, /Ещё не выдано по заявкам/);
});
test('normal compact screen has only manager balances, no empty request section or zero obligations', () => {
  const html = renderToStaticMarkup(<DeliveryFundingContent data={{ checkedAt: new Date().toISOString(),
    cashboxes: [{ ref: 'a', name: 'Касса Абшаева', balance: 20960, pending: 0, count: 0 }],
    topups: [], unassignedCount: 11, unassignedAmount: 1014200, reviewCount: 0 }} />);
  assert.match(html, /Абшаева/); assert.match(html, /По учёту 1С/);
  assert.doesNotMatch(html, /Заявки на|Незавершённых|По заявкам|Ещё не выдано|1014200|1.?014.?200|<details|<input|Обновление автоматически/);
});
test('unknown obligation stays visible and organization checks are separate and collapsed', () => {
  const data = { checkedAt: new Date().toISOString(), cashboxes: [{ ref: 'a', name: 'Касса', balance: 1, pending: null, count: 1 }], topups: [], unassignedCount: 2, unassignedAmount: 3000, reviewCount: 1 };
  assert.match(renderToStaticMarkup(<DeliveryFundingContent data={data} />), /Сумму по заявкам нужно проверить/);
  const html = renderToStaticMarkup(<DeliveryFundingOrganizationReview data={data} />);
  assert.match(html, /Проверка заявок организации/); assert.match(html, /не сумма пополнения Астемиру/);
  assert.match(html, /<details/); assert.doesNotMatch(html, /<details open/);
  assert.equal(renderToStaticMarkup(<DeliveryFundingOrganizationReview data={{ ...data, unassignedCount: 0, reviewCount: 0 }} />), '');
});
test('admin recommendation is distinct from manual request and has one snapshot timestamp', () => {
  const html = renderToStaticMarkup(<ProcurementDeliveryAdmin view={{ snapshot: { balance: 2259, checkedAt: new Date().toISOString(), lastIssue: null }, requested: true, requestedByBuyer: false, requestStateAvailable: true }} />);
  assert.match(html, /Рекомендуем пополнить/); assert.match(html, /До запаса/); assert.match(html, /Нужно пополнить/);
  assert.doesNotMatch(html, /Пополнение на контроле|Астемир запросил|Новую заявку оформляйте/);
  assert.equal((html.match(/Подотчёт на/g) ?? []).length, 1);
});
test('loading does not present zero money', () => {
  const html = renderToStaticMarkup(<ProcurementDeliveryFunding />); assert.match(html, /Проверяем кассы/); assert.doesNotMatch(html, /0 ₽/);
});
test('visible auto-refresh is deduplicated, aborted and hides failed/stale values', () => {
  const code = readFileSync('components/ProcurementDeliveryFunding.tsx', 'utf8');
  for (const pattern of [/startVisibleSync\(refresh, 60_000\)/, /active.current \|\|/, /setData\(null\)/, /DELIVERY_MAX_AGE_MS/, /c\?\.abort\(\)/, /removeEventListener/]) assert.match(code, pattern);
  assert.doesNotMatch(code, /method: 'POST'|router.refresh|location.reload/);
});
