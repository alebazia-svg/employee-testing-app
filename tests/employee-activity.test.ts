import test from 'node:test';
import assert from 'node:assert/strict';
import { parseActivityInput, activityDayBounds, activityRoute } from '../lib/employee-activity-policy';
test('only bounded known events accepted; actor and clock cannot be supplied by client', () => {
  assert.ok(parseActivityInput({ key: 'test-key-1', kind: 'visit', section: 'schedule' }));
  assert.equal(parseActivityInput({ key: 'test-key-1', kind: 'visit', section: 'schedule', userId: 9 }), null);
  assert.equal(parseActivityInput({ key: 'test-key-1', kind: 'visit', section: '__proto__' }), null);
  assert.equal(parseActivityInput({ key: 'test-key-1', kind: 'visit', section: 'day', createdAt: '2026-01-01' }), null);
  assert.equal(parseActivityInput({ key: 'test-key-1', kind: 'notification_open', notificationId: -1 }), null);
  assert.equal(parseActivityInput({ key: 'x'.repeat(81), kind: 'visit', section: 'day' }), null);
});
test('Moscow date boundaries are exact and reject invalid calendar dates', () => {
  assert.equal(activityDayBounds('2026-10-24')?.start.toISOString(), '2026-10-23T21:00:00.000Z');
  assert.equal(activityDayBounds('2026-02-30'), null);
  assert.equal(activityDayBounds(''), null);
  assert.equal(activityRoute('/admin/employees/preview/123'), null);
  assert.equal(activityRoute('/employee'), null);
  assert.equal(activityRoute('/employee/payroll'), 'payroll');
});
