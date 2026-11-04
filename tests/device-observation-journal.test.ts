import test from 'node:test';
import assert from 'node:assert/strict';
import { withMockDb } from './access-telemetry.test';
import { createSessionToken } from '../lib/session';

test('cached device evidence keeps its sample time across heartbeats; old clients stay compatible', async () => {
  process.env.PORTAL_SESSION_SECRET = 'test-only-device-evidence-secret-at-least-32-characters';
  const now = new Date('2026-11-04T12:00:00Z'), sampled = '2026-11-04T11:58:00.000Z';
  let existing: any = null; const writes: any[] = [];
  const journal = await withMockDb('lib/portal-access-journal.ts', { portalAccessSession: {
    findUnique: async () => existing, findFirst: async () => null,
    createMany: async (q: any) => { writes.push(q.data[0]); }, updateMany: async (q: any) => { writes.push(q.data); },
  } });
  const input = { userId: 9, token: createSessionToken(9, now.getTime()), userAgent: 'iPhone Version/26.2 Safari/605', now };
  const device = { source: 'user-agent', platform: 'iOS / iPadOS', fieldSources: { platform: 'user-agent' }, collectedAt: sampled, hintsState: 'unsupported' };
  assert.ok(journal.parsePushObservation({ permission: 'unknown', device }));
  await journal.recordPortalAccess({ ...input, push: { permission: 'unknown', device } });
  assert.equal(writes[0].deviceCheckedAt.toISOString(), sampled);
  existing = { ...writes[0], userId: 9, pushCheckedAt: now };
  await journal.recordPortalAccess({ ...input, now: new Date(+now + 61000), push: { permission: 'unknown', device } });
  assert.equal(writes[1].deviceCheckedAt, undefined, 'identical cached sample must not rewrite collection time');
  assert.equal(writes[1].lastSeenAt.toISOString(), '2026-11-04T12:01:01.000Z');
  await journal.recordPortalAccess({ ...input, now: new Date(+now + 122000), push: { permission: 'unknown', device: { ...device, collectedAt: '2027-01-01T00:00:00.000Z' } } });
  assert.equal(writes[2].deviceCheckedAt, null, 'future sample must not claim a fresh check');
  await journal.recordPortalAccess({ ...input, now: new Date(+now + 183000), push: { permission: 'unknown', device: { source: 'user-agent', platform: 'iOS / iPadOS' } } });
  assert.equal(writes[3].deviceObservation, undefined, 'an old open tab must not erase newer provenance');
  assert.equal(writes[3].deviceCheckedAt, undefined);
  existing = { ...existing, deviceObservation: { source: 'user-agent', platform: 'iOS / iPadOS' } };
  await journal.recordPortalAccess({ ...input, now: new Date(+now + 244000), push: { permission: 'unknown', device: { source: 'user-agent', platform: 'iOS / iPadOS' } } });
  assert.equal(+writes[4].deviceCheckedAt, +now + 244000);
});

const demoUrl = 'postgresql://postgres:access-demo-local-only@127.0.0.1:55504/access_demo';
test('isolated PostgreSQL persists per-field sources and sample time through the actual journal', { skip: process.env.ACCESS_RECENT_TEST_DB !== demoUrl }, async () => {
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: demoUrl } } });
  let userId: number | undefined;
  try {
    const user = await db.user.create({ data: { name: 'Disposable device evidence', login: `device-evidence-${crypto.randomUUID()}`, role: 'EMPLOYEE', passwordHash: 'no-login' } }); userId = user.id;
    const now = new Date(), sampled = new Date(+now - 120000).toISOString();
    const journal = await withMockDb('lib/portal-access-journal.ts', db);
    const device = { source: 'client-hints', platform: 'Android', platformVersion: '10', model: 'Pixel 9', collectedAt: sampled, hintsState: 'partial', fieldSources: { platform: 'client-hints', platformVersion: 'user-agent', model: 'client-hints' } };
    await journal.recordPortalAccess({ userId, token: createSessionToken(userId, +now), browserInstanceId: crypto.randomUUID(), userAgent: 'Android 10 Chrome/142.0.0.0', now, push: { permission: 'unknown', device } });
    const saved = await db.portalAccessSession.findFirstOrThrow({ where: { userId } });
    assert.deepEqual(saved.deviceObservation, device); assert.equal(saved.deviceCheckedAt?.toISOString(), sampled);
    assert.equal(saved.lastSeenAt.toISOString(), now.toISOString());
  } finally { if (userId) await db.user.delete({ where: { id: userId } }); await db.$disconnect(); }
});
