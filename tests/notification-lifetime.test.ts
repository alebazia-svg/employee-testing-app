import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPLOYEE_INFORMATIONAL_NOTIFICATION_KINDS, EMPLOYEE_ACTION_NOTIFICATION_KINDS, employeeNotificationRequiresAction, informationalNotificationExpired } from '../lib/notification-lifetime';
import { acknowledgeEmployeeNotification, employeeInboxSections } from '../lib/employee-inbox-view';

const sentAt = new Date('2026-11-07T08:00:00Z');
const before = new Date('2026-11-08T07:59:59.999Z');
const deadline = new Date('2026-11-08T08:00:00Z');

test('every explicitly informational kind expires at 24 hours, not at midnight', () => {
  for (const kind of EMPLOYEE_INFORMATIONAL_NOTIFICATION_KINDS) {
    assert.equal(informationalNotificationExpired({ kind, sentAt }, before), false, kind);
    assert.equal(informationalNotificationExpired({ kind, sentAt }, deadline), true, kind);
    assert.equal(informationalNotificationExpired({ kind, sentAt: sentAt.toISOString() }, deadline), true, kind);
  }
});

test('actions, unknown types, replies and unconfirmed payroll decisions never receive a guessed TTL', () => {
  const now = new Date('2027-01-01T00:00:00Z');
  for (const kind of [...EMPLOYEE_ACTION_NOTIFICATION_KINDS, 'issue_detected', 'terminal_fiscal_review', 'workday_issue_reply', 'future_notification']) {
    assert.equal(informationalNotificationExpired({ kind, sentAt }, now), false, kind);
  }
  assert.equal(informationalNotificationExpired({ kind: 'payroll_days_decision', fingerprint: 'payroll-days:request:approved', sentAt }, deadline), true);
  for (const suffix of ['rejected', 'needs_changes', 'unknown']) {
    assert.equal(informationalNotificationExpired({ kind: 'payroll_days_decision', fingerprint: `payroll-days:request:${suffix}`, sentAt }, deadline), false);
  }
});

test('source-linked actions override informational copy; missing/future publication dates do not expire', () => {
  for (const target of [{ taskId: 7 }, { issueId: 8 }, { reviewId: '9' }]) {
    const notice = { kind: 'procurement_payment_approved', sentAt, ...target };
    assert.equal(employeeNotificationRequiresAction(notice), true);
    assert.equal(informationalNotificationExpired(notice, deadline), false);
  }
  for (const date of [null, undefined, '', 'invalid', new Date('invalid'), new Date('2027-01-01')]) {
    assert.equal(informationalNotificationExpired({ kind: 'procurement_receipt_added', sentAt: date }, deadline), false);
  }
  assert.equal(employeeNotificationRequiresAction({ kind: 'workday_issue_reply', issueId: 7 }), false);
});

test('reading does not complete an action, and completion does not fabricate a read', () => {
  const action = { id: 1, kind: 'procurement_qr_check', active: true, actionRequired: true, readAt: null, sentAt: sentAt.toISOString() };
  const read = acknowledgeEmployeeNotification([action], action, deadline.toISOString());
  assert.equal(employeeInboxSections(read).fresh.length, 1);
  assert.equal(read[0].readAt, deadline.toISOString());
  assert.equal(employeeInboxSections([{ ...read[0], active: false, actionRequired: false }]).history.length, 1);
  const info = { ...action, id: 2, kind: 'procurement_receipt_added', actionRequired: false };
  const archived = { ...info, active: false };
  assert.equal(employeeInboxSections([archived]).history.length, 1);
  assert.equal(archived.readAt, null);
  assert.equal(employeeInboxSections(acknowledgeEmployeeNotification([info], info, deadline.toISOString())).history.length, 1);
});
