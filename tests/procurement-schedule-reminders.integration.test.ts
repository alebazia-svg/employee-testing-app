import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../lib/prisma';
import { queueScheduleFillQuestions } from '../lib/schedule-coverage-reconciliation';
import { activeScheduleNotices } from '../lib/work-schedule-notifications';
import { loadEmployeeScheduleAttention } from '../lib/employee-schedule-attention';
import { loadEmployeeNotifications } from '../lib/employee-notification-snapshot';
import { persistEmployeeScheduleChange } from '../lib/work-schedule-persistence';
import { getMoscowDateKey } from '../lib/workday';
import { scheduleNearDates, SCHEDULE_NEAR_KIND } from '../lib/schedule-near-reminder';
import { procurementWorkdayEntry } from '../lib/procurement-mobile-navigation';

test('both Procurement cabinets share daily reminder, live completion and no-repeat lifecycle', {
  skip: process.env.PROCUREMENT_SCHEDULE_REMINDER_TEST !== '1',
}, async () => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '55481');
  assert.equal(url.pathname, '/procurement_schedule_test_20261104');
  assert.equal(await prisma.user.count(), 0, 'Use the empty dedicated test database');
  assert.equal(await prisma.workdayPushSubscription.count(), 0, 'No real device subscriptions');
  const today = getMoscowDateKey(), tomorrow = scheduleNearDates(today)[1];
  const now = new Date(`${today}T08:31:00+03:00`);
  const people = [];
  try {
    for (const portalArea of ['PROCUREMENT', 'WORKDAY']) people.push(await prisma.user.create({
      data: { name: `Учебный закупщик ${portalArea}`, login: `schedule-proof-${portalArea}`, role: 'EMPLOYEE', department: 'procurement', portalArea, passwordHash: 'disabled' },
    }));
    const inactive = await prisma.user.create({ data: { name: 'Отключён', login: 'schedule-proof-inactive', role: 'EMPLOYEE', department: 'procurement', isActive: false, passwordHash: 'disabled' } });
    const admin = await prisma.user.create({ data: { name: 'Администратор', login: 'schedule-proof-admin', role: 'ADMIN', department: 'procurement', passwordHash: 'disabled' } });

    await queueScheduleFillQuestions(prisma, new Date(`${today}T08:29:00+03:00`));
    assert.equal(await prisma.workdayNotification.count(), 0, 'Existing 08:30 worker window stays');
    for (let i = 0; i < 3; i++) assert.equal((await queueScheduleFillQuestions(prisma, now)).failed, 0);
    assert.equal(await prisma.workdayNotification.count(), 2, 'One personal notice per active employee');
    assert.equal(await prisma.adminInboxEvent.count(), 0, 'No staffing events for Procurement');
    for (const user of [inactive, admin]) assert.deepEqual(await loadEmployeeScheduleAttention(user.id), []);

    for (const user of people) {
      const notice = await prisma.workdayNotification.findUniqueOrThrow({ where: { fingerprint: `schedule-near:procurement:${today}:${user.id}` } });
      assert.equal(notice.kind, SCHEDULE_NEAR_KIND);
      let items = await loadEmployeeScheduleAttention(user.id);
      assert.equal(items.length, 1);
      assert.equal(items[0].status, 'Сегодня и завтра не заполнены');
      assert.equal(items[0].scheduleOpenEditor, false);
      await prisma.workdayNotification.update({ where: { id: notice.id }, data: { status: 'sent', sentAt: now, pushStatus: 'delivered', pushDeliveredAt: now, attemptCount: 1, readAt: now } });
      assert.equal((await loadEmployeeScheduleAttention(user.id)).length, 1, 'Reading is not completion');

      // The same persistence path is used by direct calendar and ADMIN edits.
      await prisma.$transaction(tx => persistEmployeeScheduleChange(tx, {
        user, date: today, status: 'working', previousStatus: null,
        departmentEntries: [], source: 'employee',
      }));
      items = await loadEmployeeScheduleAttention(user.id);
      assert.equal(items[0].status, 'Завтра не заполнен');
      assert.equal(items[0].scheduleOpenEditor, true);
      const bell = (await loadEmployeeNotifications(user, true)).notifications.find(n => n.id === notice.id)!;
      assert.equal(bell.active, true);
      assert.equal(bell.href, `/employee?tab=schedule&date=${tomorrow}&edit=1`);
      if (user.portalArea === 'PROCUREMENT') assert.equal(procurementWorkdayEntry(Object.fromEntries(new URL(bell.href, 'https://local.invalid').searchParams)), `/procurement?tab=schedule&date=${tomorrow}&edit=1`);
      await prisma.$transaction(tx => persistEmployeeScheduleChange(tx, {
        user, date: tomorrow, status: 'off', previousStatus: null,
        departmentEntries: [], source: 'employee',
      }));
      assert.deepEqual(await loadEmployeeScheduleAttention(user.id), []);
      assert.equal((await activeScheduleNotices(prisma, [notice], today)).size, 0, 'Bell/push retire before next worker');
      assert.equal((await loadEmployeeNotifications(user, true)).notifications.find(n => n.id === notice.id)?.active, false);
      await queueScheduleFillQuestions(prisma, new Date(+now + 60_000));
      const saved = await prisma.workdayNotification.findUniqueOrThrow({ where: { id: notice.id } });
      assert.equal(saved.status, 'resolved');
      assert.equal(saved.pushStatus, 'cancelled');
      assert.equal(saved.nextPushAttemptAt, null);
      assert.equal(+saved.pushDeliveredAt!, +now, 'Original delivery evidence remains');

      // Reopening the same day must not send a second successful push.
      await prisma.workScheduleEntry.delete({ where: { userId_date: { userId: user.id, date: tomorrow } } });
      await queueScheduleFillQuestions(prisma, new Date(+now + 120_000));
      const reopened = await prisma.workdayNotification.findUniqueOrThrow({ where: { id: notice.id } });
      assert.equal(reopened.status, 'sent');
      assert.equal(reopened.pushStatus, 'cancelled');
      assert.equal(reopened.nextPushAttemptAt, null);
      assert.equal(reopened.attemptCount, 1);
      await prisma.employeeVacation.create({ data: { userId: user.id, department: 'procurement', dateFrom: tomorrow, dateTo: tomorrow, status: 'active', createdById: user.id, updatedById: user.id } });
      assert.deepEqual(await loadEmployeeScheduleAttention(user.id), [], 'Vacation covers the date');
    }
    await queueScheduleFillQuestions(prisma, new Date(`${tomorrow}T08:31:00+03:00`));
    for (const user of people) {
      const next = await prisma.workdayNotification.findUniqueOrThrow({ where: { fingerprint: `schedule-near:procurement:${tomorrow}:${user.id}` } });
      assert.match(next.body, /Завтра не заполнен/);
      assert.equal(next.status, 'pending');
    }
    assert.equal(await prisma.adminInboxEvent.count(), 0);
    assert.equal(await prisma.workdayNotification.count({ where: { kind: { not: SCHEDULE_NEAR_KIND } } }), 0, 'No colleague replacement notices');
  } finally {
    await prisma.employeeVacation.deleteMany({ where: { userId: { in: people.map(user => user.id) } } });
    await prisma.user.deleteMany({ where: { login: { startsWith: 'schedule-proof-' } } });
    await prisma.$disconnect();
  }
});
