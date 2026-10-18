import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { mocked } from './portal-access-routes.test';
import { withMockDb } from './access-telemetry.test';
import { createSessionToken } from '../lib/session';
import { accessIsAdministrative } from '../lib/portal-access-view';

const url = 'postgresql://postgres:access-local-test-only@127.0.0.1:55451/access_telemetry_verified';
test('real DB/page: admin device labels follow employee inspections; employee devices and shared-PC override stay separate', { skip: process.env.ACCESS_TELEMETRY_TEST_DB !== url }, async () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const marker = `page-connections-${crypto.randomUUID()}`, users: number[] = [];
  process.env.PORTAL_SESSION_SECRET = 'isolated-connection-page-test-secret-at-least-32';
  try {
    const admin = await db.user.create({ data: { name: marker, login: marker, role: 'ADMIN', passwordHash: 'not-login' } }); users.push(admin.id);
    const employee = await db.user.create({ data: { name: marker, login: `${marker}-employee`, role: 'EMPLOYEE', passwordHash: 'not-login' } }); users.push(employee.id);
    const journal = await withMockDb('lib/portal-access-journal.ts', db);
    const now = new Date(), shared = crypto.randomUUID(), own = crypto.randomUUID();
    for (const [userId, browserInstanceId, offset] of [[admin.id, shared, 0], [employee.id, shared, 1000], [employee.id, own, 2000]] as const) {
      await journal.recordPortalAccess({ userId, token: createSessionToken(userId, now.getTime() + offset), browserInstanceId, userAgent: 'Windows Chrome', now: new Date(now.getTime() + offset), login: true });
    }
    let browserCookie: string | undefined = shared;
    const page = await mocked('app/(dashboard)/admin/employees/access/page.tsx', {
      'next/headers': { cookies: async () => ({ get: (name: string) => name === 'mobo_access_browser' && browserCookie ? { value: browserCookie } : undefined }) },
      'next/link': () => null, 'next/navigation': { redirect: () => { throw Error('unexpected redirect'); } },
      'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
      '@/lib/auth': { getCurrentUser: async () => admin }, '@/lib/prisma': { prisma: db },
      '@/components/AdminShell': { AdminShell: () => null }, '@/components/PortalAccessDevices': { PortalAccessDevices: () => null },
    });
    const read = async () => {
      const result = await page.default({ searchParams: Promise.resolve({}) });
      const walk = (node: any): any[] => !node ? [] : Array.isArray(node) ? node.flatMap(walk) : node.props?.rows ? node.props.rows : walk(node.props?.children);
      return walk(result).filter((r: any) => [admin.login, employee.login].includes(r.login));
    };
    let rows = await read();
    assert.equal(rows.length, 3);
    assert.equal(rows.filter(accessIsAdministrative).length, 2);
    assert.equal(rows.find(r => r.browserInstanceId === own).adminObserved, false);
    assert.equal(rows.filter(r => r.isCurrentBrowser).length, 2);
    assert.equal(rows.find(r => r.browserInstanceId === own).isCurrentBrowser, false);
    browserCookie = undefined;
    assert.equal((await read()).some(r => r.isCurrentBrowser), false);
    browserCookie = own;
    assert.deepEqual((await read()).filter(r => r.isCurrentBrowser).map(r => r.browserInstanceId), [own]);
    browserCookie = shared;
    // First seen only under an employee: ADMIN can assign it without an ADMIN
    // login on that device. Later ADMIN login retains the same named identity.
    const ownerRoute = await mocked('app/api/admin/employees/access/owner/route.ts', { '@/lib/auth': { getCurrentAdmin: async () => admin }, '@/lib/prisma': { prisma: db } });
    const firstEmployee = rows.find(r => r.browserInstanceId === own);
    const classify = (owned: boolean) => ownerRoute.POST(new Request('https://portal.invalid/owner', { method: 'POST', headers: { 'sec-fetch-site': 'same-origin' }, body: JSON.stringify({ sessionId: firstEmployee.id, owned, label: 'Mac Аслана' }) }));
    const before = await db.portalAccessSession.findUniqueOrThrow({ where: { id: firstEmployee.id } });
    assert.equal((await classify(true)).status, 200);
    let assigned = (await read()).find(r => r.id === firstEmployee.id);
    assert.equal(assigned.connectionLabel, 'Mac Аслана');
    assert.equal(assigned.ownerInspection, true);
    assert.equal(accessIsAdministrative(assigned), true);
    assert.deepEqual(await db.portalAccessSession.findUniqueOrThrow({ where: { id: firstEmployee.id } }), before);
    await journal.recordPortalAccess({ userId: admin.id, token: createSessionToken(admin.id, now.getTime() + 3000), browserInstanceId: own, userAgent: 'Mac Chrome', now: new Date(now.getTime() + 3000), login: true });
    assert.equal((await read()).filter(r => r.connectionLabel === 'Mac Аслана').length, 2);
    assert.equal((await classify(false)).status, 200);
    // Clean only this test's additional generated session; remaining assertions
    // exercise the original shared-PC fixture.
    await db.portalAccessSession.deleteMany({ where: { userId: admin.id, browserInstanceId: own } });
    await db.portalAccessBrowserOwner.create({ data: { browserInstanceId: shared, ownerUserId: admin.id, label: 'Аслан · компьютер' } });
    rows = await read();
    assert.equal(rows.filter(r => r.connectionLabel === 'Аслан · компьютер').length, 2);
    const inspection = rows.find(r => r.login === employee.login && r.browserInstanceId === shared);
    assert.equal(inspection.ownerInspection, true);
    assert.equal(inspection.canMarkOwner, true);
    await db.portalAccessBrowserOwner.update({ where: { browserInstanceId: shared }, data: { disabledAt: now } });
    const service = await mocked('app/api/admin/employees/access/service/route.ts', { '@/lib/auth': { getCurrentAdmin: async () => admin }, '@/lib/prisma': { prisma: db } });
    assert.equal((await service.POST(new Request('https://portal.invalid/service', { method: 'POST', headers: { 'sec-fetch-site': 'same-origin' }, body: JSON.stringify({ sessionId: inspection.id, isService: false }) }))).status, 200);
    rows = await read();
    assert.equal(rows.filter(r => !accessIsAdministrative(r)).length, 2);
    assert.equal(rows.find(r => r.login === admin.login).role, 'ADMIN');
    assert.ok(rows.every(r => !r.connectionLabel));
  } finally { await db.user.deleteMany({ where: { id: { in: users } } }); await db.$disconnect(); }
});
