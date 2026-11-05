import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { accessHistoryFilters, accessHistoryWhere } from '../lib/portal-access-search';

const url = 'postgresql://postgres:access-demo-local-only@127.0.0.1:55504/access_demo';
test('isolated PostgreSQL: labels/codes are searched across all pages, dates use the selected field, history retains inactive/expired records', { skip: process.env.ACCESS_RECENT_TEST_DB !== url }, async () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const marker = `access-history-${crypto.randomUUID()}`, code = crypto.randomUUID();
  const users: number[] = [];
  try {
    const admin = await db.user.create({ data: { name: marker, login: marker, passwordHash: 'no-login', role: 'ADMIN' } }); users.push(admin.id);
    const employee = await db.user.create({ data: { name: marker, login: `${marker}-employee`, passwordHash: 'no-login', role: 'EMPLOYEE', isActive: false } }); users.push(employee.id);
    await db.portalAccessBrowserOwner.create({ data: { browserInstanceId: code, ownerUserId: admin.id, label: `Mac ${marker}` } });
    await db.portalAccessSession.createMany({ data: Array.from({ length: 55 }, (_, i) => ({
      userId: i % 2 ? employee.id : admin.id, browserInstanceId: code, sessionHash: `${marker}-${i}`, device: 'Mac', browser: 'Chrome',
      firstSeenAt: new Date(Date.UTC(2026, 9, 1, 0, i)), loginAt: new Date('2026-10-01T08:00:00Z'),
      lastSeenAt: new Date(i % 2 ? '2026-11-04T20:59:59Z' : '2026-11-04T21:00:00Z'), expiresAt: new Date('2026-10-31T00:00:00Z'),
    })) });
    const names = await db.portalAccessBrowserOwner.findMany({ where: { label: { contains: marker, mode: 'insensitive' }, disabledAt: null, owner: { role: 'ADMIN', isActive: true } }, select: { browserInstanceId: true } });
    const where = accessHistoryWhere(`Mac ${marker}`, names.map(n => n.browserInstanceId), accessHistoryFilters({}));
    const first = await db.portalAccessSession.findMany({ where, orderBy: [{ firstSeenAt: 'desc' }, { id: 'desc' }], take: 51 });
    assert.equal(first.length, 51);
    assert.equal((await db.portalAccessSession.findMany({ where, skip: 50, take: 51, orderBy: [{ firstSeenAt: 'desc' }, { id: 'desc' }] })).length, 5);
    assert.equal(await db.portalAccessSession.count({ where: accessHistoryWhere(code, [], accessHistoryFilters({})) }), 55);
    const contact = accessHistoryWhere(code, [], accessHistoryFilters({ from: '2026-11-04', to: '2026-11-04' }));
    assert.equal(await db.portalAccessSession.count({ where: contact }), 27); // Up to 23:59:59 Moscow, includes inactive employee.
    const logins = accessHistoryWhere(code, [], accessHistoryFilters({ from: '2026-11-04', to: '2026-11-04', dateField: 'login' }));
    assert.equal(await db.portalAccessSession.count({ where: logins }), 0);
    const changed = await db.portalAccessBrowserOwner.findUniqueOrThrow({ where: { browserInstanceId: code } });
    assert.equal(changed.label, `Mac ${marker}`);
    assert.equal(changed.disabledAt, null);
  } finally {
    await db.portalAccessBrowserOwner.deleteMany({ where: { browserInstanceId: code } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
});
