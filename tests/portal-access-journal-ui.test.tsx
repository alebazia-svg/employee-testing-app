import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortalAccessJournal, type AccessJournalRow } from '../components/PortalAccessJournal';
const row: AccessJournalRow = { id: 'test', name: 'Астемир', login: 'buyer', role: 'EMPLOYEE', device: 'Mac', browser: 'Edge', firstSeenAt: '2026-09-29T00:00:00Z', loginAt: null, lastSeenAt: '2026-09-29T00:01:00Z', expiresAt: '2026-10-29T00:00:00Z', loggedOutAt: null, pushLabel: 'Не проверены', pushCheckedAt: null };
const render = (rows: AccessJournalRow[], unavailable = false) => renderToStaticMarkup(<PortalAccessJournal rows={rows} query='' page={1} hasMore={false} unavailable={unavailable} now={new Date('2026-09-29T01:00:00Z')}/>);
test('discovered sessions never invent a login; last contact is not claimed to be human activity', () => {
  const html = render([row]); assert.match(html, /Обнаружен: 29.09.2026, 03:00/); assert.match(html, /Время входа не записано/);
  assert.doesNotMatch(html, /Вход:|Сейчас онлайн/); assert.match(html, /это не время последнего действия человека/);
});
test('known login, explicit logout and push state remain distinct', () => {
  const html = render([{ ...row, loginAt: row.firstSeenAt, loggedOutAt: row.lastSeenAt, pushLabel: 'Подключены' }]);
  assert.match(html, /Вход:/); assert.match(html, /Выход:/); assert.match(html, /Подключены/);
});
test('empty and unavailable data cannot be confused', () => {
  assert.match(render([]), /Записей пока нет/); assert.match(render([], true), /временно недоступен/);
  assert.doesNotMatch(render([], true), /Записей пока нет/);
});
