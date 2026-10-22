import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createSessionToken } from '../lib/session';
import { seedPreviewPayroll } from './employee-preview-payroll-fixture';
const databaseUrl = process.env.EMPLOYEE_PREVIEW_TEST_DATABASE_URL;
const base = process.env.EMPLOYEE_PREVIEW_TEST_ORIGIN;
test('salary preview equals the employee response; actor, feature, identity and write boundaries hold', { skip: !databaseUrl || !base }, async () => {
  const url = new URL(databaseUrl!);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55456'); assert.equal(url.pathname, '/employee_preview_salary');
  assert.equal(base, 'http://127.0.0.1:3322');
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
  const prefix = `preview-payroll-${randomUUID()}`;
  const users: number[] = [];
  const create = async (role: string, suffix: string, salary = 43210, portalArea = 'WORKDAY') => {
    const name = prefix + suffix;
    const user = await db.user.create({ data: { name, login: name, role, portalArea, department: 'retail', passwordHash: 'not-a-login', payrollName: name, payrollSalaryType: 'retail_sales_bonus', payrollFixedSalary: salary } }); users.push(user.id); return user;
  };
  const month = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date()).slice(0,7);
  let fixture: Awaited<ReturnType<typeof seedPreviewPayroll>> | undefined;
  const req = (path: string, token?: string, method = 'GET') => fetch(base + path, { redirect: 'manual', method, headers: { origin: base!, 'content-type': 'application/json', ...(token ? { cookie: `offonika_session=${token}` } : {}) }, ...(method === 'POST' ? { body: '{}' } : {}) });
  try {
    const admin = await create('ADMIN', '-admin'), other = await create('ADMIN', '-other'), employee = await create('EMPLOYEE', '-employee'), foreign = await create('EMPLOYEE', '-foreign', 98765), buyer = await create('EMPLOYEE', '-buyer', 98765, 'PROCUREMENT');
    fixture = await seedPreviewPayroll(db, employee.id, employee.name, month);
    const token = createSessionToken(admin.id), employeeToken = createSessionToken(employee.id);
    const opened = await req(`/api/admin/employees/${employee.id}/preview`, token, 'POST');
    assert.equal(opened.status, 200); assert.equal(opened.headers.get('set-cookie'), null);
    const { href } = await opened.json(); const visitId = href.split('/').at(-1); const api = '/api' + href;
    const snapshot = async () => JSON.stringify({ users: await db.user.findMany({ where: { id: { in: users } }, orderBy: { id: 'asc' } }), drafts: await db.payrollDraftRevision.findMany(), runs: await db.payrollRun.findMany(), attendance: await db.payrollAttendanceSnapshot.findMany(), sources: await db.payrollOneCControlSnapshot.findMany(), days: await db.workDayEntry.findMany(), notifications: await db.workdayNotification.findMany() });
    const before = await snapshot();
    const normal = await req(`/api/employee/payroll?month=${month}`, employeeToken);
    const inspected = await req(api + `?resource=payroll&month=${month}`, token);
    assert.equal(normal.status, 200); assert.equal(inspected.status, 200); assert.match(inspected.headers.get('cache-control')!, /no-store/);
    const result = await inspected.json(); assert.deepEqual(result, await normal.json());
    assert.equal(result.state, 'current_estimate'); assert.equal(result.estimatedAccrued, 10800);
    assert.ok(!JSON.stringify(result).includes(foreign.name)); assert.equal(result.savedAdvance, null);
    for (const tab of ['day', 'schedule', 'payroll']) {
      const response = await req(href + '?tab=' + tab, token); assert.equal(response.status, 200);
      const html = await response.text(); assert.ok(html.includes('Моя зарплата')); if (tab === 'payroll') assert.ok(!html.includes(foreign.name));
    }
    assert.equal((await req(api + '?resource=payroll')).status, 401);
    assert.equal((await req(api + '?resource=payroll', employeeToken)).status, 403);
    assert.equal((await req(api + '?resource=payroll', createSessionToken(other.id))).status, 410);
    for (const query of ['month=bad', `month=${month}&month=${month}`, `userId=${foreign.id}`, 'employee=foreign']) assert.equal((await req(api+'?resource=payroll&'+query, token)).status, 400);
    for (const method of ['POST','PUT','PATCH','DELETE']) assert.equal((await req(api+'?resource=payroll', token, method)).status, 405);
    const previous = await req(api + '?resource=payroll&month=2025-01', token); assert.deepEqual(await previous.json(), {month:'2025-01', state:'unavailable'});
    const buyerVisit = await (await req(`/api/admin/employees/${buyer.id}/preview`, token, 'POST')).json();
    assert.equal((await req('/api'+buyerVisit.href+'?resource=payroll', token)).status, 400);
    assert.equal(await snapshot(), before, 'inspection never writes business data');
    await db.user.update({where:{id:employee.id},data:{isActive:false}});
    assert.equal((await req(api+'?resource=payroll', token)).status,410);
    await db.user.update({where:{id:employee.id},data:{isActive:true}});
    await db.employeePreviewVisit.update({where:{id:visitId},data:{expiresAt:new Date(0)}});
    assert.equal((await req(api+'?resource=payroll', token)).status,410);
    assert.match(await (await req(href+'?tab=payroll',token)).text(),/Просмотр завершён/);
  } finally {
    if(fixture) {
      await db.payrollDraftRevision.delete({where:{id:fixture.draftId}});
      await db.payrollAttendanceSnapshot.delete({where:{id:fixture.attendanceId}});
      await db.payrollOneCControlSnapshot.delete({where:{id:fixture.sourceId}});
    }
    await db.employeePreviewVisit.deleteMany({where:{adminId:{in:users}}});
    await db.user.deleteMany({where:{id:{in:users}}}); await db.$disconnect();
  }
});

// The shared response boundary is also used by the normal employee route.
test('disabled payroll cannot be opened through the inspection reader', async () => {
  const { employeePayrollResponse } = await import('../lib/employee-payroll-response');
  const previous = process.env.PAYROLL_EMPLOYEE_ENABLED;
  process.env.PAYROLL_EMPLOYEE_ENABLED = '0';
  try { assert.equal((await employeePayrollResponse({id: 1, role: 'EMPLOYEE', isActive: true, portalArea: 'WORKDAY'}, new URLSearchParams())).status, 404); }
  finally { if(previous === undefined) delete process.env.PAYROLL_EMPLOYEE_ENABLED; else process.env.PAYROLL_EMPLOYEE_ENABLED = previous; }
});
