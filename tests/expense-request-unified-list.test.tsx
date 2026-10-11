import { deliveryQueueStage, requestWaitingAge } from '../lib/expense-request-queue';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExpenseRequestsList, type ExpenseListRow } from '../components/ExpenseRequestsList';
import { retainDeliveryIdentity } from '../lib/expense-request-unified-list';
import type { DeliveryView } from '../lib/procurement-delivery-reminders';
const at = new Date().toISOString();
const ref = '33333333-3333-3333-3333-333333333333';
const view: DeliveryView = { snapshot: { balance: 0, checkedAt: at, lastIssue: null }, requested: true, requestedByBuyer: true,
 requestStateAvailable: true, requestDetails: { amount: 5000, requestedAt: at, checkedAt: at, balance: 0, comment: 'На доставку' },
 nativeRequest: { state: 'linked', status: { ref, number: 'ТЕСТ-002', date: at, amount: 5000, issued: 0, remaining: 5000,
 state: 'payable', cashbox: 'Касса магазина', desiredDate: null, checkedAt: at } } };
const rows: ExpenseListRow[] = [{ id: 'duplicate', nativeRef: ref, date: at, content: <span>IMPORTED_DUPLICATE</span> },
 { id: 'other', nativeRef: '44444444-4444-4444-4444-444444444444', date: at, content: <span>OTHER_REQUEST</span> }];
const render = (delivery = view, query = '', items = rows) => renderToStaticMarkup(<ExpenseRequestsList rows={items} delivery={delivery} query={query} empty={<span>EMPTY_QUEUE</span>} />);
test('one exact native identity becomes one row; other requests stay visible', () => {
 const html = render();
 assert.doesNotMatch(html, /IMPORTED_DUPLICATE|EMPTY_QUEUE/);
 assert.match(html, /OTHER_REQUEST/); assert.match(html, /К оплате · ожидает выдачи/);
});
test('pre-1C request remains searchable in common queue without hiding unrelated documents', () => {
 const pending = { ...view, nativeRequest: { state: 'unlinked' as const } };
 const html = render(pending, 'АСТЕМИР', []);
 assert.match(html, /Заявка в 1С ещё не создана/); assert.doesNotMatch(html, /EMPTY_QUEUE/);
 assert.match(render(pending, 'совсем другой запрос', []), /EMPTY_QUEUE/);
 assert.match(render(pending), /IMPORTED_DUPLICATE/);
});
test('posted full issue removes current request including stale import; partial and unavailable remain', () => {
 const paid = { ...view, nativeRequest: { ...view.nativeRequest!, status: { ...view.nativeRequest!.status!, state: 'issued' as const, issued: 5000, remaining: 0 } } };
 assert.match(render(paid, '', rows.slice(0, 1)), /EMPTY_QUEUE/);
 assert.doesNotMatch(render(paid), /IMPORTED_DUPLICATE/);
 const partial = { ...view, nativeRequest: { ...view.nativeRequest!, status: { ...view.nativeRequest!.status!, state: 'partial' as const, issued: 2000, remaining: 3000 } } };
 assert.match(render(partial), /Выдано частично/); assert.doesNotMatch(render(partial), /EMPTY_QUEUE/);
 const unavailable = { ...view, nativeRef: ref, nativeRequest: { state: 'unavailable' as const } };
 assert.match(render(unavailable), /Проверяем статус/); assert.doesNotMatch(render(unavailable), /IMPORTED_DUPLICATE|Ещё не в 1С|EMPTY_QUEUE/);
});
test('search does not suppress a native match when portal row does not match', () => {
 assert.match(render({ ...view, nativeRef: ref, nativeRequest: { state: 'unavailable' } }, 'ТЕСТ-002'), /IMPORTED_DUPLICATE/);
});
test('common history merges exact native identity and preserves search when paging', () => {
 const html = renderToStaticMarkup(<ExpenseRequestsList rows={rows} query="Астемир" empty={<span>EMPTY_QUEUE</span>} history={{ nextCursor: 'older', rows: [{ id: 'cycle', requestedAt: at, details: view.requestDetails!, native: view.nativeRequest! }] }} />);
 assert.doesNotMatch(html, /IMPORTED_DUPLICATE|Подотчёт Астемира · история/);
 assert.match(html, /OTHER_REQUEST/); assert.match(html, /deliveryCursor=older&amp;q=/);
});
test('history source outage retains stored exact identity; a query-excluded history row does not swallow imported matches', () => {
 const past = { rows: [{ id: 'cycle', requestedAt: at, details: view.requestDetails!, nativeRef: ref, native: { state: 'unavailable' as const } }], nextCursor: null };
 const html = renderToStaticMarkup(<ExpenseRequestsList rows={rows} query="" empty={null} history={past} />);
 assert.doesNotMatch(html, /IMPORTED_DUPLICATE/); assert.match(html, /Статус не подтверждён/);
 const search = renderToStaticMarkup(<ExpenseRequestsList rows={rows} query="ТЕСТ-002" empty={null} history={past} />);
 assert.match(search, /IMPORTED_DUPLICATE/);
});

