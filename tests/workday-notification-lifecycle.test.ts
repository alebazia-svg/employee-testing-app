import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  filterActiveWorkdayNotifications,
  reconcileActiveWorkdayNotifications,
  workdayTaskNotificationCopy,
  workdayNotificationHref,
  scheduleTaskNotifications,
} from '../lib/workday-notifications';

const baseNotification = {
  kind: 'workday_close_exception_decision',
  taskId: null,
  issueId: null,
  reviewId: null,
  task: null,
  issue: null,
  review: null,
};

test('handover reminders stop after task completion or run closure', async () => {
  const rows = ['planned', 'overdue', 'overdue_repeat', 'early_finish_reminder'].flatMap((kind, index) =>
    ['pending', 'done', 'missed'].flatMap((status, state) => ['active', 'completed'].map((runStatus, runIndex) => ({
      ...baseNotification, id: index * 10 + state * 2 + runIndex,
      kind, fingerprint: `handover:${index}:${state}:${runIndex}`, taskId: 7,
      task: { status, run: { status: runStatus } },
    }))),
  );
  const active = await filterActiveWorkdayNotifications({} as never, rows);
  assert.equal(active.length, 4);
  assert.ok(active.every(row => row.task.status === 'pending' && row.task.run.status === 'active'));
});

test('ordinary handover has exactly three reminder slots, fifteen minutes apart', async () => {
  const rows: Array<{ scheduledAt: Date }> = [];
  const db = { workdayNotification: { upsert: async (args: { create: { scheduledAt: Date } }) => { rows.push(args.create); } } };
  await scheduleTaskNotifications(db as never, [{
    id: 7, userId: 2, category: 'handover', title: 'Сдать смену',
    plannedTimeMinutes: 1080, run: { date: '2026-09-03' },
  }]);
  assert.deepEqual(rows.map(row => row.scheduledAt.toISOString()), [
    '2026-09-03T15:00:00.000Z', '2026-09-03T15:15:00.000Z', '2026-09-03T15:30:00.000Z',
  ]);
});

test('close-exception decisions disappear when the workday is completed', async () => {
  const rows = [{
    ...baseNotification,
    id: 1,
    fingerprint: 'workday-close-exception:req-1:approved',
  }];
  const db = {
    workdayCloseExceptionRequest: {
      findMany: async (args: { where: Record<string, unknown> }) => (
        'id' in args.where
          ? [{
              id: 'req-1',
              workDayEntryId: 10,
              status: 'approved',
              reasonCode: 'required_issue_unavailable',
              consumedAt: new Date(),
              workDayEntry: { status: 'completed', endedAt: new Date() },
            }]
          : [{ id: 'req-1', workDayEntryId: 10, status: 'approved', reasonCode: 'required_issue_unavailable' }]
      ),
    },
  };

  assert.deepEqual(await filterActiveWorkdayNotifications(db as never, rows), []);
});

test('only the latest decision in the same workday scope stays visible', async () => {
  const rows = [
    { ...baseNotification, id: 1, fingerprint: 'workday-close-exception:req-1:approved' },
    { ...baseNotification, id: 2, fingerprint: 'workday-close-exception:req-2:approved' },
  ];
  const activeWorkday = { status: 'active', endedAt: null };
  const db = {
    workdayCloseExceptionRequest: {
      findMany: async (args: { where: Record<string, unknown> }) => (
        'id' in args.where
          ? [
              { id: 'req-1', workDayEntryId: 10, status: 'approved', reasonCode: 'required_issue_unavailable', consumedAt: null, workDayEntry: activeWorkday },
              { id: 'req-2', workDayEntryId: 10, status: 'approved', reasonCode: 'required_issue_unavailable', consumedAt: null, workDayEntry: activeWorkday },
            ]
          : [
              { id: 'req-2', workDayEntryId: 10, status: 'approved', reasonCode: 'required_issue_unavailable' },
              { id: 'req-1', workDayEntryId: 10, status: 'approved', reasonCode: 'required_issue_unavailable' },
            ]
      ),
    },
  };

  assert.deepEqual((await filterActiveWorkdayNotifications(db as never, rows)).map((row) => row.id), [2]);
});

