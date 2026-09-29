import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createSessionToken } from '../lib/session';

test('isolated DB: real login vs discovered session, no guessing push ownership, logout and concurrency', { skip: !process.env.PROCUREMENT_TEST_DATABASE_URL }, async () => {
  assert.equal(process.env.PROCUREMENT_TEST_DATABASE_URL, 'postgresql://postgres:local-test-only@127.0.0.1:55437/delivery_integration_20260927');
  process.env.PORTAL_SESSION_SECRET = 'access-test-only-secret-at-least-32-characters';
  const db = new PrismaClient({ datasources: { db: { url: process.env.PROCUREMENT_TEST_DATABASE_URL } } });
  const marker = `access-${crypto.randomUUID()}`;
  const user = await db.user.create({ data: { name: marker, login: marker, passwordHash: 'not-login', role: 'EMPLOYEE' } });
  const other = await db.user.create({ data: { name: marker, login: `${marker}-other`, passwordHash: 'not-login', role: 'ADMIN' } });
  try {
    const result = await build({ entryPoints: ['lib/portal-access-journal.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'db', setup(b) { b.onResolve({ filter: /^\.\/prisma$/ }, a => ({ path: a.path, external: true })); } }] });
    const mod = { exports: {} as any }; const require = createRequire(import.meta.url);
    new Function('require', 'module', 'exports', result.outputFiles[0].text)((name: string) => name === './prisma' ? { prisma: db } : require(name), mod, mod.exports);
    const { recordPortalAccess, recordPortalLogout, accessSessionIdentity, parsePushObservation } = mod.exports;
    const now = new Date(); const token = createSessionToken(user.id, now.getTime());
    const input = { userId: user.id, token, userAgent: 'Mozilla Macintosh Chrome/153 Edg/153 private-string', now };
    assert.equal(accessSessionIdentity(token, other.id, now), null);
    assert.equal(accessSessionIdentity('invalid', user.id, now), null);
    for (const invalid of [null, { permission: 'oops' }, { permission: 'granted', endpoint: 'http://example.invalid' }, { permission: 'granted', ip: 'secret' }]) assert.equal(parsePushObservation(invalid), null);
    await recordPortalAccess({ ...input, token: 'invalid' });
    assert.equal(await db.portalAccessSession.count({ where: { userId: user.id } }), 0);
    await Promise.all([recordPortalAccess({ ...input, login: true }), recordPortalAccess({ ...input, login: true })]);
    let rows = await db.portalAccessSession.findMany({ where: { userId: user.id } }); assert.equal(rows.length, 1);
    assert.equal(rows[0].loginAt?.toISOString(), now.toISOString());
    assert.equal(rows[0].browser, 'Edge'); assert.equal(rows[0].device, 'Mac');
    assert.ok(!JSON.stringify(rows).includes(token)); assert.ok(!JSON.stringify(rows).includes('private-string'));
    assert.equal(rows[0].sessionHash.length, 64);
    // Another browser with the same UA does not inherit the first session's notification subscription.
    const subscription = await db.workdayPushSubscription.create({ data: { userId: user.id, endpoint: `https://push.invalid/${marker}`, p256dh: 'local', auth: 'local', userAgent: input.userAgent } });
    // The first push observation is allowed immediately after login; subsequent ones are throttled.
    const after = new Date(now.getTime() + 1000);
    await recordPortalAccess({ ...input, now: after, push: { permission: 'granted', endpoint: subscription.endpoint } });
    let saved = await db.portalAccessSession.findUniqueOrThrow({ where: { id: rows[0].id } });
    assert.equal(saved.pushState, 'connected'); assert.equal(saved.pushSubscriptionId, subscription.id);
    const token2 = createSessionToken(user.id, now.getTime() + 1);
    await recordPortalAccess({ ...input, token: token2, now: after, push: { permission: 'granted' } });
    const discovered = await db.portalAccessSession.findUniqueOrThrow({ where: { sessionHash: accessSessionIdentity(token2, user.id, after).sessionHash } });
    assert.equal(discovered.loginAt, null); assert.equal(discovered.pushState, 'not_connected');
    assert.equal(discovered.pushSubscriptionId, null);
    await db.workdayPushSubscription.update({ where: { id: subscription.id }, data: { userId: other.id } });
    const after2 = new Date(after.getTime() + 61000);
    await recordPortalAccess({ ...input, now: after2, push: { permission: 'granted', endpoint: subscription.endpoint } });
    saved = await db.portalAccessSession.findUniqueOrThrow({ where: { id: rows[0].id } });
    assert.equal(saved.pushState, 'not_connected'); assert.equal(saved.pushSubscriptionId, null);
    // Throttled observations cannot hammer lastSeen or fabricate a fresh login.
    await recordPortalAccess({ ...input, now: new Date(after2.getTime() + 1000), push: { permission: 'denied' } });
    assert.equal((await db.portalAccessSession.findUniqueOrThrow({ where: { id: saved.id } })).lastSeenAt.toISOString(), after2.toISOString());
    await recordPortalLogout(token, user.id);
    await recordPortalAccess({ ...input, now: new Date(after2.getTime() + 120000) });
    assert.ok((await db.portalAccessSession.findUniqueOrThrow({ where: { id: saved.id } })).loggedOutAt);
    assert.equal(await db.portalAccessSession.count({ where: { userId: user.id } }), 2);
  } finally {
    await db.user.deleteMany({ where: { id: { in: [user.id, other.id] } } }); await db.$disconnect();
  }
});
