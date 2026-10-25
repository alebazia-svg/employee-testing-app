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

test('handover audit rejects forged server results, identities, arbitrary error text and excessive duration', () => {
  const input = {key:'handover-key',kind:'handover',context:{taskId:1,attemptId:'attempt-123',stage:'waiting'}};
  assert.ok(parseActivityInput(input));
  for (const context of [
    {...input.context,stage:'check_confirmed'},
    {...input.context,taskId:-1},
    {...input.context,employeeId:3},
    {...input.context,message:'secret form values'},
    {...input.context,stage:'waiting_end',durationMs:21600001},
    {...input.context,stage:'waiting_end',durationMs:-1},
  ]) assert.equal(parseActivityInput({...input,context}),null);
  assert.equal(parseActivityInput({...input,kind:'handover_check'}),null);
  assert.ok(parseActivityInput({...input,context:{...input.context,stage:'waiting_end',durationMs:40000}}));
});
