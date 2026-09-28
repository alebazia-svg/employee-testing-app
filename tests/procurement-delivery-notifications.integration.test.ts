import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

test('isolated PostgreSQL: one deferred delivery row, atomic claim and cancellation preserve history', { skip: !process.env.PROCUREMENT_TEST_DATABASE_URL }, async () => {
  assert.equal(process.env.PROCUREMENT_TEST_DATABASE_URL, 'postgresql://postgres:local-test-only@127.0.0.1:55437/delivery_integration_20260927');
  const db = new PrismaClient({ datasources: { db: { url: process.env.PROCUREMENT_TEST_DATABASE_URL } } });
  const marker = `delivery-push-${crypto.randomUUID()}`;
  const user = await db.user.create({ data: { name: marker, login: marker, passwordHash: 'not-login', role: 'EMPLOYEE', portalArea: 'PROCUREMENT' } });
  try {
    const now = new Date('2026-09-28T23:00:00Z');
    const mocks: Record<string, any> = {
      './prisma': { prisma: db },
      './procurement-delivery-reminders': { deliveryMappedUser: async () => user, loadDeliveryView: async () => ({ requestStateAvailable: true, nativeRequest: { state: 'linked', status: {
        ref: 'ed241171-bb79-11f1-8f11-002590803daf', state: 'payable', remaining: 15000, cashbox: 'Local test', checkedAt: now.toISOString(),
      } } }) },
    };
    const output = await build({ entryPoints: ['lib/procurement-delivery-notifications.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'isolated', setup(b) {
      b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, external: true } : undefined);
    } }] });
    const module = { exports: {} as any }; const require = createRequire(import.meta.url);
    new Function('require', 'module', 'exports', output.outputFiles[0].text)((name: string) => mocks[name] ?? require(name), module, module.exports);
    await Promise.all([module.exports.queueDeliveryReadyPush(now), module.exports.queueDeliveryReadyPush(now)]);
    const rows = await db.workdayNotification.findMany({ where: { userId: user.id } }); assert.equal(rows.length, 1);
    const row = rows[0]; assert.equal(row.status, 'pending'); assert.equal(row.sentAt, null);
    assert.equal(row.scheduledAt.toISOString(), '2026-09-29T05:30:00.000Z');
    const claim = () => db.workdayNotification.updateMany({ where: { id: row.id, updatedAt: row.updatedAt, status: row.status, pushStatus: row.pushStatus, readAt: null }, data: { pushStatus: 'delivery_sending', nextPushAttemptAt: new Date(now.getTime() + 600000) } });
    const attempts = await Promise.all([claim(), claim()]); assert.deepEqual(attempts.map(r => r.count).sort(), [0, 1]);
    await db.workdayNotification.update({ where: { id: row.id }, data: { status: 'cancelled', pushStatus: 'cancelled', nextPushAttemptAt: null } });
    await module.exports.queueDeliveryReadyPush(now);
    const cancelled = await db.workdayNotification.findUniqueOrThrow({ where: { id: row.id } });
    assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.readAt, null);
    assert.equal(await db.workdayNotification.count({ where: { userId: user.id } }), 1);
  } finally {
    await db.workdayNotification.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } }); await db.$disconnect();
  }
});
