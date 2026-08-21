import assert from 'node:assert/strict';
import test from 'node:test';
import { filterActiveWorkdayNotifications } from '../lib/workday-notifications';

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
