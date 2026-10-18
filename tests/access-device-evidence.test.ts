import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDeviceObservation, parseDeviceObservation, deviceObservationFromUa, reportedSystem, connectionMismatch, portalObservationOrigin } from '../lib/portal-device-observation';
import { groupServiceConnections } from '../lib/portal-access-view';
import type { AccessJournalRow } from '../components/PortalAccessJournal';
import { withMockDb } from './access-telemetry.test';
import { mocked } from './portal-access-routes.test';
import { createSessionToken } from '../lib/session';

test('diagnostics are bounded and never accept hardware IDs, owners, raw UA or arbitrary payloads', () => {
  assert.deepEqual(parseDeviceObservation({ source: 'client-hints', platform: 'macOS', architecture: 'arm' }), { source: 'client-hints', platform: 'macOS', architecture: 'arm' });
  for (const value of [{ source: 'guess' }, { source: 'user-agent', model: 'x'.repeat(81) }, { source: 'client-hints', serial: 'private' }, { source: 'user-agent', platform: '\n' }, { source: 'user-agent', owner: 'Aslan' }, []]) assert.equal(parseDeviceObservation(value), null);
  assert.equal(portalObservationOrigin('https://user:secret@team.example/employee?token=private'), 'https://team.example');
  assert.equal(portalObservationOrigin('file:///private'), undefined);
});

test('fallback never calls Windows NT 10 Windows 10 or guesses Mac hardware/version', () => {
  const win = deviceObservationFromUa('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.200.1');
  assert.equal(win.browserVersion, '141.0.200.1');
  assert.equal(win.platformVersion, undefined);
  assert.equal(reportedSystem(win), 'Windows');
  const mac = deviceObservationFromUa('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/26.0 Safari/605.1.15');
  assert.equal(mac.model, undefined); assert.equal(mac.architecture, undefined); assert.equal(mac.platformVersion, undefined);
  assert.equal(reportedSystem({ source: 'client-hints', platform: 'Windows', platformVersion: '13.0.0' }), 'Windows 11 или новее');
  assert.equal(reportedSystem({ source: 'client-hints', platform: 'Windows', platformVersion: '10.0.0' }), 'Windows 10');
  assert.equal(reportedSystem({ source: 'client-hints', platform: 'Windows', platformVersion: '12.0.0' }), 'Windows');
});

test('supported hints are collected once with a deadline, permission denial falls back', async () => {
  let calls = 0;
  const ua = 'Macintosh Chrome/141.0.0.0 Edg/141.0.0.0';
  const result = await collectDeviceObservation({ userAgent: ua, userAgentData: { getHighEntropyValues: async keys => { calls++; assert.deepEqual(keys, ['platformVersion', 'fullVersionList', 'architecture', 'model']); return { platform: 'macOS', platformVersion: '15.6.1', architecture: 'arm', model: '', fullVersionList: [{ brand: 'Not A Brand', version: '999' }, { brand: 'Chromium', version: '141' }, { brand: 'Microsoft Edge', version: '141.0.100.2' }] }; } } });
  assert.equal(calls, 1); assert.equal(result.browserVersion, '141.0.100.2'); assert.equal(result.model, undefined);
  assert.equal(reportedSystem(result), 'macOS 15.6.1');
  assert.equal((await collectDeviceObservation({ userAgent: ua, userAgentData: { getHighEntropyValues: async () => { throw Error(); } } })).source, 'user-agent');
  const start = Date.now();
  assert.equal((await collectDeviceObservation({ userAgent: ua, userAgentData: { getHighEntropyValues: () => new Promise(() => {}) } })).source, 'user-agent');
  assert.ok(Date.now() - start < 1500);
});

test('only explicit grouping joins browsers; equal owner labels and IP never do', () => {
  const base = { login: 'admin', name: 'Admin', role: 'ADMIN', connectionLabel: 'Mac Бэлы', lastIp: '203.0.113.1', lastSeenAt: '2026-10-18T11:00:00Z' } as AccessJournalRow;
  const rows = [{ ...base, id: 'a', browserInstanceId: 'a' }, { ...base, id: 'b', browserInstanceId: 'b' }];
  assert.equal(groupServiceConnections(rows).length, 2);
  assert.equal(groupServiceConnections(rows.map(r => ({ ...r, deviceGroupId: 'confirmed-by-admin' }))).length, 1);
  assert.equal(connectionMismatch(null, 'b'), false); assert.equal(connectionMismatch('a', 'a'), false); assert.equal(connectionMismatch('a', 'b'), true);
});

