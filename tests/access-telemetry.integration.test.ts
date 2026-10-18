import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { withMockDb } from './access-telemetry.test';
import { createSessionToken } from '../lib/session';
import { accessLastPushForUser } from '../lib/portal-access-view';

const url = 'postgresql://postgres:access-local-test-only@127.0.0.1:55451/access_telemetry_verified';
test('isolated PostgreSQL: mode persistence, old clients, provider results and account isolation', { skip: process.env.ACCESS_TELEMETRY_TEST_DB !== url }, async () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const marker = `access-telemetry-${crypto.randomUUID()}`;
  process.env.PORTAL_SESSION_SECRET = 'test-only-access-context-secret-at-least-32-characters';
  const user = await db.user.create({ data: { name: marker, login: marker, role: 'EMPLOYEE', passwordHash: 'not-login' } });
  const other = await db.user.create({ data: { name: marker, login: `${marker}-other`, role: 'ADMIN', passwordHash: 'not-login' } });
  try {
    const journal = await withMockDb('lib/portal-access-journal.ts', db);
    const { observePushAttempt } = await withMockDb('lib/push-attempt-observation.ts', db);
    const now = new Date();
    const input = { userId: user.id, token: createSessionToken(user.id, now.getTime()), userAgent: 'iPhone Safari/605', now };
    await journal.recordPortalAccess(input);
    let session = await db.portalAccessSession.findFirstOrThrow({ where: { userId: user.id } });
    assert.equal(session.displayMode, null); assert.equal(session.contextCheckedAt, null);
    const sub = await db.workdayPushSubscription.create({ data: { userId: user.id, endpoint: `https://push.invalid/${marker}`, p256dh: 'local', auth: 'local' } });
    assert.equal(sub.lastPushAttemptAt, null); assert.equal(sub.lastPushOutcome, null);
    const after = new Date(now.getTime() + 1000);
    await journal.recordPortalAccess({ ...input, now: after, push: { permission: 'granted', endpoint: sub.endpoint, displayMode: 'app' } });
    session = await db.portalAccessSession.findUniqueOrThrow({ where: { id: session.id } });
    assert.equal(session.displayMode, 'app'); assert.equal(session.contextCheckedAt?.getTime(), after.getTime());
    assert.equal(session.pushSubscriptionId, sub.id);
    // Old clients must not erase known context or fabricate a fresh check of it.
    await journal.recordPortalAccess({ ...input, now: new Date(after.getTime() + 61000), push: { permission: 'granted', endpoint: sub.endpoint } });
    session = await db.portalAccessSession.findUniqueOrThrow({ where: { id: session.id } });
    assert.equal(session.displayMode, 'app'); assert.equal(session.contextCheckedAt?.getTime(), after.getTime());
    await observePushAttempt(sub, async () => ({ statusCode: 201 }));
    let saved = await db.workdayPushSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    assert.equal(saved.lastPushOutcome, 'accepted'); assert.equal(saved.disabledAt, null);
    assert.equal(accessLastPushForUser(saved, user.id)?.outcome, 'accepted');
    assert.equal(accessLastPushForUser(saved, other.id), null);
    let unlock!: () => void; let locked!: () => void;
    const lockReady = new Promise<void>(resolve => { locked = resolve; });
    const lock = db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "WorkdayPushSubscription" WHERE id = ${sub.id} FOR UPDATE`;
      locked(); await new Promise<void>(resolve => { unlock = resolve; });
    }, { timeout: 5000 });
    await lockReady;
    try {
      const start = Date.now();
      assert.equal(await observePushAttempt(sub, async () => 'accepted-while-audit-locked'), 'accepted-while-audit-locked');
      assert.ok(Date.now() - start < 2000, 'audit lock must not stall sender');
    } finally { unlock(); await lock; }
    // A slow older attempt cannot overwrite a later result.
    let finishOld!: () => void;
    const old = observePushAttempt(sub, () => new Promise<void>(resolve => { finishOld = resolve; }));
    await new Promise(resolve => setTimeout(resolve, 5));
    const rejected = Object.assign(Error('test-only'), { statusCode: 410 });
    await assert.rejects(observePushAttempt(sub, async () => { throw rejected; }));
    finishOld(); await old;
    saved = await db.workdayPushSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    assert.equal(saved.lastPushOutcome, 'rejected'); assert.equal(saved.lastPushErrorCode, 'HTTP_410');
    // Audit never disables; existing sender policy retains that responsibility.
    assert.equal(saved.disabledAt, null);
    await db.workdayPushSubscription.update({ where: { id: sub.id }, data: { disabledAt: now } });
    await journal.recordPortalAccess({ ...input, now: new Date(after.getTime() + 122000), push: { permission: 'default', displayMode: 'browser' } });
    session = await db.portalAccessSession.findUniqueOrThrow({ where: { id: session.id } });
    assert.equal(session.displayMode, 'browser'); assert.equal(session.pushState, 'not_connected');
    assert.equal(session.pushSubscriptionId, sub.id); // Failure still inspectable.
    const moved = await db.workdayPushSubscription.update({ where: { id: sub.id }, data: { userId: other.id } });
    assert.equal(accessLastPushForUser(moved, user.id), null);
    assert.equal(accessLastPushForUser(moved, other.id), null);
    await observePushAttempt(sub, async () => ({ statusCode: 201 }));
    saved = await db.workdayPushSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    assert.equal(saved.lastPushOutcome, 'rejected'); // stale owner cannot update
    await assert.rejects(db.portalAccessSession.update({ where: { id: session.id }, data: { displayMode: 'guessed-iphone' } }));
  } finally {
    await db.user.deleteMany({ where: { id: { in: [user.id, other.id] } } });
    await db.$disconnect();
  }
});
