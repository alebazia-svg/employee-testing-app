import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { mocked } from './portal-access-routes.test';
import { withMockDb } from './access-telemetry.test';
import { createSessionToken } from '../lib/session';
import { validAccessBrowserId } from '../lib/portal-access-identity';
import { accessOwnerView } from '../lib/portal-access-view';

test('service classification is ADMIN-only, same-origin, bounded and reversible', async () => {
  let admin: any = null; const writes: any[] = [];
  const route = await mocked('app/api/admin/employees/access/service/route.ts', {
    '@/lib/auth': { getCurrentAdmin: async () => admin },
    '@/lib/prisma': { prisma: { portalAccessSession: {
      findUnique: async () => ({ id: 'one', userId: 42, browserInstanceId: 'known-browser' }),
      updateMany: async (q: any) => { writes.push(q); return { count: 2 }; },
    } } },
  });
  const post = (body: any = { sessionId: 'one', isService: true }, site = 'same-origin') => route.POST(new Request('https://portal.invalid/api/admin/employees/access/service', { method: 'POST', headers: { 'sec-fetch-site': site }, body: JSON.stringify(body) }));
  assert.equal((await post()).status, 403); admin = { id: 9 };
  assert.equal((await post(undefined, 'cross-site')).status, 403);
  for (const body of [{ sessionId: 'one', isService: 'true' }, { sessionId: 'one', isService: true, userId: 7 }, { sessionId: 'x'.repeat(500), isService: true }]) assert.equal((await post(body)).status, 400);
  assert.equal(writes.length, 0);
  assert.equal((await post()).status, 200);
  assert.deepEqual(writes[0].where, { userId: 42, browserInstanceId: 'known-browser' });
  assert.equal(writes[0].data.serviceMarkedBy, 9);
  assert.equal((await post({ sessionId: 'one', isService: false })).status, 200);
  assert.equal(writes[1].data.isService, false);
  assert.doesNotMatch(JSON.stringify(writes), /disabledAt|pushState|expiresAt|loggedOutAt/);
});

test('browser identifiers are bounded random UUIDs, not user-agent guesses', () => {
  assert.equal(validAccessBrowserId(crypto.randomUUID()), true);
  for (const value of ['Chrome', '', 'x'.repeat(10000), null, {}, 1]) assert.equal(validAccessBrowserId(value), false);
});

test('owner browser keeps ADMIN working; same browser under employee is service, unknown is not guessed', () => {
  assert.deepEqual(accessOwnerView(9, 9, 9), { ownerInspection: false, ownerBrowser: true, canMarkOwner: true });
  assert.deepEqual(accessOwnerView(9, 42, 9), { ownerInspection: true, ownerBrowser: false, canMarkOwner: false });
  assert.deepEqual(accessOwnerView(undefined, 42, 9), { ownerInspection: false, ownerBrowser: false, canMarkOwner: false });
});

test('owner marking rejects another account, unknown identity and cross-origin callers', async () => {
  let admin: any = null, target: any = null; const writes: any[] = [];
  const route = await mocked('app/api/admin/employees/access/owner/route.ts', {
    '@/lib/auth': { getCurrentAdmin: async () => admin },
    '@/lib/prisma': { prisma: { portalAccessSession: { findFirst: async (q: any) => { assert.equal(q.where.userId, 9); return target; } }, portalAccessBrowserOwner: {
      createMany: async (q: any) => { writes.push(q); }, updateMany: async (q: any) => { writes.push(q); return { count: 1 }; },
    } } },
  });
  const post = (body: any = { sessionId: 'one', owned: true }, site = 'same-origin') => route.POST(new Request('https://portal.invalid/owner', { method: 'POST', headers: { 'sec-fetch-site': site }, body: JSON.stringify(body) }));
  assert.equal((await post()).status, 403); admin = { id: 9 };
  assert.equal((await post(undefined, 'cross-site')).status, 403);
  assert.equal((await post({ sessionId: 'one', owned: true, ownerUserId: 42 })).status, 400);
  assert.equal((await post()).status, 404);
  target = { browserInstanceId: null }; assert.equal((await post()).status, 409);
  assert.equal(writes.length, 0);
  target = { browserInstanceId: 'confirmed-browser' }; assert.equal((await post()).status, 200);
  assert.equal(writes[0].data[0].ownerUserId, 9);
  assert.deepEqual(writes[1].where, { browserInstanceId: 'confirmed-browser', ownerUserId: 9 });
});

