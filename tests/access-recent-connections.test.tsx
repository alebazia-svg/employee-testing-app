import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortalAccessDevicesView } from '../components/PortalAccessDevices';
import type { AccessJournalRow } from '../components/PortalAccessJournal';
import { accessHasRecentContact, accessMatchesSearch, accessCurrentConnections } from '../lib/portal-access-view';
import { accessHistoryFilters, accessHistoryWhere } from '../lib/portal-access-search';

const now = new Date('2026-11-04T18:00:00Z');
const base: AccessJournalRow = { id: 'recent', name: 'Милана', login: 'milana', role: 'EMPLOYEE', device: 'iPhone', browser: 'Safari', browserInstanceId: '11111111-1111-4111-8111-111111111111', connectionLabel: null, firstSeenAt: '2026-10-01T00:00:00Z', loginAt: '2026-10-01T00:00:00Z', lastSeenAt: now.toISOString(), expiresAt: '2026-12-01T00:00:00Z', loggedOutAt: null, pushLabel: 'Подключены', pushCheckedAt: now.toISOString() };
const old: AccessJournalRow = { ...base, id: 'old', device: 'Старый телефон', browserInstanceId: '22222222-2222-4222-8222-222222222222', lastSeenAt: '2026-10-23T13:23:00Z', pushCheckedAt: '2026-10-23T13:23:00Z', appUpdate: { version: '1.13.15', builtAt: '2026-10-23T00:00:00Z', checkedAt: '2026-10-23T13:23:00Z', state: 'current' } };
const render = (rows: AccessJournalRow[], history = false, service = false, query = '') => renderToStaticMarkup(<PortalAccessDevicesView rows={rows} history={history} service={service} query={query} page={1} hasMore={false} unavailable={false} nowIso={now.toISOString()} />);

test('seven-day cutoff is inclusive and rejects invalid/future observations', () => {
  const cutoff = +now - 7 * 86400000;
  assert.equal(accessHasRecentContact({ lastSeenAt: new Date(cutoff).toISOString() }, now), true);
  assert.equal(accessHasRecentContact({ lastSeenAt: new Date(cutoff - 1).toISOString() }, now), false);
  assert.equal(accessHasRecentContact({ lastSeenAt: 'not-a-date' }, now), false);
  assert.equal(accessHasRecentContact({ lastSeenAt: new Date(+now + 3600000).toISOString() }, now), false);
});
test('old devices leave the list, remain in history, and return on new contact without renaming', () => {
  const records = [base, { ...old, connectionLabel: 'Сохранённое имя' }];
  const before = JSON.stringify(records);
  assert.doesNotMatch(render(records), /Старый телефон|Сохранённое имя|1.13.15/);
  assert.match(render(records, true), /Сохранённое имя|1.13.15/);
  const returned = { ...records[1], lastSeenAt: now.toISOString() };
  assert.match(render([base, returned]), /Сохранённое имя/);
  assert.equal(JSON.stringify(records), before);
  assert.equal(accessCurrentConnections(records).length, 2);
});
test('employee with no recent devices keeps only a compact last-contact summary', () => {
  const html = render([old]);
  assert.match(html, /Милана|Нет обращений более 7 дней|Последняя связь|23.10.2026/);
  assert.match(html, /view=history&amp;q=milana/);
  assert.doesNotMatch(html, /<article |Старый телефон|1.13.15/);
});
test('old ADMIN and employee inspections do not bloat named service groups', () => {
  const admin = { ...base, role: 'ADMIN', login: 'admin', name: 'Администратор', connectionLabel: 'Mac Бэлы' };
  const inspection = { ...old, browserInstanceId: base.browserInstanceId, ownerInspection: true, connectionLabel: 'Mac Бэлы' };
  const html = render([admin, inspection], false, true);
  assert.match(html, /Mac Бэлы/);
  assert.doesNotMatch(html, /<h3>Милана/);
  assert.match(render([inspection], false, true), /За последние 7 дней подключений нет/);
  assert.match(render([admin, inspection], true), /Милана/);
});
test('exact and partial code search and device labels do not merge different identities', () => {
  const named = { ...base, connectionLabel: 'Mac Аслана' };
  for (const query of ['АСЛАНА', '11111111-1111-4111', '11111111-1111-4111-8111-111111111111']) assert.equal(accessMatchesSearch(named, query), true);
  assert.equal(accessMatchesSearch(old, base.browserInstanceId!), false);
  const html = render([base, old], false, false, old.browserInstanceId!);
  assert.doesNotMatch(html, /<article /); // Archived code must not select its fresh sibling.
  assert.match(html, /Нет совпадений/);
});
test('history bounds use inclusive Moscow dates and the requested timestamp field', () => {
  const filters = accessHistoryFilters({ from: '2026-11-03', to: '2026-11-04', dateField: 'login' });
  const where = accessHistoryWhere('Mac Аслана', ['browser-code'], filters);
  assert.deepEqual(where.loginAt, { gte: new Date('2026-11-02T21:00:00Z'), lt: new Date('2026-11-04T21:00:00Z') });
  assert.equal(where.lastSeenAt, undefined);
  assert.ok(JSON.stringify(where).includes('browser-code'));
  assert.ok(JSON.stringify(where).includes('observedBrowserId'));
  assert.ok(accessHistoryFilters({ from: '2026-11-04', to: '2026-11-03' }).error);
  for (const from of ['2026-02-30', 'wrong', '2026-11-04garbage']) assert.ok(accessHistoryFilters({ from }).error);
  assert.equal(accessHistoryFilters({ from: '2024-02-29' }).error, undefined);
  assert.deepEqual(accessHistoryWhere('', [], accessHistoryFilters({})), {});
});
test('normal statuses distinguish notifications and contact; history pagination retains search bounds', () => {
  assert.match(render([base]), /Уведомления подключены|Последняя связь/);
  assert.doesNotMatch(render([base]), /Был в портале/);
  const html = renderToStaticMarkup(<PortalAccessDevicesView rows={[old]} query='Mac Аслана' history page={2} hasMore unavailable={false} nowIso={now.toISOString()} historyFilters={{ from: '2026-11-03', to: '2026-11-04', dateField: 'login' }} />);
  assert.match(html, /from=2026-11-03&amp;to=2026-11-04&amp;dateField=login/);
  assert.match(html, /Сбросить поиск/);
});

test('manually hidden administrative connection stays in searchable history and returns only after newer contact', () => {
  const hidden = { ...base, name: 'Администратор', login: 'admin', role: 'ADMIN', device: 'Mac', browser: 'Chrome', listArchivedAt: now.toISOString(), lastSeenAt: new Date(+now - 60000).toISOString() };
  const named = { ...hidden, id: 'named', browserInstanceId: 'other', connectionLabel: 'Mac Бэлы', listArchivedAt: null };
  const html = render([hidden, named], false, true);
  assert.match(html, /Mac Бэлы/); assert.doesNotMatch(render([hidden], false, true), /<article /);
  assert.match(render([hidden], true), /Убрано из основного списка/);
  assert.equal(accessMatchesSearch(hidden, hidden.browserInstanceId!), true);
  assert.equal(accessHasRecentContact(hidden, now), false);
  assert.equal(accessHasRecentContact({ ...hidden, lastSeenAt: new Date(+now + 1).toISOString() }, new Date(+now + 1)), true);
});