test('successful cash operations do not appear as employee attention notifications', async () => {
  const rows = [{
    ...baseNotification,
    id: 3,
    kind: 'cash_operation_created',
    fingerprint: 'cash-operation:3:admin:1',
  }];
  const db = { workdayCloseExceptionRequest: { findMany: async () => [] } };

  assert.deepEqual(await filterActiveWorkdayNotifications(db as never, rows), []);
});

test('inactive sent notifications are cancelled without marking them as read', async () => {
  const updates: Array<Record<string, unknown>> = [];
  const rows = [
    {
      ...baseNotification,
      id: 4,
      kind: 'issue_detected',
      fingerprint: 'issue:4:detected',
      issueId: 4,
      issue: { status: 'open', employeeActionRequired: true },
    },
    {
      ...baseNotification,
      id: 5,
      kind: 'issue_detected',
      fingerprint: 'issue:5:detected',
      issueId: 5,
      issue: { status: 'resolved', employeeActionRequired: false },
    },
  ];
  const db = {
    workdayCloseExceptionRequest: { findMany: async () => [] },
    workdayNotification: {
      updateMany: async (args: Record<string, unknown>) => {
        updates.push(args);
        return { count: 1 };
      },
    },
  };

  assert.deepEqual((await reconcileActiveWorkdayNotifications(db as never, rows)).map((row) => row.id), [4]);
  assert.deepEqual(updates, [{
    where: { id: { in: [5] }, status: 'sent', readAt: null },
    data: { status: 'cancelled' },
  }]);
});

test('notification links open the exact employee action target', () => {
  assert.equal(workdayNotificationHref({ issueId: 12, reviewId: null }), '/employee/issues/12');
  assert.equal(workdayNotificationHref({ issueId: null, reviewId: 'review-7' }), '/employee/payment-checks/review-7');
  assert.equal(workdayNotificationHref({
    issueId: null,
    reviewId: null,
    kind: 'schedule_replacement_request',
    fingerprint: 'schedule-coverage:retail:2026-09-05:17',
  }), '/employee?tab=schedule&date=2026-09-05');
  assert.equal(workdayNotificationHref({
    issueId: null,
    reviewId: null,
    kind: 'schedule_replacement_digest',
    fingerprint: 'schedule-coverage-digest:retail:2026-09:17:22',
  }), '/employee?tab=schedule&date=2026-09-01');
  assert.equal(workdayNotificationHref({ issueId: null, reviewId: null }), '/employee');
});

test('task reminders are neutral, concise and distinguish cashbox acceptance', () => {
  assert.deepEqual(workdayTaskNotificationCopy({ category: 'handover', title: 'Сдать смену' }, 'early_finish_reminder'), {
    title: 'Завершите рабочий день',
    body: 'Продолжите сдачу смены.',
  });
  assert.deepEqual(workdayTaskNotificationCopy({ category: 'cash', title: 'Принять кассу: пересчитать наличные' }, 'planned'), {
    title: 'Примите кассу',
    body: 'Пересчитайте наличные и внесите остаток.',
  });
  assert.deepEqual(workdayTaskNotificationCopy({ category: 'cash', title: 'Пересчитать наличные в середине смены' }, 'overdue'), {
    title: 'Пересчитайте кассу',
    body: 'Задание просрочено. Внесите фактический остаток.',
  });
  assert.deepEqual(workdayTaskNotificationCopy({ category: 'handover', title: 'Сдать смену' }, 'overdue_repeat'), {
    title: 'Сдайте смену',
    body: 'Задание просрочено. Выполните итоговые действия.',
  });
});

test('production timer dispatches due employee notifications every minute', () => {
  const service = readFileSync('ops/systemd/offonika-workday-notifications.service', 'utf8');
  const timer = readFileSync('ops/systemd/offonika-workday-notifications.timer', 'utf8');
  const dispatcher = readFileSync('scripts/dispatch-workday-notifications.ts', 'utf8');

  assert.match(service, /scripts\/dispatch-workday-notifications\.ts/);
  assert.match(service, /\/usr\/bin\/flock/);
  assert.match(timer, /OnCalendar=\*-\*-\* \*:\*:00 Europe\/Moscow/);
  assert.match(timer, /Unit=offonika-workday-notifications\.service/);
  assert.match(dispatcher, /process\.argv\.includes\('--inspect'\)/);
  assert.match(dispatcher, /applied: false/);
});
