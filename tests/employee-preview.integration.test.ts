import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient, type SupplierPaymentPlan, type SupplierPaymentReceipt } from '@prisma/client';
import { createSessionToken } from '../lib/session';
const databaseUrl = process.env.PASSWORD_ACCESS_TEST_DATABASE_URL;
const base = process.env.PASSWORD_ACCESS_TEST_ORIGIN;

test('real HTTP preview is admin-bound, read-only, expiring and independent of employee login', { skip: !databaseUrl || !base }, async () => {
  const url = new URL(databaseUrl!);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55449'); assert.equal(url.pathname, '/password_access_preview_20261019'); assert.equal(base, 'http://127.0.0.1:3197');
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
  const marker = `preview-qa-${randomUUID()}`;
  const users: number[] = [];
  const create = async (role: string, suffix: string) => { const u = await db.user.create({ data: { name: marker + suffix, login: marker + suffix, role, department: 'wholesale', passwordHash: 'unchanged-test-hash' } }); users.push(u.id); return u; };
  const admin = await create('ADMIN', '-admin'), otherAdmin = await create('ADMIN', '-other'), employee = await create('EMPLOYEE', '-employee');
  const token = createSessionToken(admin.id), otherToken = createSessionToken(otherAdmin.id), employeeToken = createSessionToken(employee.id);
  const req = (path: string, credential?: string, method = 'GET', origin = base!) => fetch(base + path, { method, redirect: 'manual', headers: { ...(credential ? { cookie: `offonika_session=${credential}` } : {}), 'content-type': 'application/json', origin }, ...(method === 'POST' ? { body: '{}' } : {}) });
  try {
    const day = await db.workDayEntry.create({ data: { userId: employee.id, date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date()), department: 'wholesale', shiftCode: '09_18', shiftLabel: '09:00–18:00' } });
    const run = await db.shiftControlRun.create({ data: { userId: employee.id, workDayEntryId: day.id, department: 'wholesale', date: day.date, tasks: { create: [{ title: 'Проверить рабочее место', category: 'opening', sortOrder: 1 }] } }, include: { tasks: true } });
    const notification = await db.workdayNotification.create({ data: { userId: employee.id, taskId: run.tasks[0].id, fingerprint: marker, kind: 'planned', title: 'Проверить рабочее место', body: 'Тестовое уведомление', status: 'sent', scheduledAt: new Date(), sentAt: new Date() } });
    // Stale rows normally reconciled by the employee GET must also remain untouched.
    const stale = await db.workdayNotification.create({ data: { userId: employee.id, fingerprint: marker+'stale', kind: 'cash_operation_created', title: 'Старая запись', body: '', status: 'sent', scheduledAt: new Date(), sentAt: new Date() } });
    const path = `/api/admin/employees/${employee.id}/preview`;
    assert.equal((await req(path, undefined, 'POST')).status, 401);
    assert.equal((await req(path, employeeToken, 'POST')).status, 403);
    assert.equal((await req(path, token, 'POST', 'https://outside.example')).status, 403);
    const before = { user: await db.user.findUnique({ where: { id: employee.id } }), day: await db.workDayEntry.findUnique({ where: { id: day.id } }), task: await db.shiftControlTask.findUnique({ where: { id: run.tasks[0].id } }), notices: await db.workdayNotification.findMany({ where: { id: { in: [notification.id, stale.id] } }, orderBy: { id: 'asc' } }), push: await db.workdayPushSubscription.count(), cash: await db.cashOperation.count() };
    const opened = await req(path, token, 'POST'); assert.equal(opened.status, 200); assert.equal(opened.headers.get('set-cookie'), null); assert.match(opened.headers.get('cache-control')!, /no-store/);
    const { href } = await opened.json(); const visitId = href.split('/').at(-1);
    const visit = await db.employeePreviewVisit.findUniqueOrThrow({ where: { id: visitId } });
    assert.equal(visit.adminId, admin.id); assert.equal(visit.employeeId, employee.id);
    const data = `/api/admin/employees/preview/${visitId}`;
    assert.equal((await req(href, token)).status, 200);
    assert.equal((await req(data+'?resource=notifications')).status, 401);
    assert.equal((await req(data+'?resource=notifications', employeeToken)).status, 403);
    assert.equal((await req(data+'?resource=notifications', otherToken)).status, 410);
    for (const resource of ['today', 'notifications', 'attention', 'schedule', 'change-shift']) {
      const response = await req(data+'?resource='+resource, token); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control')!, /no-store/);
      const payload = await response.json();
      if (resource === 'notifications') { assert.equal(payload.notifications.length, 1); assert.equal(payload.notifications[0].id, notification.id); }
      assert.equal((await req(data+'?resource='+resource, token, 'POST')).status, 405);
    }
    assert.equal((await req(data+'?resource=../password', token)).status, 400);
    assert.equal((await req(data+'?resource=schedule&month=bad', token)).status, 400);
    assert.equal((await req('/api/admin/employees', token)).status, 200);
    assert.deepEqual(await db.user.findUnique({ where: { id: employee.id } }), before.user);
    assert.deepEqual(await db.workDayEntry.findUnique({ where: { id: day.id } }), before.day);
    assert.deepEqual(await db.shiftControlTask.findUnique({ where: { id: run.tasks[0].id } }), before.task);
    assert.deepEqual(await db.workdayNotification.findMany({ where: { id: { in: [notification.id, stale.id] } }, orderBy: { id: 'asc' } }), before.notices);
    assert.equal(await db.workdayPushSubscription.count(), before.push); assert.equal(await db.cashOperation.count(), before.cash);
    await db.user.update({ where: { id: employee.id }, data: { isActive: false } });
    assert.equal((await req(data+'?resource=today', token)).status, 410);
    assert.equal((await req(path, token, 'POST')).status, 409);
    await db.user.update({ where: { id: employee.id }, data: { isActive: true } });
    await db.employeePreviewVisit.update({ where: { id: visitId }, data: { expiresAt: new Date(0) } });
    assert.equal((await req(data+'?resource=today', token)).status, 410);
    assert.match(await (await req(href, token)).text(), /Просмотр завершён/);
    // A visit id alone is never accepted as an employee login cookie.
    assert.equal((await req('/api/employee/workday-notifications', visitId)).status, 401);
  } finally { await db.employeePreviewVisit.deleteMany({ where: { adminId: { in: users } } }); await db.user.deleteMany({ where: { id: { in: users } } }); await db.$disconnect(); }
});

