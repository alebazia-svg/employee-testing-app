import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmployeeAppUpdater, type UpdateAttempt } from '../lib/employee-app-update';
import { parseAppObservation, sameRelease } from '../lib/portal-app-observation';
import { appUpdateStatus } from '../lib/portal-app-update-view';
import { PrismaClient } from '@prisma/client';
import { withMockDb } from './access-telemetry.test';
import { createSessionToken } from '../lib/session';

const current = { version: '1.4.20', builtAt: '2026-10-18T06:00:00.000Z' };
const old = { version: '1.4.19', builtAt: '2026-10-17T06:00:00.000Z' };
const app = { ...old, clientId: '00000000-0000-4000-8000-000000000001', state: 'operation' as const };
test('app observations are bounded, allow-listed and cannot provide a target or user identity', () => {
  assert.deepEqual(parseAppObservation(app), app);
  for (const bad of [{ ...app, state: 'success' }, { ...app, userId: 8 }, { ...app, target: 'https://evil.invalid' }, { ...app, commandId: 'oops' }, { ...app, clientId: 'token' }, { ...app, builtAt: '' }, { ...app, version: 'v'.repeat(500) }]) assert.equal(parseAppObservation(bad), null);
  assert.equal(sameRelease(current, { ...current, builtAt: old.builtAt }), false);
});
test('status is based on device release and freshness, never a claimed current flag or queued command', () => {
  const now = new Date('2026-10-18T07:00:00Z');
  const view = { ...app, state: 'current' as const, checkedAt: now.toISOString() };
  assert.equal(appUpdateStatus(view, current, now).label, 'Доступно обновление');
  assert.equal(appUpdateStatus({ ...view, ...current }, current, now).tone, 'ok');
  assert.equal(appUpdateStatus({ ...view, checkedAt: '2026-10-16T07:00:00Z' }, current, now).canRequest, false);
  assert.equal(appUpdateStatus(null, current, now).canRequest, false);
  assert.equal(appUpdateStatus(view, null, now).needsUpdate, false);
  assert.equal(appUpdateStatus({ ...view, command: { target: current, requestedAt: now.toISOString() } }, current, now).label, 'Запрос отправлен');
});
test('admin command cannot bypass a form; failed cached reloads stop after two attempts', async () => {
  let time = Date.parse('2026-10-18T07:00:00Z'), safe = false, attempt: UpdateAttempt | null = null, reloads = 0, command: string | undefined;
  const states: string[] = [];
  const make = () => createEmployeeAppUpdater(old, { now: () => time, safe: () => safe, visible: () => true, fetchRelease: async () => current, readAttempt: () => attempt,
    saveAttempt: value => { attempt = value; }, reload: () => { reloads++; }, blockedReason: () => 'form', observe: state => states.push(state), commandId: () => command });
  await make().check(); assert.equal(reloads, 0); assert.equal(states.at(-1), 'form');
  safe = true;
  await make().check(); assert.equal(reloads, 1);
  time += 301000; await make().check(); assert.equal(reloads, 2);
  time += 301000; await make().check(); assert.equal(reloads, 2); assert.equal(states.at(-1), 'reload_failed');
  command = crypto.randomUUID(); await make().check(); assert.equal(reloads, 3);
  time += 301000; await make().check(); assert.equal(reloads, 4);
  time += 301000; await make().check(); assert.equal(reloads, 4);
});
test('failed metadata and unavailable storage have different reasons and never navigate', async () => {
  const states: string[] = [];
  const env = { now: Date.now, safe: () => true, visible: () => true, readAttempt: () => null, saveAttempt: () => {}, reload: () => { assert.fail('unsafe reload'); }, observe: (s: string) => states.push(s) };
  await createEmployeeAppUpdater(old, { ...env, fetchRelease: async () => { throw Error('network'); } }).check();
  assert.equal(states.at(-1), 'check_failed');
  await createEmployeeAppUpdater(old, { ...env, fetchRelease: async () => current, saveAttempt: () => { throw Error('storage'); } }).check();
  assert.equal(states.at(-1), 'storage_failed');
});

