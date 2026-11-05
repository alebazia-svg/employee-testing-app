import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { mocked } from './portal-access-routes.test';

const entry = 'app/api/admin/employees/access/archive/route.ts';
const request = (body: unknown, site = 'same-origin') => new Request('https://portal.invalid/api/admin/employees/access/archive', { method: 'POST', headers: { 'sec-fetch-site': site }, body: JSON.stringify(body) });
test('archive rejects unauthenticated/cross-origin/malformed writes before database access', async () => {
  let admin: unknown = null, reads = 0;
  const route = await mocked(entry, {
    '@/lib/auth': { getCurrentAdmin: async () => admin },
    'next/headers': { cookies: async () => ({ get: () => undefined }) },
    '@/lib/prisma': { prisma: { $transaction: async () => { reads++; throw Error('private'); } } },
  });
  assert.equal((await route.POST(request({ sessionId: 'one', archived: true }))).status, 403);
  admin = { id: 1 };
  assert.equal((await route.POST(request({}, 'same-site'))).status, 403);
  for (const body of [{}, { sessionId: 'one', archived: true }, { sessionId: 'one', archived: true, lastSeenAt: 'invalid' }, { sessionId: 'one', archived: false, browserInstanceId: randomUUID() }, { sessionId: 'x'.repeat(600), archived: false }]) assert.equal((await route.POST(request(body))).status, 400);
  assert.equal(reads, 0);
  const response = await route.POST(request({ sessionId: 'one', archived: false }));
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private/);
});

const url = process.env.ACCESS_RECENT_TEST_DB;
test('PostgreSQL: manual archive preserves evidence/auth/names, handles mismatch, returns on new contact and restores', { skip: !url }, async () => {
  assert.equal(url, 'postgresql://postgres:access-demo-local-only@127.0.0.1:55504/access_demo', 'isolated DB only');
  const db = new PrismaClient({ datasources: { db: { url } } });
  const user = await db.user.create({ data: { login: `archive-test-${randomUUID()}`, name: 'Archive test', role: 'ADMIN', passwordHash: 'unused', isActive: true } });
  const employee = await db.user.create({ data: { login: `archive-employee-${randomUUID()}`, name: 'Archive employee', role: 'EMPLOYEE', passwordHash: 'unused', isActive: true } });
  let currentId: string | undefined;
  const route = await mocked(entry, { '@/lib/auth': { getCurrentAdmin: async () => user }, '@/lib/prisma': { prisma: db }, 'next/headers': { cookies: async () => ({ get: () => currentId ? { value: currentId } : undefined }) } });
  try {
    const at = new Date(Date.now() - 3600000), browserId = randomUUID();
    const create = (code: string) => db.portalAccessSession.create({ data: { userId: user.id, sessionHash: randomUUID(), device: 'Mac', browser: 'Chrome', browserInstanceId: code, observedBrowserId: randomUUID(), firstSeenAt: at, loginAt: at, lastSeenAt: at, expiresAt: new Date(Date.now() + 86400000), deviceObservation: { source: 'user-agent', platform: 'macOS' } } });
    const target = await create(browserId), sibling = await create(browserId), other = await create(randomUUID());
    const named = await create(randomUUID());
    await db.portalAccessBrowserOwner.create({ data: { browserInstanceId: named.browserInstanceId!, ownerUserId: user.id, label: 'Saved name' } });
    assert.equal((await route.POST(request({ sessionId: named.id, archived: true, lastSeenAt: at.toISOString() }))).status, 409);
    currentId = browserId;
    assert.equal((await route.POST(request({ sessionId: target.id, archived: true, lastSeenAt: at.toISOString() }))).status, 409);
    currentId = undefined;
    assert.equal((await route.POST(request({ sessionId: target.id, archived: true, lastSeenAt: new Date(+at - 1).toISOString() }))).status, 409);
    assert.equal((await route.POST(request({ sessionId: target.id, archived: true, lastSeenAt: at.toISOString() }))).status, 200, 'mismatched legacy record can be hidden without relabelling identity');
    const saved = await db.portalAccessSession.findUniqueOrThrow({ where: { id: target.id } });
    assert.ok(saved.listArchivedAt);
    assert.deepEqual({ ...saved, listArchivedAt: null }, { ...target, listArchivedAt: null });
    assert.ok((await db.portalAccessSession.findUniqueOrThrow({ where: { id: sibling.id } })).listArchivedAt);
    assert.equal((await db.portalAccessSession.findUniqueOrThrow({ where: { id: other.id } })).listArchivedAt, null);
    assert.equal((await db.portalAccessBrowserOwner.findUniqueOrThrow({ where: { browserInstanceId: named.browserInstanceId! } })).label, 'Saved name');
    const { accessHasRecentContact } = await import('../lib/portal-access-view');
    assert.equal(accessHasRecentContact({ lastSeenAt: saved.lastSeenAt.toISOString(), listArchivedAt: saved.listArchivedAt!.toISOString() }, new Date()), false);
    const contact = new Date(saved.listArchivedAt!.getTime() + 1);
    await db.portalAccessSession.update({ where: { id: target.id }, data: { lastSeenAt: contact } });
    assert.equal(accessHasRecentContact({ lastSeenAt: contact.toISOString(), listArchivedAt: saved.listArchivedAt!.toISOString() }, new Date()), true);
    assert.equal((await route.POST(request({ sessionId: target.id, archived: false }))).status, 200);
    assert.equal(await db.portalAccessSession.count({ where: { userId: user.id, listArchivedAt: { not: null } } }), 0);
    assert.equal(await db.portalAccessSession.count({ where: { userId: user.id } }), 4);
    const shared = await create(randomUUID());
    const employeeSession = await db.portalAccessSession.create({ data: { userId: employee.id, sessionHash: randomUUID(), device: 'Mac', browser: 'Edge', browserInstanceId: shared.browserInstanceId, observedBrowserId: randomUUID(), firstSeenAt: at, lastSeenAt: at, expiresAt: new Date(Date.now() + 86400000) } });
    assert.equal((await route.POST(request({ sessionId: employeeSession.id, archived: true, lastSeenAt: at.toISOString() }))).status, 200, 'cross-account ADMIN browser can hide its mismatched employee record');
    assert.equal((await db.portalAccessSession.findUniqueOrThrow({ where: { id: shared.id } })).listArchivedAt, null, 'other account remains unchanged');
    const working = await db.portalAccessSession.create({ data: { userId: employee.id, sessionHash: randomUUID(), device: 'Mac', browser: 'Edge', browserInstanceId: randomUUID(), firstSeenAt: at, lastSeenAt: at, expiresAt: new Date(Date.now() + 86400000) } });
    assert.equal((await route.POST(request({ sessionId: working.id, archived: true, lastSeenAt: at.toISOString() }))).status, 409, 'ordinary employee device is outside this action');
  } finally { const ids = [user.id, employee.id]; await db.portalAccessSession.deleteMany({ where: { userId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } }); await db.$disconnect(); }
});