test('procurement inspection scopes plans and receipt bytes and leaves saved business data unchanged', { skip: !databaseUrl || !base }, async () => {
  const url = new URL(databaseUrl!);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55449'); assert.equal(url.pathname, '/password_access_preview_20261019'); assert.equal(base, 'http://127.0.0.1:3197');
  const { mkdir, writeFile, unlink } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
  const marker = `procurement-preview-qa-${randomUUID()}`;
  const users: number[] = [], plans: string[] = [], files: string[] = [];
  const create = async (role: string, suffix: string, portalArea = 'PROCUREMENT') => {
    const u = await db.user.create({ data: { name: marker + suffix, login: marker + suffix, role, portalArea, department: 'procurement', passwordHash: 'unchanged-test-hash' } }); users.push(u.id); return u;
  };
  const admin = await create('ADMIN', '-admin'), buyer = await create('EMPLOYEE', '-buyer'), other = await create('EMPLOYEE', '-other'), workday = await create('EMPLOYEE', '-workday', 'WORKDAY');
  const token = createSessionToken(admin.id);
  const req = (path: string, method = 'GET') => fetch(base + path, { method, redirect: 'manual', headers: { cookie: `offonika_session=${token}`, 'content-type': 'application/json', origin: base! }, ...(method === 'POST' ? { body: '{}' } : {}) });
  try {
    const fixtures: Array<{plan: SupplierPaymentPlan; receipt: SupplierPaymentReceipt; bytes: Buffer}> = [];
    for (const owner of [buyer, other]) {
      const plan = await db.supplierPaymentPlan.create({ data: { planCode: marker + owner.id, managerUserId: owner.id, supplierPartner: marker + '-supplier-' + owner.id, orderRefs: [], orderNumbers: [], plannedDate: new Date(), plannedAmount: 1000, condition: 'test', paymentMethod: 'CASH' } }); plans.push(plan.id);
      const storageKey = randomUUID() + '.png', bytes = Buffer.from('isolated-preview-file-' + owner.id);
      const root = join(process.cwd(), 'uploads', 'procurement-receipts'); await mkdir(root, { recursive: true });
      const path = join(root, storageKey); files.push(path); await writeFile(path, bytes, { flag: 'wx' });
      const receipt = await db.supplierPaymentReceipt.create({ data: { planId: plan.id, authorUserId: owner.id, originalName: 'fixture.png', storageKey, mimeType: 'image/png', size: bytes.length, sha256: randomUUID() } });
      fixtures.push({ plan, receipt, bytes });
    }
    const notice = await db.workdayNotification.create({ data: { userId: buyer.id, fingerprint: marker, kind: 'demo_preview_notice', title: 'Test procurement notification', body: 'unchanged', status: 'sent', scheduledAt: new Date(), sentAt: new Date() } });
    const snapshot = async () => ({ users: await db.user.findMany({ where: { id: { in: users } }, orderBy: { id: 'asc' } }), plans: await db.supplierPaymentPlan.findMany({ where: { id: { in: plans } }, orderBy: { id: 'asc' } }), receipts: await db.supplierPaymentReceipt.findMany({ where: { planId: { in: plans } }, orderBy: { id: 'asc' } }), notice: await db.workdayNotification.findUnique({ where: { id: notice.id } }), events: await db.supplierPaymentPlanEvent.count({ where: { planId: { in: plans } } }), push: await db.workdayPushSubscription.count() });
    const paymentNotice = await db.workdayNotification.create({ data: { userId: buyer.id, fingerprint: `procurement-payment:${plans[0]}:approved:${marker}`, kind: 'procurement_payment_approved', title: 'Own payment', body: '', status: 'pending', scheduledAt: new Date() } });
    const otherNotice = await db.workdayNotification.create({ data: { userId: other.id, fingerprint: `procurement-payment:${plans[1]}:approved:${marker}`, kind: 'procurement_payment_approved', title: 'Other payment', body: '', status: 'pending', scheduledAt: new Date() } });
    const before = await snapshot();
    const opened = await req(`/api/admin/employees/${buyer.id}/preview`, 'POST'); assert.equal(opened.status, 200); assert.equal(opened.headers.get('set-cookie'), null);
    const { href } = await opened.json(), data = '/api' + href;
    const page = await req(href); assert.equal(page.status, 200);
    const html = await page.text(); assert.ok(html.includes(fixtures[0].plan.supplierPartner)); assert.ok(!html.includes(fixtures[1].plan.supplierPartner));
    const record = await req(data + '?resource=notification-detail&notification=' + paymentNotice.id);
    assert.equal(record.status, 200); assert.equal((await record.json()).plan.id, plans[0]);
    assert.equal((await req(data + '?resource=notification-detail&notification=' + otherNotice.id)).status, 404);
    assert.equal((await req(data + '?resource=notification-detail&notification=' + paymentNotice.id, 'POST')).status, 405);
    assert.equal((await db.workdayNotification.findUniqueOrThrow({where:{id:paymentNotice.id}})).readAt, null);
    const list = await req(data + '?resource=receipts&' + plans.map(id => 'plan=' + id).join('&') + '&userId=' + other.id);
    assert.equal(list.status, 200); assert.deepEqual((await list.json()).receipts.map((r: { id: string }) => r.id), [fixtures[0].receipt.id]);
    const filePath = (i: number) => data + `?resource=receipt-file&plan=${fixtures[i].plan.id}&receipt=${fixtures[i].receipt.id}`;
    const file = await req(filePath(0)); assert.equal(file.status, 200); assert.deepEqual(Buffer.from(await file.arrayBuffer()), fixtures[0].bytes); assert.match(file.headers.get('cache-control')!, /no-store/); assert.match(file.headers.get('content-security-policy')!, /sandbox/);
    assert.equal((await req(filePath(1))).status, 404);
    assert.equal((await req(data + `?resource=receipt-file&plan=${plans[0]}&receipt=${fixtures[1].receipt.id}`)).status, 404);
    for (const resource of ['today', 'attention', 'schedule', 'cash-issue', 'change-shift']) assert.equal((await req(data + '?resource=' + resource)).status, 400);
    assert.equal((await req(data + '?resource=receipts')).status, 400);
    assert.equal((await req(data + '?resource=delivery')).status, 403);
    const notifications = await req(data + '?resource=notifications'); assert.equal(notifications.status, 200); assert.equal((await notifications.json()).notifications[0].id, notice.id);
    for (const resource of ['receipts', 'receipt-file', 'delivery', 'notifications']) assert.equal((await req(data + '?resource=' + resource, 'POST')).status, 405);
    const workdayVisit = await (await req(`/api/admin/employees/${workday.id}/preview`, 'POST')).json();
    assert.equal((await req('/api' + workdayVisit.href + '?resource=receipts&plan=' + plans[0])).status, 400);
    assert.deepEqual(await snapshot(), before);
  } finally {
    await db.employeePreviewVisit.deleteMany({ where: { adminId: { in: users } } });
    await db.supplierPaymentReceipt.deleteMany({ where: { planId: { in: plans } } });
    await db.supplierPaymentPlan.deleteMany({ where: { id: { in: plans } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await Promise.all(files.map(path => unlink(path))); await db.$disconnect();
  }
});