const url = 'postgresql://postgres:access-local-test-only@127.0.0.1:55451/access_telemetry_verified';
test('real isolated database: scoped/idempotent commands, real version confirmation, expiry and disabled users', { skip: process.env.ACCESS_TELEMETRY_TEST_DB !== url }, async () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  process.env.PORTAL_SESSION_SECRET = 'test-only-app-update-secret-at-least-32-characters';
  process.env.NEXT_PUBLIC_APP_VERSION = current.version; process.env.NEXT_PUBLIC_APP_BUILT_AT = current.builtAt;
  const marker = `app-update-${crypto.randomUUID()}`;
  const user = await db.user.create({ data: { name: marker, login: marker, role: 'EMPLOYEE', passwordHash: 'not-login' } });
  const admin = await db.user.create({ data: { name: marker, login: `${marker}-admin`, role: 'ADMIN', passwordHash: 'not-login' } });
  try {
    const server = await withMockDb('lib/portal-app-update-server.ts', db);
    const journal = await withMockDb('lib/portal-access-journal.ts', db);
    const now = new Date();
    const token = createSessionToken(user.id, now.getTime());
    await journal.recordPortalAccess({ userId: user.id, token, userAgent: 'test', now });
    const session = await db.portalAccessSession.findFirstOrThrow({ where: { userId: user.id } });
    assert.equal((await server.requestAppUpdate(session.id, admin.id, now)).status, 409);
    await server.observeAppUpdate(user.id, token, app, now);
    const attempts = await Promise.all([server.requestAppUpdate(session.id, admin.id, now), server.requestAppUpdate(session.id, admin.id, now)]);
    const first = attempts.find(r => r.status === 200)!;
    assert.ok(first.command); assert.ok(attempts.every(r => [200, 409].includes(r.status)));
    const repeat = await server.requestAppUpdate(session.id, admin.id, now);
    assert.equal(repeat.command.id, first.command.id);
    assert.equal(await server.observeAppUpdate(admin.id, token, app, now), null);
    assert.equal(await server.observeAppUpdate(user.id, token, { ...app, clientId: crypto.randomUUID(), ...current }, now), null);
    let record = await db.portalAccessSession.findUniqueOrThrow({ where: { id: session.id } });
    assert.equal((record.appObservation as any).version, old.version);
    assert.equal((record.appUpdateCommand as any).completedAt, undefined);
    assert.equal((await server.observeAppUpdate(user.id, token, app, now)).id, first.command.id);
    await server.observeAppUpdate(user.id, token, { ...app, commandId: first.command.id, state: 'current' }, now);
    record = await db.portalAccessSession.findUniqueOrThrow({ where: { id: session.id } });
    assert.ok((record.appUpdateCommand as any).receivedAt);
    assert.equal((record.appUpdateCommand as any).completedAt, undefined);
    await server.observeAppUpdate(user.id, token, { ...app, ...current, commandId: first.command.id }, now);
    record = await db.portalAccessSession.findUniqueOrThrow({ where: { id: session.id } });
    assert.ok((record.appUpdateCommand as any).completedAt);
    assert.equal((await server.requestAppUpdate(session.id, admin.id, now)).status, 409);
    await db.user.update({ where: { id: user.id }, data: { isActive: false } });
    assert.equal((await server.requestAppUpdate(session.id, admin.id, now)).status, 404);
    await db.user.update({ where: { id: user.id }, data: { isActive: true } });
    await db.portalAccessSession.update({ where: { id: session.id }, data: { loggedOutAt: now } });
    assert.equal((await server.requestAppUpdate(session.id, admin.id, now)).status, 404);
    assert.equal(await server.observeAppUpdate(user.id, token, app, now), null);
  } finally { await db.user.deleteMany({ where: { id: { in: [user.id, admin.id] } } }); await db.$disconnect(); }
});
