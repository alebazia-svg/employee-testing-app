import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { decideWorkdayCloseException, updateActiveHandoverTask } from '../lib/workday-close-decision';
import { completedWithoutEncashment } from '../lib/workday-close-view';

// This suite writes fixtures: require a dedicated, explicitly named local DB.
const databaseUrl = process.env.WORKDAY_CLOSE_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('Set WORKDAY_CLOSE_TEST_DATABASE_URL to an isolated local close_decision_test database');
const parsed = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.pathname !== '/close_decision_test') {
  throw new Error('Refusing to run outside the isolated local close_decision_test database');
}
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const employees: number[] = [];
const admins: number[] = [];
test.after(async () => {
  await db.user.deleteMany({ where: { id: { in: employees } } });
  await db.user.deleteMany({ where: { id: { in: admins } } });
  await db.$disconnect();
});

async function fixture(reasonCode = 'kkm', withRun = true) {
  const marker = randomUUID();
  const admin = await db.user.create({ data: { login: `close-admin-${marker}`, name: 'Тест администратор', role: 'ADMIN', passwordHash: 'unused' } });
  admins.push(admin.id);
  const employee = await db.user.create({ data: { login: `close-employee-${marker}`, name: 'Тест сотрудник', role: 'EMPLOYEE', passwordHash: 'unused' } });
  employees.push(employee.id);
  const workDay = await db.workDayEntry.create({ data: { userId: employee.id, date: '2026-10-16', department: 'retail', shiftCode: 'full', shiftLabel: 'Полная', comment: 'Исходная запись' } });
  const otherDay = await db.workDayEntry.create({ data: { userId: employee.id, date: '2026-10-17', department: 'retail', shiftCode: 'full', shiftLabel: 'Полная' } });
  const run = withRun ? await db.shiftControlRun.create({ data: {
    workDayEntryId: workDay.id, userId: employee.id, date: workDay.date, department: 'retail',
    tasks: { create: [
      { title: 'Открытие', category: 'opening', sortOrder: 1, status: 'done', completedAt: new Date('2026-10-16T06:00:00Z') },
      { title: 'Проверка', category: 'closing', sortOrder: 2, comment: 'Чек не распечатался' },
      { title: 'Сдача', category: 'handover', sortOrder: 3, handoverData: { draft: true, personalCash: { cashBalance: 75000 }, photos: { zReport: { storagePath: 'test/photo.jpg' } } } },
    ] },
  }, include: { tasks: true } }) : null;
  const issue = await db.workdayControlIssue.create({ data: {
    userId: employee.id, taskId: run?.tasks[1].id, fingerprint: marker, ruleKey: 'kkm_shift_not_closed', severity: 'critical',
    title: 'Касса не закрыта', detail: 'Нет подтверждения', originDate: workDay.date, employeeActionRequired: true,
  } });
  const request = await db.workdayCloseExceptionRequest.create({ data: {
    workDayEntryId: workDay.id, employeeId: employee.id, reasonCode, comment: 'Не могу закрыть', issueIds: reasonCode.startsWith('cash_') ? [] : [issue.id],
  } });
  if (run) await db.workdayNotification.create({ data: { userId: employee.id, taskId: run.tasks[1].id, fingerprint: `task-${marker}`, kind: 'task_due', title: 'Проверка', body: '', scheduledAt: new Date() } });
  const decide = (status: 'approved' | 'rejected' = 'approved') => decideWorkdayCloseException(db, { requestId: request.id, adminId: admin.id, status, decisionComment: 'Решение администратора' });
  return { admin, employee, workDay, otherDay, run, issue, request, decide };
}