test('journal records binding date and mismatch without rewriting identity; clocks and old clients stay safe', async () => {
  process.env.PORTAL_SESSION_SECRET = 'test-only-device-evidence-secret-at-least-32-characters';
  const now = new Date('2026-10-18T12:00:00Z'); let existing: any = null; const writes: any[] = [];
  const db = { portalAccessSession: {
    findUnique: async () => existing, findFirst: async () => null,
    createMany: async (q: any) => { writes.push(q.data[0]); }, updateMany: async (q: any) => { writes.push(q.data); },
  } };
  const journal = await withMockDb('lib/portal-access-journal.ts', db);
  const a = crypto.randomUUID(), b = crypto.randomUUID();
  const input = { userId: 9, token: createSessionToken(9, now.getTime()), userAgent: 'Mac Chrome/141.0.0.0', browserInstanceId: a, origin: 'https://team.example/employee?private=yes', now };
  await journal.recordPortalAccess(input);
  assert.equal(writes[0].identityBoundAt, now); assert.equal(writes[0].observedOrigin, 'https://team.example');
  existing = { ...writes[0], userId: 9, deviceObservation: { source: 'client-hints', platform: 'macOS', platformVersion: '15.6.1' }, pushCheckedAt: now };
  // Cookie mismatch is recorded immediately, even inside the heartbeat throttle.
  await journal.recordPortalAccess({ ...input, browserInstanceId: b, now: new Date(now.getTime() + 1000), push: { permission: 'unknown', interactionAt: now.getTime() + 999999 } });
  assert.equal(writes[1].browserInstanceId, undefined); assert.equal(writes[1].observedBrowserId, b); assert.equal(writes[1].identityBoundAt, undefined);
  assert.equal(writes[1].lastInteractionAt, undefined);
  assert.equal(writes[1].pushCheckedAt, undefined); assert.equal(writes[1].pushState, undefined);
  await journal.recordPortalAccess({ ...input, now: new Date(now.getTime() + 61000), push: { permission: 'unknown', interactionAt: now.getTime() + 60000 } });
  assert.equal(writes[2].deviceObservation, undefined); assert.equal(writes[2].lastInteractionAt.getTime(), now.getTime() + 60000);
  assert.doesNotMatch(JSON.stringify(writes), /private=yes|password|serial/);
});

test('ambiguous identity cannot be renamed, classified or sent a remote update', async () => {
  const target = { browserInstanceId: 'old', observedBrowserId: 'new', userId: 9, expiresAt: new Date(Date.now() + 86400000) };
  let writes = 0;
  const db = { portalAccessSession: { findFirst: async () => target, findUnique: async () => target, updateMany: async () => { writes++; } }, portalAccessBrowserOwner: { createMany: async () => { writes++; } } };
  for (const [entry, body] of [
    ['owner', { sessionId: 'one', owned: true, label: 'Mac Аслана' }],
    ['service', { sessionId: 'one', isService: true }],
  ] as const) {
    const route = await mocked(`app/api/admin/employees/access/${entry}/route.ts`, { '@/lib/auth': { getCurrentAdmin: async () => ({ id: 9 }) }, '@/lib/prisma': { prisma: db } });
    const response = await route.POST(new Request('https://team.example/api', { method: 'POST', headers: { 'sec-fetch-site': 'same-origin' }, body: JSON.stringify(body) }));
    assert.equal(response.status, 409);
  }
  process.env.NEXT_PUBLIC_APP_VERSION = '1.5.4'; process.env.NEXT_PUBLIC_APP_BUILT_AT = '2026-10-18T12:00:00Z';
  const update = await withMockDb('lib/portal-app-update-server.ts', db);
  assert.equal((await update.requestAppUpdate('one', 9)).status, 409); assert.equal(writes, 0);
});
