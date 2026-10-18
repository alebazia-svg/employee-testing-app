import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortalAccessDevicesView } from '../components/PortalAccessDevices';
import type { AccessJournalRow } from '../components/PortalAccessJournal';
import { accessPushView, accessWhen, filterAccessRows, groupAccessRows, accessAccountSummary, accessCurrentConnections, accessRecentConnections, accessNotificationDetail, accessRecentPushFailure } from '../lib/portal-access-view';

const now = new Date('2026-09-30T14:10:00Z');
const row: AccessJournalRow = { id: 'one', name: 'Сотрудник', login: 'buyer', role: 'EMPLOYEE', device: 'Mac', browser: 'Edge', firstSeenAt: '2026-09-29T19:30:00Z', loginAt: '2026-09-29T19:30:00Z', lastSeenAt: '2026-09-30T14:09:00Z', expiresAt: '2026-10-29T00:00:00Z', loggedOutAt: null, pushLabel: 'Подключены', pushCheckedAt: '2026-09-30T14:09:00Z' };
const render = (rows: AccessJournalRow[], history = false, unavailable = false) => renderToStaticMarkup(<PortalAccessDevicesView rows={rows} history={history} unavailable={unavailable} query='' page={1} hasMore={false} nowIso={now.toISOString()} />);

test('main list groups accounts without merging identically named sessions or exposing login times', () => {
  const rows = [row, { ...row, id: 'two' }, { ...row, id: 'three', login: 'other' }];
  assert.equal(groupAccessRows(rows).length, 2);
  assert.equal(groupAccessRows(rows)[0].length, 2);
  const html = render(rows);
  assert.equal((html.match(/<article /g) ?? []).length, 3);
  assert.equal((html.match(/<h2[ >]/g) ?? []).length, 2);
  assert.match(html, /Сегодня, 17:09/);
  assert.doesNotMatch(html, /Вчера, 22:30|Вход:|Время входа не записано|Сейчас онлайн/);
});

test('only the same verified subscription is consolidated; never merge accounts or phone names', () => {
  const rows = [row, { ...row, id: 'two' }];
  assert.equal(accessCurrentConnections(rows).length, 2);
  const known = rows.map((r, i) => ({ ...r, pushSubscriptionId: 7, lastSeenAt: i ? '2026-09-30T14:10:00Z' : r.lastSeenAt }));
  assert.deepEqual(accessCurrentConnections(known).map(r => r.id), ['two']);
  assert.equal(accessCurrentConnections([known[0], { ...known[1], login: 'other' }]).length, 2);
  assert.equal(accessCurrentConnections([known[0], { ...known[1], pushLabel: 'Подписка не активна' }]).length, 2);
  assert.equal(rows.length, 2);
});

test('an account with one connected and one disconnected browser is not labelled wholly disconnected', () => {
  const other = { ...row, id: 'phone', pushLabel: 'Не подключены' };
  assert.deepEqual(accessAccountSummary([row, other], now), { connected: 1, warning: 1, unknown: 0, label: 'Уведомления подключены · 1 из 2', tone: 'ok' });
  const old = { ...other, pushCheckedAt: '2026-09-01T00:00:00Z' };
  assert.equal(accessAccountSummary([old], now).tone, 'unknown');
  assert.equal(accessNotificationDetail(old, now).label, 'Нужна свежая проверка');
  assert.match(accessNotificationDetail(old, now).explanation, /не означает, что уведомления отключены/);
});