test('approval closes on the server without any employee call, preserving facts and unresolved problems', async () => {
  const f = await fixture();
  const result = await f.decide();
  assert.equal(result?.changed, true);
  const day = await db.workDayEntry.findUniqueOrThrow({ where: { id: f.workDay.id } });
  assert.equal(day.status, 'completed');
  assert.equal(day.endedAt?.toISOString(), result?.request.decidedAt?.toISOString());
  assert.equal(result?.request.consumedAt?.toISOString(), day.endedAt?.toISOString());
  assert.match(day.comment, /Исходная запись/);
  const run = await db.shiftControlRun.findUniqueOrThrow({ where: { id: f.run!.id }, include: { tasks: { orderBy: { sortOrder: 'asc' } } } });
  assert.equal(run.status, 'completed');
  assert.equal(run.submittedAt, null);
  assert.deepEqual(run.tasks.map((task) => task.status), ['done', 'missed', 'missed']);
  assert.equal(run.tasks[1].comment, 'Чек не распечатался');
  assert.equal(run.tasks[2].completedAt, null);
  const draft = run.tasks[2].handoverData as any;
  assert.equal(draft.draft, true);
  assert.equal(draft.personalCash.cashBalance, 75000);
  assert.equal(draft.photos.zReport.storagePath, 'test/photo.jpg');
  assert.equal(draft.adminClosure.requestId, f.request.id);
  assert.equal((await db.workdayControlIssue.findUniqueOrThrow({ where: { id: f.issue.id } })).status, 'open');
  assert.equal((await db.workDayEntry.findUniqueOrThrow({ where: { id: f.otherDay.id } })).status, 'active');
  assert.equal(await db.cashOperation.count({ where: { userId: f.employee.id } }), 0);
  assert.equal((await db.workdayNotification.findFirstOrThrow({ where: { taskId: run.tasks[1].id } })).status, 'cancelled');
  assert.equal(await db.workdayNotification.count({ where: { userId: f.employee.id, kind: 'workday_closed_by_admin' } }), 1);
});

test('approval without encashment retains the exception and never creates financial documents', async () => {
  const f = await fixture('cash_encashment_safe_access');
  await f.decide();
  const handover = await db.shiftControlTask.findUniqueOrThrow({ where: { id: f.run!.tasks[2].id } });
  assert.equal(completedWithoutEncashment(handover), true);
  assert.equal(await db.cashOperation.count({ where: { userId: f.employee.id } }), 0);
  assert.equal((await db.workdayCloseExceptionRequest.findUniqueOrThrow({ where: { id: f.request.id } })).status, 'approved');
});

test('rejection leaves the workday, tasks and problems active', async () => {
  const f = await fixture();
  const result = await f.decide('rejected');
  assert.equal(result?.request.consumedAt, null);
  assert.equal((await db.workDayEntry.findUniqueOrThrow({ where: { id: f.workDay.id } })).endedAt, null);
  assert.equal((await db.shiftControlTask.findUniqueOrThrow({ where: { id: f.run!.tasks[2].id } })).status, 'pending');
});

test('parallel and repeated decisions are idempotent', async () => {
  const f = await fixture();
  const results = await Promise.all([f.decide(), f.decide()]);
  assert.equal(results.filter((result) => result?.changed).length, 1);
  const before = await db.workDayEntry.findUniqueOrThrow({ where: { id: f.workDay.id } });
  assert.equal((await f.decide('rejected'))?.changed, false);
  assert.deepEqual(await db.workDayEntry.findUniqueOrThrow({ where: { id: f.workDay.id } }), before);
  assert.equal(await db.workdayNotification.count({ where: { userId: f.employee.id, kind: 'workday_closed_by_admin' } }), 1);
});

test('already completed workday keeps its original end time and handover', async () => {
  const f = await fixture();
  const endedAt = new Date('2026-10-16T14:00:00Z');
  await db.workDayEntry.update({ where: { id: f.workDay.id }, data: { status: 'completed', endedAt } });
  await f.decide();
  assert.deepEqual((await db.workDayEntry.findUniqueOrThrow({ where: { id: f.workDay.id } })).endedAt, endedAt);
  assert.equal(await db.workdayNotification.count({ where: { userId: f.employee.id, kind: 'workday_closed_by_admin' } }), 0);
});

