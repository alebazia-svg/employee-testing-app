import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { withMockDb } from './access-telemetry.test';
import { mocked } from './portal-access-routes.test';
import { createSessionToken } from '../lib/session';

const url = 'postgresql://postgres:access-local-test-only@127.0.0.1:55451/access_telemetry_verified';
test('isolated PostgreSQL: evidence, explicit browser grouping, undo, cross-account continuity and conflict rejection', { skip: process.env.ACCESS_TELEMETRY_TEST_DB !== url }, async () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const users: number[] = [], marker = `evidence-${crypto.randomUUID()}`;
  process.env.PORTAL_SESSION_SECRET = 'test-only-device-evidence-secret-at-least-32-characters';
  try {
    const admin = await db.user.create({ data: { name: marker, login: marker, role: 'ADMIN', passwordHash: 'not-login' } }); users.push(admin.id);
    const employee = await db.user.create({ data: { name: marker, login: `${marker}-buyer`, role: 'EMPLOYEE', passwordHash: 'not-login' } }); users.push(employee.id);
    const otherAdmin = await db.user.create({ data: { name: marker, login: `${marker}-other`, role: 'ADMIN', passwordHash: 'not-login' } }); users.push(otherAdmin.id);
    const now = new Date(), a = crypto.randomUUID(), b = crypto.randomUUID(), c = crypto.randomUUID();
    const journal = await withMockDb('lib/portal-access-journal.ts', db);
    for (const [userId, browserInstanceId, offset] of [[admin.id, a, 0], [employee.id, b, 1000], [otherAdmin.id, c, 2000]] as const) {
      await journal.recordPortalAccess({ userId, token: createSessionToken(userId, now.getTime() + offset), browserInstanceId, origin: 'https://team.example/employee?secret=not-stored', userAgent: 'Mac Chrome/141.0.0.0', now: new Date(now.getTime() + offset), login: true, push: { permission: 'unknown', device: { source: 'client-hints', platform: 'macOS', platformVersion: '15.6.1', architecture: 'arm' }, interactionAt: now.getTime() } });
    }
    const sessions = await db.portalAccessSession.findMany({ where: { userId: { in: users } } });
    const first = sessions.find(r => r.browserInstanceId === a)!, second = sessions.find(r => r.browserInstanceId === b)!, foreign = sessions.find(r => r.browserInstanceId === c)!;
    assert.equal(first.observedOrigin, 'https://team.example'); assert.equal(first.identityBoundAt?.getTime(), now.getTime());
    assert.equal(first.observedBrowserId, a); assert.equal(first.lastInteractionAt?.getTime(), now.getTime());
    await db.portalAccessBrowserOwner.create({ data: { browserInstanceId: a, ownerUserId: admin.id, label: 'Mac Бэлы' } });
    await db.portalAccessBrowserOwner.create({ data: { browserInstanceId: c, ownerUserId: otherAdmin.id, label: 'Другой администратор' } });
    const route = await mocked('app/api/admin/employees/access/owner/route.ts', { '@/lib/auth': { getCurrentAdmin: async () => admin }, '@/lib/prisma': { prisma: db } });
    const post = (sessionId: string, linkSessionId?: string, owned = true) => route.POST(new Request('https://team.example/owner', { method: 'POST', headers: { 'sec-fetch-site': 'same-origin' }, body: JSON.stringify({ sessionId, owned, label: 'Отдельный Chrome', ...(linkSessionId ? { linkSessionId } : {}) }) }));
    assert.equal((await post(second.id, foreign.id)).status, 409);
    assert.equal(await db.portalAccessBrowserOwner.findUnique({ where: { browserInstanceId: b } }), null);
    assert.equal((await post(second.id, first.id)).status, 200);
    let mappings = await db.portalAccessBrowserOwner.findMany({ where: { browserInstanceId: { in: [a, b] } } });
    assert.ok(mappings.every(m => m.deviceGroupId === a && m.label === 'Mac Бэлы'));
    assert.deepEqual(await db.portalAccessSession.findUnique({ where: { id: second.id } }), second, 'grouping must not mutate session, push, auth or evidence');
    // Same browser in another account keeps exactly the registered owner; no auto merge by UA.
    await journal.recordPortalAccess({ userId: admin.id, token: createSessionToken(admin.id, now.getTime() + 3000), browserInstanceId: b, userAgent: 'Mac Chrome', now: new Date(now.getTime() + 3000), login: true });
    assert.equal(await db.portalAccessSession.count({ where: { browserInstanceId: b, userId: { in: users } } }), 2);
    assert.equal((await post(second.id)).status, 200); // explicit separate name undoes only this browser's group
    mappings = await db.portalAccessBrowserOwner.findMany({ where: { browserInstanceId: { in: [a, b] } } });
    assert.equal(mappings.find(m => m.browserInstanceId === b)?.deviceGroupId, null);
    assert.equal(mappings.find(m => m.browserInstanceId === a)?.label, 'Mac Бэлы');
    await db.portalAccessSession.update({ where: { id: second.id }, data: { observedBrowserId: crypto.randomUUID() } });
    assert.equal((await post(second.id, first.id)).status, 409);
    // No guessing/backfilling timestamps on an old record that already has an ID.
    await db.portalAccessSession.update({ where: { id: first.id }, data: { identityBoundAt: null } });
    await journal.recordPortalAccess({ userId: admin.id, token: createSessionToken(admin.id, now.getTime()), browserInstanceId: a, userAgent: 'Mac Chrome', now: new Date(now.getTime() + 61000) });
    assert.equal((await db.portalAccessSession.findUniqueOrThrow({ where: { id: first.id } })).identityBoundAt, null);
  } finally { await db.user.deleteMany({ where: { id: { in: users } } }); await db.$disconnect(); }
});
