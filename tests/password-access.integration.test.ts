import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID, createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { resetEmployeePassword } from '../lib/password-access';
import { createSessionToken, readSessionToken, sessionMatchesUser } from '../lib/session';

const databaseUrl = process.env.PASSWORD_ACCESS_TEST_DATABASE_URL;
const base = process.env.PASSWORD_ACCESS_TEST_ORIGIN;

test('isolated DB and HTTP: permanent access, targeted revocation and concurrent reset safety', { skip: !databaseUrl || !base }, async (t) => {
  const url = new URL(databaseUrl!);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '55449');
  assert.equal(url.pathname, '/password_access_preview_20261019');
  assert.equal(base, 'http://127.0.0.1:3197');
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
  const marker = `password-qa-${randomUUID()}`;
  const oldPassword = `old-${randomUUID()}`;
  const oldHash = await bcrypt.hash(oldPassword, 12);
  const ids: number[] = [];
  // Keep the local preview's fixed demo IDs clear of generated fixture IDs.
  await db.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"User"', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM "User"), 10000))`);
  const create = async (suffix: string, role = 'EMPLOYEE', isActive = true) => {
    const user = await db.user.create({ data: { name: `${marker}-${suffix}`, login: `${marker}-${suffix}`, role, isActive, passwordHash: oldHash } });
    ids.push(user.id); return user;
  };
  const admin = await create('admin', 'ADMIN');
  const employee = await create('employee');
  const other = await create('other');
  const inactive = await create('inactive', 'EMPLOYEE', false);
  const legacy = (id: number) => {
    const body = `v1.${id}.${Date.now() + 86400000}`;
    return `${body}.${createHmac('sha256', process.env.PORTAL_SESSION_SECRET!).update(body).digest('base64url')}`;
  };
  const adminToken = legacy(admin.id), oldEmployeeToken = legacy(employee.id), otherToken = legacy(other.id);
  const request = (path: string, token?: string, body?: unknown, extra: Record<string, string> = {}) => fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
    headers: { ...(token ? { cookie: `offonika_session=${token}` } : {}), ...(body !== undefined ? { 'content-type': 'application/json', origin: base! } : {}), ...extra },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const notifications = '/api/employee/workday-notifications';
  const resetPath = `/api/admin/employees/${employee.id}/password`;
  let issued: { password: string; sessionVersion: number };
  const beforeBusiness = [await db.workDayEntry.count(), await db.payrollRun.count()];
  try {
    await t.test('additive migration preserves existing password hashes and defaults sessions to version zero', async () => {
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('CREATE TEMP TABLE "User" (id INTEGER PRIMARY KEY, "passwordHash" TEXT NOT NULL) ON COMMIT DROP');
        await tx.$executeRawUnsafe(`INSERT INTO pg_temp."User" VALUES (1, 'unchanged-test-hash')`);
        const sql = readFileSync(new URL('../prisma/migrations/20261019110000_employee_password_access/migration.sql', import.meta.url), 'utf8');
        await tx.$executeRawUnsafe(sql);
        const rows = await tx.$queryRawUnsafe<Array<{ passwordHash: string; sessionVersion: number; passwordResetAt: Date | null; passwordResetById: number | null }>>('SELECT * FROM pg_temp."User"');
        assert.equal(rows[0].passwordHash, 'unchanged-test-hash');
        assert.equal(rows[0].sessionVersion, 0);
        assert.equal(rows[0].passwordResetAt, null);
        assert.equal(rows[0].passwordResetById, null);
      });
    });
    await t.test('existing signed sessions work before reset; anonymous and employee resets are rejected', async () => {
      assert.equal((await request('/api/admin/employees', adminToken)).status, 200);
      assert.equal((await request(notifications, oldEmployeeToken)).status, 200);
      assert.equal((await request(resetPath, undefined, { sessionVersion: 0 })).status, 401);
      assert.equal((await request(resetPath, oldEmployeeToken, { sessionVersion: 0 })).status, 403);
      assert.equal((await request(resetPath, adminToken, { sessionVersion: 0 }, { origin: 'https://outside.example' })).status, 403);
      assert.equal((await request(resetPath, adminToken, { sessionVersion: -1 })).status, 400);
      assert.equal((await request(`/api/admin/employees/${admin.id}/password`, adminToken, { sessionVersion: 0 })).status, 400);
      assert.equal((await request(`/api/admin/employees/${inactive.id}/password`, adminToken, { sessionVersion: 0 })).status, 400);
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: employee.id } })).sessionVersion, 0);
    });
    await t.test('reset returns an uncached permanent password; revokes only that employee', async () => {
      const response = await request(resetPath, adminToken, { sessionVersion: 0 });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
      const data = await response.json(); issued = data;
      assert.equal(typeof data.password, 'string');
      assert.ok(/^[abcdefghjkmnpqrstuvwxyz2-9]{10}$/.test(data.password));
      assert.equal('expiresAt' in data, false);
      assert.equal('temporaryPassword' in data, false);
      const user = await db.user.findUniqueOrThrow({ where: { id: employee.id } });
      assert.ok(await bcrypt.compare(issued.password, user.passwordHash), 'Only the bcrypt hash is stored');
      assert.ok(user.passwordHash !== issued.password);
      assert.equal(user.passwordResetById, admin.id);
      assert.equal(user.sessionVersion, 1);
      assert.equal((await request(notifications, oldEmployeeToken)).status, 401);
      assert.equal((await request(notifications, otherToken)).status, 200);
      assert.equal((await request('/api/admin/employees', adminToken)).status, 200);
      const oldLogin = await request('/api/auth/login', undefined, { login: employee.login, password: oldPassword });
      assert.equal(oldLogin.status, 401);
      const list = await request('/api/admin/employees', adminToken);
      const users = await list.json();
      assert.ok(users.every((row: Record<string, unknown>) => !('password' in row) && !('passwordHash' in row) && !('issuedAccess' in row)));
    });
    await t.test('new password opens employee APIs immediately, with no forced change or age limit', async () => {
      // Backdate issuance beyond 24h: login must still succeed.
      await db.user.update({ where: { id: employee.id }, data: { passwordResetAt: new Date('2020-01-01T00:00:00Z') } });
      const response = await request('/api/auth/login', undefined, { login: employee.login, password: issued.password });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal('passwordChangeRequired' in body, false);
      const token = response.headers.get('set-cookie')?.match(/offonika_session=([^;]+)/)?.[1];
      assert.ok(token, 'A full session is issued');
      assert.equal(readSessionToken(token)?.sessionVersion, 1);
      assert.equal((await request(notifications, token)).status, 200);
      const entry = await request('/employee', token);
      assert.ok(entry.status === 200 || (entry.status >= 300 && entry.status < 400));
      assert.ok(!/change-password|\/login/.test(entry.headers.get('location') ?? ''), 'No password-change redirect');
      assert.equal((await request(resetPath, adminToken, { sessionVersion: 0 })).status, 409);
      assert.equal((await request(notifications, token)).status, 200);
    });
    await t.test('concurrent resets yield one valid password and one conflict', async () => {
      const results = await Promise.allSettled([
        resetEmployeePassword(db, employee.id, admin.id, 1),
        resetEmployeePassword(db, employee.id, admin.id, 1),
      ]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      const failure = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
      assert.equal(failure.reason.status, 409);
      const winner = results.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof resetEmployeePassword>>>;
      const user = await db.user.findUniqueOrThrow({ where: { id: employee.id } });
      assert.equal(user.sessionVersion, 2);
      assert.ok(await bcrypt.compare(winner.value.password, user.passwordHash));
      assert.ok(!(await bcrypt.compare(issued.password, user.passwordHash)));
      const previous = readSessionToken(createSessionToken(user.id, Date.now(), { sessionVersion: 1 }))!;
      assert.equal(sessionMatchesUser(previous, user), false);
    });
    await t.test('new employee creation generates permanent credentials and profile edits preserve them', async () => {
      const response = await request('/api/admin/employees', adminToken, { name: `${marker}-new`, login: `${marker}-new`, role: 'EMPLOYEE', department: 'wholesale' });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
      const created = await response.json(); ids.push(created.id);
      assert.ok(/^[abcdefghjkmnpqrstuvwxyz2-9]{10}$/.test(created.issuedAccess.password));
      assert.equal('expiresAt' in created.issuedAccess, false);
      const before = await db.user.findUniqueOrThrow({ where: { id: created.id } });
      const patch = await fetch(`${base}/api/admin/employees/${created.id}`, {
        method: 'PATCH', headers: { cookie: `offonika_session=${adminToken}`, 'content-type': 'application/json', origin: base! },
        body: JSON.stringify({ name: `${marker}-edited`, login: created.login, role: 'EMPLOYEE', department: 'wholesale' }),
      });
      assert.equal(patch.status, 200);
      const after = await db.user.findUniqueOrThrow({ where: { id: created.id } });
      assert.ok(before.passwordHash === after.passwordHash);
      assert.equal(before.sessionVersion, after.sessionVersion);
      assert.equal((await request('/api/auth/login', undefined, { login: created.login, password: created.issuedAccess.password })).status, 200);
      assert.deepEqual([await db.workDayEntry.count(), await db.payrollRun.count()], beforeBusiness);
      const adminResponse = await request('/api/admin/employees', adminToken, { name: `${marker}-new-admin`, login: `${marker}-new-admin`, role: 'ADMIN' });
      assert.equal(adminResponse.status, 200);
      const createdAdmin = await adminResponse.json(); ids.push(createdAdmin.id);
      assert.ok(/^[A-Za-z2-9]{4}(?:-[A-Za-z2-9]{4}){3}$/.test(createdAdmin.issuedAccess.password));
      const resetAdmin = await request(`/api/admin/employees/${createdAdmin.id}/password`, adminToken, { sessionVersion: 0 });
      assert.equal(resetAdmin.status, 200);
      const adminAccess = await resetAdmin.json();
      assert.ok(/^[A-Za-z2-9]{4}(?:-[A-Za-z2-9]{4}){3}$/.test(adminAccess.password));
      const otherAfter = await db.user.findUniqueOrThrow({ where: { id: other.id } });
      assert.ok(otherAfter.passwordHash === oldHash);
      assert.equal(otherAfter.sessionVersion, 0);
    });
  } finally {
    await db.portalAccessSession.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});
