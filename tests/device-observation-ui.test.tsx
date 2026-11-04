import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PortalAccessDevicesView } from '../components/PortalAccessDevices';
import type { AccessJournalRow } from '../components/PortalAccessJournal';
import { deviceObservationFromUa } from '../lib/portal-device-observation';
const now = new Date('2026-11-04T12:00:00Z');
const base: AccessJournalRow = { id: 'one', name: 'Пример', login: 'example', role: 'EMPLOYEE', device: 'iPhone', browser: 'Safari', connectionLabel: 'iPhone Бэлы', browserInstanceId: 'known-browser', firstSeenAt: now.toISOString(), lastSeenAt: now.toISOString(), expiresAt: '2026-12-01T00:00:00Z', loggedOutAt: null, loginAt: null, pushCheckedAt: null, pushLabel: 'Не проверены' };
const render = (row: AccessJournalRow) => renderToStaticMarkup(<PortalAccessDevicesView rows={[row]} query='' history={false} page={1} hasMore={false} unavailable={false} nowIso={now.toISOString()} />);
test('main list preserves names and shows reported iOS with its source, not the Safari version', () => {
  const html = render({ ...base, deviceObservation: deviceObservationFromUa('iPhone; CPU iPhone OS 18_7 like Mac OS X Version/26.2 Safari/605') });
  assert.match(html, /iPhone Бэлы/); assert.match(html, /iOS \/ iPadOS 18\.7 · по описанию браузера/);
  assert.doesNotMatch(html, /26\.2/);
});
test('new expanded Android evidence can show reported OS version while retaining the assigned name', () => {
  const html = render({ ...base, device: 'Телефон Android', browser: 'Chrome', connectionLabel: 'Рабочий телефон', deviceObservation: { source: 'client-hints', platform: 'Android', platformVersion: '16.0.0', fieldSources: { platform: 'client-hints', platformVersion: 'client-hints' } } });
  assert.match(html, /Рабочий телефон/); assert.match(html, /Android 16\.0\.0 · расширенные сведения браузера/);
});

test('legacy Mac version remains visible with its provenance limit and saved name', () => {
  const html = render({ ...base, device: 'Mac', browser: 'Chrome', connectionLabel: 'Mac Аслана', deviceObservation: { source: 'client-hints', platform: 'macOS', platformVersion: '27.0.1' } });
  assert.match(html, /Mac Аслана/);
  assert.match(html, /macOS 27\.0\.1 · сохранённые данные браузера; источник не уточнён/);
});