test('identity survives temporary source failure for the same cycle but never follows a new request', () => {
 const unavailable = { ...view, nativeRequest: { state: 'unavailable' as const } };
 assert.equal(retainDeliveryIdentity(view, unavailable).nativeRef, ref);
 const nextCycle = { ...unavailable, requestDetails: { ...view.requestDetails!, requestedAt: new Date(Date.parse(at) + 1000).toISOString() } };
 assert.equal(retainDeliveryIdentity(view, nextCycle).nativeRef, undefined);
});


test('queue distinguishes payment authorization from issue and treats stale status as unknown', () => {
 const now = Date.parse(at);
 assert.equal(deliveryQueueStage(view, now), 'issuance');
 assert.equal(deliveryQueueStage({ ...view, nativeRequest: { state: 'unlinked' } }, now), 'decision');
 assert.equal(deliveryQueueStage(view, now + 3600000), 'check');
 assert.equal(deliveryQueueStage({ ...view, nativeRequest: { state: 'unavailable' } }, now), 'check');
 const html = render();
 assert.match(html, /В списке: 2/);
 assert.match(html, /Нужно решение <strong[^>]*>1/);
 assert.match(html, /Ждут выдачи <strong[^>]*>1/);
});

test('waiting age has an explicit day threshold and never invents a date or overdue deadline', () => {
 const now = Date.parse(at);
 assert.equal(requestWaitingAge(null, now), null);
 assert.equal(requestWaitingAge('broken', now), null);
 assert.equal(requestWaitingAge(at, now - 1), null);
 assert.deepEqual(requestWaitingAge(at, now + 86399999), { label: '23 ч', overDay: false });
 assert.deepEqual(requestWaitingAge(at, now + 86400000), { label: '1 дн', overDay: true });
});

test('oldest native and accountable requests share one sorted queue; closed/history rows do not inflate decision counts', () => {
 const older = new Date(Date.parse(at) - 2 * 86400000).toISOString();
 const html = render({ ...view, nativeRequest: { state: 'unlinked' } }, '', [{ id: 'old', nativeRef: 'old', date: at, queueSince: older, content: <span>OLD_REQUEST</span> }]);
 assert.ok(html.indexOf('OLD_REQUEST') < html.indexOf('aria-label="Пополнение подотчёта Астемира"'));
 assert.match(html, /Ждут решения более суток: 1/);
 const past = renderToStaticMarkup(<ExpenseRequestsList rows={rows} query="" empty={null} queue={false} />);
 assert.doesNotMatch(past, /Состояние очереди/);
});


test('a longer queue counts and orders the loaded scope; search and truncation labels do not imply a global total', () => {
 const items = Array.from({ length: 24 }, (_, i) => ({ id: `row-${i}`, nativeRef: `ref-${i}`, date: at, queueSince: new Date(Date.parse(at) - (i + 1) * 86400000).toISOString(), content: <span>{`QUEUE_ROW_${i}_END`}</span> }));
 const html = render({ ...view, nativeRequest: { state: 'unlinked' } }, '', items);
 assert.match(html, /В списке: 25/);
 assert.match(html, /Ждут решения более суток: 24/);
 assert.ok(html.indexOf('QUEUE_ROW_23_END') < html.indexOf('QUEUE_ROW_0_END'));
 const search = renderToStaticMarkup(<ExpenseRequestsList rows={items} query="запрос" empty={null} hasMoreNative />);
 assert.match(search, /В результатах поиска: 24/);
 assert.match(search, /первых|первые 200 подходящих записей/);
});
