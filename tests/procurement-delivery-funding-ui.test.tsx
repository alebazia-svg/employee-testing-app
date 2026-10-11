import { DeliveryDialogActionContext, ProcurementDeliveryDialogActions } from '../components/ProcurementDeliveryDialogActions';
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
  assert.equal((html.match(/Остаток обновлён/g) ?? []).length, 1);
});
test('loading does not present zero money', () => {
  const html = renderToStaticMarkup(<ProcurementDeliveryFunding />); assert.match(html, /Проверяем кассы/); assert.doesNotMatch(html, /0 ₽/);
});
test('compact request opens one labelled dialog with its form mounted while closed', () => {
  const html = renderToStaticMarkup(<ProcurementDeliveryAdmin compactSummary view={{
    snapshot: { balance: 2259, checkedAt: new Date().toISOString(), lastIssue: null },
    requested: true, requestedByBuyer: true, requestStateAvailable: true,
    requestDetails: { amount: 15000, comment: 'Пять поставок', balance: 2000, checkedAt: new Date().toISOString(), requestedAt: new Date().toISOString() },
  }}><div>Действие по заявке</div></ProcurementDeliveryAdmin>);
  assert.match(html, /Подотчёт/); assert.match(html, /15\s000/); assert.match(html, /Сейчас под отчётом/);
  assert.match(html, /Пять поставок/); assert.doesNotMatch(html, /Остаток подотчёта и сведения о запросе/);
  assert.equal((html.match(/<dialog /g) ?? []).length, 1); assert.match(html, /aria-haspopup="dialog"/); assert.match(html, /aria-labelledby=/); assert.doesNotMatch(html, /<dialog[^>]* open/); assert.match(html, /Дополнительные действия/);
  assert.doesNotMatch(html, /bg-slate-50 p-4|До запаса/);
  assert.doesNotMatch(html, /md:grid-cols-2|md:border-l/); assert.match(html, /Нужно решение/); assert.match(html, /Действие по заявке/);
  const link = readFileSync('components/ProcurementDeliveryLink.tsx', 'utf8');
  assert.match(link, /mt-3 w-fit shrink-0 rounded-lg/);
  assert.doesNotMatch(link, /className="[^"]*w-full[^"]*">Выбрать заявку|Выберите заявку по этому запросу/);
});
test('visible auto-refresh is deduplicated, aborted and hides failed/stale values', () => {
  const code = readFileSync('components/ProcurementDeliveryFunding.tsx', 'utf8');
  for (const pattern of [/startVisibleSync\(refresh, 60_000\)/, /active.current \|\|/, /setData\(null\)/, /DELIVERY_MAX_AGE_MS/, /c\?\.abort\(\)/, /removeEventListener/]) assert.match(code, pattern);
  assert.doesNotMatch(code, /method: 'POST'|router.refresh|location.reload/);
});


test('issued request leaves current queue, preserves refresh child, and reversal reopens it', () => {
  const now = Date.now(), at = new Date(now).toISOString();
  const view: import('../lib/procurement-delivery-reminders').DeliveryView = {
    snapshot: { balance: 9791, checkedAt: at, lastIssue: null }, requested: true, requestedByBuyer: true, requestStateAvailable: true,
    requestDetails: { amount: 5000, comment: 'Старый запрос', balance: 4791, checkedAt: at, requestedAt: at },
    nativeRequest: { state: 'linked', status: { ref: 'test', number: 'TEST', date: at, amount: 5000, state: 'issued', issued: 5000, remaining: 0, cashbox: 'Касса', desiredDate: null, checkedAt: at } },
  };
  const render = () => renderToStaticMarkup(<ProcurementDeliveryAdmin view={view} compactSummary now={now}><div>Документ TEST</div></ProcurementDeliveryAdmin>);
  let html = render();
  assert.match(html, /^<div hidden/); assert.match(html, /Документ TEST/);
  assert.doesNotMatch(html, /Нужно пополнить|Запросил|Старый запрос|Рекомендуем пополнить|<details open/);
  assert.doesNotMatch(html, /<section|<summary/);
  view.nativeRequest!.status!.state = 'partial'; view.nativeRequest!.status!.remaining = 2000;
  html = render(); assert.match(html, /Выдано частично/); assert.doesNotMatch(html, /запрос выполнен|Нужно пополнить/);
  view.nativeRequest!.status!.state = 'payable';
  html = render(); assert.match(html, /К оплате · ожидает выдачи/); assert.doesNotMatch(html, /Нужно пополнить|запрос выполнен/);
  view.nativeRequest!.status!.state = 'issued'; view.nativeRequest!.status!.checkedAt = new Date(now - 3600000).toISOString();
  html = render(); assert.doesNotMatch(html, /запрос выполнен/); assert.match(html, /Проверяем статус/);
  view.nativeRequest = { state: 'unavailable' };
  html = render(); assert.doesNotMatch(html, /запрос выполнен|Нужно пополнить/); assert.match(html, /Проверяем статус/);
});


test('dialog actions cannot remain available when the request data or session is unavailable', () => {
  const html = renderToStaticMarkup(<DeliveryDialogActionContext.Provider value={{ target: null, enabled: false }}><ProcurementDeliveryDialogActions><button>Создать заявку к оплате</button></ProcurementDeliveryDialogActions></DeliveryDialogActionContext.Provider>);
  assert.equal(html, '');
});

test('standalone form keeps its action without a dialog', () => {
  const html = renderToStaticMarkup(<ProcurementDeliveryDialogActions><button>Проверить заявку</button></ProcurementDeliveryDialogActions>);
  assert.match(html, /Проверить заявку/);
});