test('current screen offers actionable help without remote subscription controls or guessed PWA', () => {
  const html = render([row, { ...row, id: 'phone', device: 'iPhone', browser: 'Safari', pushLabel: 'Не подключены' }]);
  assert.match(html, /Подключить в этом кабинете/);
  assert.match(html, /Последняя связь с порталом не означает/);
  assert.match(html, /Подробнее/);
  assert.doesNotMatch(html, /Отключить подписку|Отправить тест|iPhone 1[4567]/);
});
test('history preserves known login and logout, never guesses missing events', () => {
  const html = render([{ ...row, loggedOutAt: row.lastSeenAt }], true);
  assert.match(html, /Вчера, 22:30/);
  assert.match(html, /Сегодня, 17:09/);
  assert.match(render([{ ...row, loginAt: null }], true), /Не зафиксирован/);
  assert.match(render([{ ...row, expiresAt: '2026-09-29T00:00:00Z' }], true), /Срок входа истёк/);
});
test('push freshness, unknown, inactive and future observations never claim current connection', () => {
  assert.equal(accessPushView(row, now).tone, 'ok');
  for (const patch of [{ pushCheckedAt: null }, { pushCheckedAt: '2026-09-29T14:09:00Z' }, { pushCheckedAt: '2026-10-01T00:00:00Z' }, { pushLabel: 'Не проверены' }]) {
    assert.equal(accessPushView({ ...row, ...patch }, now).tone, 'unknown');
  }
  assert.equal(accessPushView({ ...row, pushLabel: 'Подписка не активна' }, now).tone, 'warning');
});
test('search covers names, login and browsers; attention retains all problematic sessions', () => {
  const rows = [row, { ...row, id: 'phone', device: 'iPhone', browser: 'Safari', pushLabel: 'Не подключены' }];
  assert.equal(filterAccessRows(rows, ' SAFARI ', false, now)[0].id, 'phone');
  assert.equal(filterAccessRows(rows, 'BUYER', false, now).length, 2);
  assert.deepEqual(filterAccessRows(rows, '', true, now).map(r => r.id), ['phone']);
});
test('empty and failed reads have distinct messaging', () => {
  assert.match(render([]), /Нет подключений за последние 7 дней/);
  assert.match(render([], false, true), /временно недоступен/);
  assert.doesNotMatch(render([], false, true), /Нет подключений за последние 7 дней|Требуют внимания<span[^>]*>0/);
});
test('recent view uses last contact, includes the seven-day boundary and preserves history', () => {
  const records = [
    { ...row, id: 'old-login', loginAt: '2026-09-01T00:00:00Z' },
    { ...row, id: 'boundary', lastSeenAt: '2026-09-23T14:10:00Z' },
    { ...row, id: 'old', device: 'OldPhone', lastSeenAt: '2026-09-23T14:09:59Z' },
    { ...row, id: 'logout', loggedOutAt: row.lastSeenAt },
    { ...row, id: 'expired', expiresAt: now.toISOString() },
  ];
  assert.deepEqual(accessRecentConnections(records, now).map(r => r.id), ['old-login', 'boundary']);
  assert.doesNotMatch(render(records), /OldPhone/);
  assert.match(render(records, true), /OldPhone/);
  assert.match(render([records[2]]), /Открыть историю/);
  assert.equal(records.length, 5);
  assert.equal(records[2].pushLabel, 'Подключены');
});
test('relative dates use Moscow date boundary rather than server timezone', () => {
  assert.equal(accessWhen('2026-09-30T21:01:00Z', new Date('2026-09-30T21:10:00Z')), 'Сегодня, 00:01');
  assert.equal(accessWhen('2026-09-30T20:59:00Z', new Date('2026-09-30T21:10:00Z')), 'Вчера, 23:59');
});
test('fresh send failure remains visible even when permission/subscription is connected', () => {
  const failed = { ...row, displayMode: 'app', lastPush: { attemptedAt: row.lastSeenAt, resultAt: row.lastSeenAt, outcome: 'failed', errorCode: 'NETWORK_OR_PROVIDER_ERROR' } };
  assert.equal(accessRecentPushFailure(failed, now), true);
  assert.match(render([failed]), /Последняя отправка не подтверждена/);
  assert.match(render([failed]), /Приложение/);
  assert.equal(accessPushView(failed, now).tone, 'ok');
  assert.equal(accessRecentPushFailure({ ...failed, lastPush: { ...failed.lastPush, resultAt: '2026-09-01T00:00:00Z' } }, now), false);
  assert.equal(accessRecentPushFailure({ ...failed, lastPush: { ...failed.lastPush, outcome: 'accepted' } }, now), false);
});