const url = 'postgresql://postgres:access-local-test-only@127.0.0.1:55451/access_telemetry_verified';
test('isolated DB: browser identity survives new logins; classification preserves subscriptions and old records', { skip: process.env.ACCESS_TELEMETRY_TEST_DB !== url }, async () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  process.env.PORTAL_SESSION_SECRET = 'test-only-access-classification-secret-at-least-32';
  const marker = `classification-${crypto.randomUUID()}`;
  const user = await db.user.create({ data: { name: marker, login: marker, role: 'ADMIN', passwordHash: 'not-login' } });
  try {
    const journal = await withMockDb('lib/portal-access-journal.ts', db);
    const now = new Date(), browserInstanceId = crypto.randomUUID();
    const input = { userId: user.id, token: createSessionToken(user.id, now.getTime()), userAgent: 'Mac Chrome', now };
    await journal.recordPortalAccess(input);
    const original = await db.portalAccessSession.findFirstOrThrow({ where: { userId: user.id } });
    assert.equal(original.browserInstanceId, null); assert.equal(original.isService, false);
    await journal.recordPortalAccess({ ...input, browserInstanceId, now: new Date(now.getTime() + 1000) });
    let saved = await db.portalAccessSession.findUniqueOrThrow({ where: { id: original.id } });
    assert.equal(saved.browserInstanceId, browserInstanceId);
    await journal.recordPortalAccess({ ...input, browserInstanceId: crypto.randomUUID(), now: new Date(now.getTime() + 61000) });
    saved = await db.portalAccessSession.findUniqueOrThrow({ where: { id: original.id } });
    assert.equal(saved.browserInstanceId, browserInstanceId);
    await journal.recordPortalAccess({ ...input, token: createSessionToken(user.id, now.getTime() + 2000), browserInstanceId, now: new Date(now.getTime() + 2000) });
    assert.equal(await db.portalAccessSession.count({ where: { userId: user.id, browserInstanceId } }), 2);
    const service = await mocked('app/api/admin/employees/access/service/route.ts', { '@/lib/auth': { getCurrentAdmin: async () => user }, '@/lib/prisma': { prisma: db } });
    const post = (value: boolean) => service.POST(new Request('https://portal.invalid/service', { method: 'POST', headers: { 'sec-fetch-site': 'same-origin' }, body: JSON.stringify({ sessionId: original.id, isService: value }) }));
    assert.equal((await post(true)).status, 200);
    assert.equal(await db.portalAccessSession.count({ where: { userId: user.id, isService: true } }), 2);
    await journal.recordPortalAccess({ ...input, token: createSessionToken(user.id, now.getTime() + 3000), browserInstanceId, now: new Date(now.getTime() + 3000) });
    assert.equal(await db.portalAccessSession.count({ where: { userId: user.id, isService: true } }), 3);
    assert.equal((await post(false)).status, 200);
    saved = await db.portalAccessSession.findUniqueOrThrow({ where: { id: original.id } });
    assert.equal(saved.isService, false); assert.equal(saved.serviceMarkedBy, user.id);
    assert.equal(saved.expiresAt.getTime(), original.expiresAt.getTime());
    assert.equal(saved.pushState, original.pushState); assert.equal(saved.loggedOutAt, null);
    const owner = await mocked('app/api/admin/employees/access/owner/route.ts', { '@/lib/auth': { getCurrentAdmin: async () => user }, '@/lib/prisma': { prisma: db } });
    const markOwned = (owned: boolean) => owner.POST(new Request('https://portal.invalid/owner', { method: 'POST', headers: { 'sec-fetch-site': 'same-origin' }, body: JSON.stringify({ sessionId: original.id, owned }) }));
    assert.equal((await markOwned(true)).status, 200);
    let mapping = await db.portalAccessBrowserOwner.findUniqueOrThrow({ where: { browserInstanceId } });
    assert.equal(mapping.ownerUserId, user.id); assert.equal(mapping.disabledAt, null);
    assert.equal((await markOwned(false)).status, 200);
    mapping = await db.portalAccessBrowserOwner.findUniqueOrThrow({ where: { browserInstanceId } });
    assert.ok(mapping.disabledAt);
  } finally { await db.user.delete({ where: { id: user.id } }); await db.$disconnect(); }
});
