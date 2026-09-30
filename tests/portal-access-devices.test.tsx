import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortalAccessDevicesView } from '../components/PortalAccessDevices';
import type { AccessJournalRow } from '../components/PortalAccessJournal';
import { accessPushView, accessWhen, filterAccessRows, groupAccessRows } from '../lib/portal-access-view';

const now = new Date('2026-09-30T14:10:00Z');
const row: AccessJournalRow = { id: 'one', name: 'Сотрудник', login: 'buyer', role: 'EMPLOYEE', device: 'Mac', browser: 'Edge', firstSeenAt: '2026-09-29T19:30:00Z', loginAt: '2026-09-29T19:30:00Z', lastSeenAt: '2026-09-30T14:09:00Z', expiresAt: '2026-10-29T00:00:00Z', loggedOutAt: null, pushLabel: 'Подключены', pushCheckedAt: '2026-09-30T14:09:00Z' };
const render = (rows: AccessJournalRow[], history = false, unavailable = false) => renderToStaticMarkup(<PortalAccessDevicesView rows={rows} history={history} unavailable={unavailable} query='' page={1} hasMore={false} nowIso={now.toISOString()} />);

test('main list groups accounts without merging identically named sessions or exposing login times', () => {
  const rows = [row, { ...row, id: 'two' }, { ...row, id: 'three', login: 'other' }];
  assert.equal(groupAccessRows(rows).length, 2);
  assert.equal(groupAccessRows(rows)[0].length, 2);
  const html = render(rows);
  assert.equal((html.match(/<article /g) ?? []).length, 3);
  assert.equal((html.match(/<h2 /g) ?? []).length, 2);
  assert.match(html, /Сегодня, 17:09/);
  assert.doesNotMatch(html, /Вчера, 22:30|Вход:|Время входа не записано|Сейчас онлайн/);
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
  assert.match(render([]), /Нет текущих сеансов/);
  assert.match(render([], false, true), /временно недоступен/);
  assert.doesNotMatch(render([], false, true), /Нет текущих сеансов|Требуют внимания<span[^>]*>0/);
});
test('relative dates use Moscow date boundary rather than server timezone', () => {
  assert.equal(accessWhen('2026-09-30T21:01:00Z', new Date('2026-09-30T21:10:00Z')), 'Сегодня, 00:01');
  assert.equal(accessWhen('2026-09-30T20:59:00Z', new Date('2026-09-30T21:10:00Z')), 'Вчера, 23:59');
});
