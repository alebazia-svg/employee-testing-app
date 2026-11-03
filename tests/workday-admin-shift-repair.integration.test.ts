import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { repairAdminWorkdayShift } from '../lib/workday-admin-shift-repair';
const url = new URL(process.env.DATABASE_URL ?? '');
if (url.hostname !== '127.0.0.1' || url.pathname !== '/workday_admin_repair_test') throw Error('Isolated DB required');
const db = new PrismaClient();
const now = new Date('2026-11-03T11:00:00Z');
const ids: number[] = [], templates: number[] = [];
test.after(async () => {
  const changes = await db.workdayShiftChange.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  await db.adminInboxEvent.deleteMany({ where: { sourceType: 'workday_shift_repair', sourceId: { in: changes.map(row => row.id) } } });
  await db.workDayEntry.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.shiftControlTemplate.deleteMany({ where: { id: { in: templates } } });
  await db.$disconnect();
});
async function fixture() {
  const marker = randomUUID();
  const admin = await db.user.create({ data: { login: `admin-${marker}`, name: 'Демо администратор', role: 'ADMIN', passwordHash: 'unused' } });
  const employee = await db.user.create({ data: { login: `employee-${marker}`, name: 'Демо Зухра', department: 'retail', role: 'EMPLOYEE', passwordHash: 'unused' } });
  ids.push(admin.id, employee.id);
  const previous = await db.shiftControlTemplate.aggregate({ where: { department: 'retail', shiftCode: '11_20' }, _max: { version: true } });
  const template = await db.shiftControlTemplate.create({ data: { name: marker, department: 'retail', shiftCode: '11_20', version: (previous._max.version ?? 0) + 1, tasks: { create: [
    { title: 'Принять кассу', category: 'cash', sortOrder: 10, plannedTimeMinutes: 660 },
    { title: 'Середина', category: 'cash', sortOrder: 40, plannedTimeMinutes: 930 },
    { title: 'Сдать смену', category: 'handover', sortOrder: 90, plannedTimeMinutes: 1200 },
  ] } } }); templates.push(template.id);
  const day = await db.workDayEntry.create({ data: { userId: employee.id, date: '2026-11-03', department: 'retail', shiftCode: '09_20', shiftLabel: '09:00-20:00', shiftStartMinutes: 540, shiftEndMinutes: 1200, startedAt: new Date('2026-11-03T07:56Z'), qrAcceptedAt: new Date('2026-11-03T07:56Z'), lateMinutes: 116, comment: 'Утром была Диана' } });
  const run = await db.shiftControlRun.create({ data: { workDayEntryId: day.id, userId: employee.id, department: 'retail', date: day.date, tasks: { create: [
    { title: 'Принять кассу', category: 'cash', sortOrder: 10, plannedTimeMinutes: 540, status: 'done', completedAt: new Date('2026-11-03T09:06Z'), numericValue: 25750, comment: 'Факт кассы' },
    { title: 'Середина', category: 'cash', sortOrder: 50, plannedTimeMinutes: 870, textValue: 'Черновик' },
    { title: 'Сдать смену', category: 'handover', sortOrder: 90, plannedTimeMinutes: 1200, handoverData: { cash: 100 } },
  ] } }, include: { tasks: { orderBy: { id: 'asc' } } } });
  const cash = await db.cashOperation.create({ data: { userId: employee.id, workDayEntryId: day.id, date: day.date, department: 'retail', direction: 'expense', amount: 7000, photoPath: '/demo', comment: 'Сохранить', idempotencyKey: marker } });
  const issue = await db.workdayControlIssue.create({ data: { userId: employee.id, taskId: run.tasks[0].id, fingerprint: marker, ruleKey: 'cash', severity: 'warning', title: 'Проверка кассы', detail: 'Сохранить' } });
  const review = await db.shiftControlManualReview.create({ data: { taskId: run.tasks[0].id, reviewedById: admin.id, checkId: 'cash', checkLabel: 'Касса', decision: 'accepted', comment: 'Сохранить' } });
  const reminder = await db.workdayNotification.create({ data: { userId: employee.id, taskId: run.tasks[1].id, fingerprint: marker, kind: 'planned', title: 'Середина', body: '', scheduledAt: new Date('2026-11-03T11:30Z') } });
  const sent = await db.workdayNotification.create({ data: { userId: employee.id, taskId: run.tasks[0].id, fingerprint: `sent-${marker}`, kind: 'planned', title: 'Начало', body: 'История', status: 'sent', scheduledAt: new Date('2026-11-03T06:00Z') } });
  const input = { adminId: admin.id, userId: employee.id, department: 'retail', date: day.date, toShiftCode: '11_20', now };
  return { admin, employee, day, run, cash, issue, review, reminder, sent, input };
}
test('admin correction preserves money, completed facts, drafts, reviews and IDs; updates lateness/deadlines atomically and is idempotent', async () => {
  const f = await fixture();
  await Promise.all([repairAdminWorkdayShift(db, f.input), repairAdminWorkdayShift(db, f.input)]);
  const day = await db.workDayEntry.findUniqueOrThrow({ where: { id: f.day.id } });
  assert.equal(day.shiftCode, '11_20'); assert.equal(day.lateMinutes, 0);
  for (const key of ['startedAt', 'qrAcceptedAt', 'endedAt', 'comment', 'status'] as const) assert.deepEqual(day[key], f.day[key]);
  const tasks = await db.shiftControlTask.findMany({ where: { runId: f.run.id }, orderBy: { id: 'asc' } });
  assert.equal(tasks.length, f.run.tasks.length);
  for (let i = 0; i < tasks.length; i++) {
    const { plannedTimeMinutes: _p1, updatedAt: _u1, ...after } = tasks[i];
    const { plannedTimeMinutes: _p2, updatedAt: _u2, ...before } = f.run.tasks[i];
    assert.deepEqual(after, before);
  }
  assert.deepEqual(tasks.map(t => t.plannedTimeMinutes), [660, 930, 1200]);
  assert.deepEqual(await db.cashOperation.findUnique({ where: { id: f.cash.id } }), f.cash);
  assert.deepEqual(await db.workdayControlIssue.findUnique({ where: { id: f.issue.id } }), f.issue);
  assert.deepEqual(await db.shiftControlManualReview.findUnique({ where: { id: f.review.id } }), f.review);
  assert.deepEqual(await db.workdayNotification.findUnique({ where: { id: f.sent.id } }), f.sent);
  assert.equal((await db.workdayNotification.findUniqueOrThrow({ where: { id: f.reminder.id } })).scheduledAt.toISOString(), '2026-11-03T12:30:00.000Z');
  assert.equal(await db.workdayShiftChange.count({ where: { workDayEntryId: f.day.id } }), 1);
  const change = await db.workdayShiftChange.findFirstOrThrow({ where: { workDayEntryId: f.day.id } });
  const audit = await db.adminInboxEvent.findFirstOrThrow({ where: { sourceType: 'workday_shift_repair', sourceId: change.id } });
  assert.ok(audit.body.includes(f.admin.name));
});
test('employee, completed day and incompatible checks are rejected without deleting or rewriting records', async () => {
  const f = await fixture();
  await assert.rejects(repairAdminWorkdayShift(db, { ...f.input, adminId: f.employee.id }), /Нет доступа/);
  await db.workDayEntry.update({ where: { id: f.day.id }, data: { endedAt: now, status: 'completed' } });
  await assert.rejects(repairAdminWorkdayShift(db, f.input), /Активный рабочий день/);
  await db.workDayEntry.update({ where: { id: f.day.id }, data: { endedAt: null, status: 'active' } });
  await db.shiftControlTask.update({ where: { id: f.run.tasks[1].id }, data: { title: 'Другой смысл' } });
  const before = await db.shiftControlTask.findMany({ where: { runId: f.run.id } });
  await assert.rejects(repairAdminWorkdayShift(db, f.input), /набор проверок/);
  assert.deepEqual(await db.shiftControlTask.findMany({ where: { runId: f.run.id } }), before);
  assert.equal((await db.workDayEntry.findUniqueOrThrow({ where: { id: f.day.id } })).shiftCode, '09_20');
  assert.equal(await db.workdayShiftChange.count({ where: { workDayEntryId: f.day.id } }), 0);
});
