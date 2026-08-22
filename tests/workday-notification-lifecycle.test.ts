import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  filterActiveWorkdayNotifications,
  reconcileActiveWorkdayNotifications,
  workdayNotificationHref,
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
  assert.equal(workdayNotificationHref({ issueId: null, reviewId: null }), '/employee');
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
