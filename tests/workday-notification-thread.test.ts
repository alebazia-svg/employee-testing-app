import assert from 'node:assert/strict';
import test from 'node:test';
import { workdayNotificationThreadKey, workdayNotificationThreadWhere } from '../lib/workday-notification-thread';

test('all replies and alerts for one issue share a thread', () => {
  assert.equal(workdayNotificationThreadKey({ id: 10, issueId: 7 }), 'issue:7');
  assert.equal(workdayNotificationThreadKey({ id: 11, issueId: 7 }), 'issue:7');
  assert.deepEqual(workdayNotificationThreadWhere({ id: 11, issueId: 7 }), { issueId: 7 });
});

test('review, task and standalone notifications keep separate threads', () => {
  assert.equal(workdayNotificationThreadKey({ id: 1, reviewId: 'r-1' }), 'review:r-1');
  assert.equal(workdayNotificationThreadKey({ id: 2, taskId: 9 }), 'task:9');
  assert.equal(workdayNotificationThreadKey({ id: 3 }), 'notification:3');
});
