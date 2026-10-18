import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortalAccessDevicesView } from '../components/PortalAccessDevices';
import type { AccessJournalRow } from '../components/PortalAccessJournal';
import { accessPushView, accessWhen, filterAccessRows, groupAccessRows, accessAccountSummary, accessCurrentConnections, accessNotificationDetail, accessRecentPushFailure, accessSystemLabel, accessOverviewRows, groupServiceConnections } from '../lib/portal-access-view';

const now = new Date('2026-09-30T14:10:00Z');
const row: AccessJournalRow = { id: 'one', name: 'Сотрудник', login: 'buyer', role: 'EMPLOYEE', device: 'Mac', browser: 'Edge', firstSeenAt: '2026-09-29T19:30:00Z', loginAt: '2026-09-29T19:30:00Z', lastSeenAt: '2026-09-30T14:09:00Z', expiresAt: '2026-10-29T00:00:00Z', loggedOutAt: null, pushLabel: 'Подключены', pushCheckedAt: '2026-09-30T14:09:00Z' };
const render = (rows: AccessJournalRow[], history = false, unavailable = false) => renderToStaticMarkup(<PortalAccessDevicesView rows={rows} history={history} unavailable={unavailable} query='' page={1} hasMore={false} nowIso={now.toISOString()} />);

test('identity mismatch cannot show a green current version or a confirmed subscription', () => {
  const release = { version: '1.5.4', builtAt: now.toISOString() };
  const changed: AccessJournalRow = { ...row, browserInstanceId: 'old', observedBrowserId: 'new', appUpdate: { ...release, state: 'current', checkedAt: now.toISOString() } };
  assert.equal(accessPushView(changed, now).tone, 'unknown');
  assert.match(accessNotificationDetail(changed, now).explanation, /отличается/);
  const html = renderToStaticMarkup(<PortalAccessDevicesView rows={[changed]} history={false} unavailable={false} query='' page={1} hasMore={false} nowIso={now.toISOString()} currentRelease={release} />);
  assert.match(html, /Нужна сверка подключения/); assert.match(html, /Требует сверки/);
  assert.doesNotMatch(html, /access-badge-ok|Актуальная версия|Сейчас онлайн/);
});

test('observed snapshots preserve displayed connections without fabricating browser identity', () => {
  const rows = [row, { ...row, id: 'second-observed-card' }];
  const html = renderToStaticMarkup(<PortalAccessDevicesView rows={rows} presentation='observed-snapshot' history={false} unavailable={false} query='' page={1} hasMore={false} nowIso={now.toISOString()} />);
  assert.equal((html.match(/<article /g) ?? []).length, 2);
  assert.doesNotMatch(html, /Текущий браузер пока не сопоставлен|Старая запись · устройство не подтверждено|Этот браузер/);
  assert.match(render(rows), /Последние известные сведения/);
});

test('main list summarizes legacy types, retains accounts and does not expose login times', () => {
  const rows = [row, { ...row, id: 'two' }, { ...row, id: 'three', login: 'other' }];
  assert.equal(groupAccessRows(rows).length, 2);
  assert.equal(groupAccessRows(rows)[0].length, 2);
  const html = render(rows);
  assert.equal((html.match(/<article /g) ?? []).length, 2);
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
  assert.equal(accessNotificationDetail(old, now).label, 'Нет свежих данных');
  assert.match(accessNotificationDetail(old, now).explanation, /не означает, что уведомления отключены/);
});