test('failed notification rolls back approval, workday and task changes together', async () => {
  const f = await fixture();
  await db.workdayNotification.create({ data: { userId: f.employee.id, fingerprint: `workday-close-exception:${f.request.id}:approved`, kind: 'test_conflict', title: '', body: '', scheduledAt: new Date() } });
  await assert.rejects(f.decide());
  assert.equal((await db.workdayCloseExceptionRequest.findUniqueOrThrow({ where: { id: f.request.id } })).status, 'pending');
  assert.equal((await db.workDayEntry.findUniqueOrThrow({ where: { id: f.workDay.id } })).endedAt, null);
  assert.equal((await db.shiftControlTask.findUniqueOrThrow({ where: { id: f.run!.tasks[2].id } })).status, 'pending');
});

test('workday without checklist closes and a missing request does not mutate anything', async () => {
  const f = await fixture('internet', false);
  await f.decide();
  assert.equal((await db.workDayEntry.findUniqueOrThrow({ where: { id: f.workDay.id } })).status, 'completed');
  assert.equal(await decideWorkdayCloseException(db, { requestId: 'absent', adminId: f.admin.id, status: 'approved', decisionComment: '' }), null);
});

test('late phone draft cannot overwrite the server closure audit', async () => {
  const f = await fixture();
  const taskId = f.run!.tasks[2].id;
  await f.decide();
  const before = await db.shiftControlTask.findUniqueOrThrow({ where: { id: taskId } });
  assert.equal(await updateActiveHandoverTask(db, { taskId, workDayEntryId: f.workDay.id, data: { handoverData: { draft: true } } }), null);
  assert.deepEqual(await db.shiftControlTask.findUniqueOrThrow({ where: { id: taskId } }), before);
});

test('two different pending requests for one shift cannot close it twice', async () => {
  const f = await fixture();
  const other = await db.workdayCloseExceptionRequest.create({ data: {
    workDayEntryId: f.workDay.id, employeeId: f.employee.id, reasonCode: 'cash_encashment_safe_access', comment: 'Нет доступа', issueIds: [],
  } });
  await Promise.all([
    f.decide(),
    decideWorkdayCloseException(db, { requestId: other.id, adminId: f.admin.id, status: 'approved', decisionComment: '' }),
  ]);
  const day = await db.workDayEntry.findUniqueOrThrow({ where: { id: f.workDay.id } });
  const requests = await db.workdayCloseExceptionRequest.findMany({ where: { workDayEntryId: day.id } });
  assert.ok(day.endedAt);
  assert.ok(requests.every((item) => item.consumedAt?.getTime() === day.endedAt!.getTime()));
  assert.equal(await db.workdayNotification.count({ where: { userId: f.employee.id, kind: 'workday_closed_by_admin' } }), 1);
});

test('missing-checkout shift can close, but an already resolved request cannot grant permission', async () => {
  const f = await fixture();
  await db.workDayEntry.update({ where: { id: f.workDay.id }, data: { status: 'missing_checkout' } });
  await f.decide();
  assert.equal((await db.workDayEntry.findUniqueOrThrow({ where: { id: f.workDay.id } })).status, 'completed');
  const resolved = await fixture();
  await db.workdayCloseExceptionRequest.update({ where: { id: resolved.request.id }, data: { status: 'resolved' } });
  assert.equal((await resolved.decide())?.changed, false);
  assert.equal((await db.workDayEntry.findUniqueOrThrow({ where: { id: resolved.workDay.id } })).endedAt, null);
});

test('a stale handover snapshot cannot overwrite a newer employee response', async () => {
  const f = await fixture();
  const task = await db.shiftControlTask.findFirstOrThrow({ where: { runId: f.run!.id, category: 'handover' } });
  const newerData = { personalCash: { cashBalance: 17702 }, kkmCloseConfirmation: { method: 'not_printed', userId: f.employee.id, confirmedAt: new Date().toISOString() } };
  await db.shiftControlTask.update({ where: { id: task.id }, data: { handoverData: newerData } });
  const result = await updateActiveHandoverTask(db, {
    taskId: task.id, workDayEntryId: f.workDay.id,
    expectedUpdatedAt: task.updatedAt, expectedHandoverData: task.handoverData,
    data: { handoverData: { personalCash: { cashBalance: 1 } } },
  });
  assert.equal(result, null);
  assert.deepEqual((await db.shiftControlTask.findUniqueOrThrow({ where: { id: task.id } })).handoverData, newerData);
});