test('current screen offers actionable help without remote subscription controls or guessed PWA', () => {
  const html = render([row, { ...row, id: 'phone', device: 'iPhone', browser: 'Safari', pushLabel: 'Не подключены' }]);
  assert.match(html, /Подключить в этом кабинете/);
  assert.match(html, /в том числе автоматическое/);
  assert.match(html, /Это не означает, что сотрудник сейчас онлайн/);
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
test('ownership text fits both installed apps and browsers, and delivery is not implied', () => {
  assert.match(render([{ ...row, ownerBrowser: true, connectionLabel: 'iPhone Беллы', canMarkOwner: true, displayMode: 'app' }]), /iPhone Беллы/);
  assert.match(render([{ ...row, ownerBrowser: true, connectionLabel: 'Аслан · компьютер', canMarkOwner: false }]), /Аслан · компьютер/);
  assert.doesNotMatch(render([{ ...row, ownerBrowser: true, canMarkOwner: true }]), /Ваш браузер/);
  assert.match(accessNotificationDetail(row, now).explanation, /не подтверждает показ или звук/);
});

test('shared names stay absolute for either administrator; current marker is request-local only', () => {
  const records = [
    { ...row, id: 'bella', role: 'ADMIN', login: 'admin', browserInstanceId: 'bella', connectionLabel: 'Mac Беллы', canMarkOwner: true, isCurrentBrowser: true },
    { ...row, id: 'aslan', role: 'ADMIN', login: 'admin', browserInstanceId: 'aslan', connectionLabel: 'Mac Аслана', canMarkOwner: true },
  ];
  const service = (rows: AccessJournalRow[]) => renderToStaticMarkup(<PortalAccessDevicesView rows={rows} history={false} service query='' page={1} hasMore={false} unavailable={false} nowIso={now.toISOString()} />);
  const bella = service(records);
  const aslan = service(records.map(r => ({ ...r, isCurrentBrowser: r.id === 'aslan' })));
  for (const html of [bella, aslan]) {
    assert.match(html, /Mac Беллы/); assert.match(html, /Mac Аслана/);
    assert.doesNotMatch(html, /Мой Mac|Ваш Mac/);
  }
  assert.match(bella, /Этот браузер · Mac Беллы/);
  assert.match(aslan, /Этот браузер · Mac Аслана/);
  const unnamed = service([{ ...records[0], connectionLabel: null }]);
  assert.match(unnamed, /Подробности подключения/);
  assert.match(unnamed, /Владелец не подтверждён/);
  const missing = service(records.map(r => ({ ...r, isCurrentBrowser: false })));
  assert.match(missing, /Текущий браузер пока не сопоставлен/);
  assert.doesNotMatch(missing, /Назвать это устройство/);
});
test('self naming is offered only for the exactly matched manageable ADMIN connection', () => {
  const current = { ...row, role: 'ADMIN', device: 'iPhone', browser: 'Safari', browserInstanceId: 'phone', isCurrentBrowser: true, canMarkOwner: true };
  const screen = (record: AccessJournalRow) => renderToStaticMarkup(<PortalAccessDevicesView rows={[record]} onSetOwner={async () => {}} history={false} query='' page={1} hasMore={false} unavailable={false} nowIso={now.toISOString()} />);
  assert.match(screen(current), /Назвать это устройство/);
  assert.match(screen({ ...current, connectionLabel: 'iPhone Бэлы' }), /Изменить название/);
  for (const patch of [{ isCurrentBrowser: false }, { canMarkOwner: false }, { role: 'EMPLOYEE' }]) {
    assert.doesNotMatch(screen({ ...current, ...patch }), /Назвать это устройство/);
  }
  assert.doesNotMatch(screen(current), /iPhone Бэлы/); // No inferred owner before confirmation.
});
test('system families do not infer versions, models or device owners', () => {
  assert.equal(accessSystemLabel('Mac'), 'macOS');
  assert.equal(accessSystemLabel('iPhone'), 'iOS');
  assert.equal(accessSystemLabel('Mac / iPad'), 'macOS / iPadOS · не уточнено');
  assert.equal(accessSystemLabel('Unknown'), null);
  assert.match(render([row]), /<h2>Сотрудник/);
  assert.doesNotMatch(render([row]), /Кабинет: Сотрудник/);
  assert.match(render([row]), /macOS/);
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
  assert.match(render([]), /Посещений пока нет/);
  assert.match(render([], false, true), /временно недоступен/);
  assert.doesNotMatch(render([], false, true), /Посещений пока нет|Требуют внимания<span[^>]*>0/);
});
test('last visits remain visible across old dates, logout and expiry; history is retained', () => {
  const records = [
    { ...row, id: 'old-login', loginAt: '2026-09-01T00:00:00Z' },
    { ...row, id: 'boundary', lastSeenAt: '2026-09-29T14:10:00Z' },
    { ...row, id: 'old', device: 'OldPhone', lastSeenAt: '2026-09-29T14:09:59Z' },
    { ...row, id: 'logout', loggedOutAt: row.lastSeenAt },
    { ...row, id: 'expired', expiresAt: now.toISOString() },
  ];
  assert.equal(accessCurrentConnections(records).length, 5);
  assert.match(render(records), /OldPhone/);
  assert.match(render(records, true), /OldPhone/);
  assert.match(render([records[2]]), /Был в портале/);
  assert.equal(records.length, 5);
  assert.equal(records[2].pushLabel, 'Подключены');
});
test('employees and their devices are newest first, including recent devices without push', () => {
  const records = [
    { ...row, id: 'older', name: 'Яна', lastSeenAt: '2026-09-30T12:00:00Z' },
    { ...row, id: 'alphabetical', login: 'other', name: 'Анна', lastSeenAt: '2026-09-30T13:00:00Z' },
    { ...row, id: 'newest', name: 'Яна', lastSeenAt: now.toISOString(), pushLabel: 'Не подключены' },
  ];
  const before = JSON.stringify(records);
  const groups = groupAccessRows(accessCurrentConnections(records));
  assert.deepEqual(groups.map(g => g.map(r => r.id)), [['newest', 'older'], ['alphabetical']]);
  assert.match(render(records), /Не подключены/);
  assert.equal(JSON.stringify(records), before);
  assert.deepEqual(groupAccessRows([...records].reverse()), groups);
});

test('stable browser merges repeated logins but never accounts or different browsers', () => {
  const old = { ...row, browserInstanceId: 'browser-one', isService: true, serviceMarkedAt: row.lastSeenAt };
  const newer = { ...row, id: 'new-login', browserInstanceId: 'browser-one', lastSeenAt: now.toISOString() };
  const records = [old, newer, { ...newer, id: 'other-user', login: 'admin' }, { ...newer, id: 'other-browser', browserInstanceId: 'browser-two' }];
  const result = accessCurrentConnections(records);
  assert.equal(result.length, 3);
  assert.equal(result.find(r => r.id === 'new-login')?.isService, true);
  assert.equal(result.find(r => r.id === 'other-user')?.isService, undefined);
  assert.doesNotMatch(render([old, newer]), /<article /);
  assert.match(render([old, newer], true), /Служебное/);
  const restored = accessCurrentConnections([old, { ...newer, isService: false, serviceMarkedAt: now.toISOString() }]);
  assert.equal(restored[0].isService, false);
  assert.equal(records.length, 4);
});

test('service view is separate, without operational warning filters', () => {
  const html = renderToStaticMarkup(<PortalAccessDevicesView rows={[{ ...row, isService: true, name: 'Проверка' }, { ...row, id: 'real', name: 'Рабочий' }]} history={false} service query='' page={1} hasMore={false} unavailable={false} nowIso={now.toISOString()} />);
  assert.match(html, /Подтверждённые устройства и отдельные подключения/);
  assert.doesNotMatch(html, /<h2>Рабочий|Проверить уведомления/);
});
test('main excludes ADMIN and known admin-browser visits but keeps distinct employee Windows and iPhone', () => {
  const rows = [{ ...row, id: 'admin', name: 'Администратор', role: 'ADMIN', login: 'admin' },
    { ...row, id: 'inspection', adminObserved: true, browserInstanceId: 'admin-browser' },
    { ...row, id: 'windows', device: 'Компьютер Windows', browserInstanceId: 'employee-windows' },
    { ...row, id: 'phone', device: 'iPhone', browserInstanceId: 'employee-phone', displayMode: 'app' }];
  const html = render(rows);
  assert.doesNotMatch(html, /<h2>Администратор|<h3>Mac/);
  assert.match(html, /<h3>Компьютер Windows/);
  assert.match(html, /<h3>iPhone/);
  assert.equal((html.match(/<article /g) ?? []).length, 2);
  assert.equal((render(rows, true).match(/<article /g) ?? []).length, 4);
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

test('overview removes old duplicates but retains latest known device types and every employee', () => {
  const records = [
    { ...row, id: 'modern', browserInstanceId: 'stable', lastSeenAt: now.toISOString() },
    { ...row, id: 'old-same-type' },
    { ...row, id: 'windows', device: 'Компьютер Windows' },
    { ...row, id: 'older-windows', device: 'Компьютер Windows', lastSeenAt: '2026-09-01T00:00:00Z' },
    { ...row, id: 'legacy-only', login: 'legacy-only' },
  ];
  const before = JSON.stringify(records);
  assert.deepEqual(new Set(accessOverviewRows(records).map(r => r.id)), new Set(['modern', 'windows', 'legacy-only']));
  assert.equal(JSON.stringify(records), before);
  assert.equal((render(records, true).match(/<article /g) ?? []).length, 5);
});

test('service grouping requires exact identity, not equal labels or Mac Chrome', () => {
  const admin = { ...row, role: 'ADMIN', login: 'admin', browserInstanceId: 'one', connectionLabel: 'Mac Бэлы' };
  const buyer = { ...row, id: 'buyer', browserInstanceId: 'one', ownerInspection: true, connectionLabel: 'Mac Бэлы' };
  const other = { ...admin, id: 'other', browserInstanceId: 'two' };
  const legacy = { ...admin, id: 'legacy', browserInstanceId: null };
  const groups = groupServiceConnections([admin, buyer, other, legacy]);
  assert.equal(groups.length, 3);
  assert.ok(groups.some(g => g.length === 2 && g.every(r => r.browserInstanceId === 'one')));
  const html = renderToStaticMarkup(<PortalAccessDevicesView rows={[admin, buyer]} history={false} service query='' page={1} hasMore={false} unavailable={false} nowIso={now.toISOString()} />);
  assert.equal((html.match(/class="access-account"/g) ?? []).length, 1);
  assert.equal((html.match(/<article /g) ?? []).length, 2);
});

test('overview retains distinct subscriptions even when their browser identifiers are absent', () => {
  const records = [{ ...row, id: 'browser', browserInstanceId: 'known' }, { ...row, id: 'subscription-one', pushSubscriptionId: 1 }, { ...row, id: 'subscription-two', pushSubscriptionId: 2 }];
  assert.equal(accessOverviewRows(records).length, 3);
});

test('an older identified subscription never hides a later unidentifiable visit', () => {
  const old = { ...row, id: 'old-subscription', pushSubscriptionId: 9, lastSeenAt: '2026-09-01T00:00:00Z' };
  const latest = { ...row, id: 'latest-visit', pushLabel: 'Не подключены' };
  const groups = groupAccessRows(accessOverviewRows([old, latest]));
  assert.deepEqual(groups[0].map(r => r.id), ['latest-visit', 'old-subscription']);
});

test('compact list keeps versions separate and suppresses repeated normal explanations', () => {
  const html = render([{ ...row, browserInstanceId: 'known', appUpdate: { version: '1.5.2', builtAt: now.toISOString(), checkedAt: now.toISOString(), state: 'current' } }]);
  assert.match(html, /access-version/);
  assert.match(html, /1.5.2/);
  assert.doesNotMatch(html, /Для этого кабинета|Проверено:|Кабинет: Сотрудник/);
});
