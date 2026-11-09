import assert from 'node:assert/strict';
import test from 'node:test';
import { isOwnerInspectionBrowser, isOwnerInspectionSubscription, ownerInspectionBrowserMap, withoutOwnerInspectionSubscriptions } from '../lib/push-owner-inspection';

const owners = ownerInspectionBrowserMap([{ browserInstanceId: 'owner-phone', ownerUserId: 1 }]);

test('an owner phone that inspected an employee is excluded from that employee\'s pushes', () => {
  const own = { userId: 3, accessSessions: [{ browserInstanceId: 'employee-phone' }] };
  const inspected = { userId: 3, accessSessions: [{ browserInstanceId: 'employee-phone' }, { browserInstanceId: 'owner-phone' }] };
  assert.equal(isOwnerInspectionSubscription(own, owners), false);
  assert.equal(isOwnerInspectionSubscription(inspected, owners), true);
  assert.deepEqual(withoutOwnerInspectionSubscriptions([own, inspected], owners), [own]);
});

test('the owner\'s own subscription, empty sessions and missing browser ids are never excluded', () => {
  assert.equal(isOwnerInspectionSubscription({ userId: 1, accessSessions: [{ browserInstanceId: 'owner-phone' }] }, owners), false);
  assert.equal(isOwnerInspectionSubscription({ userId: 3, accessSessions: [] }, owners), false);
  assert.equal(isOwnerInspectionSubscription({ userId: 3 }, owners), false);
  assert.equal(isOwnerInspectionSubscription({ userId: 3, accessSessions: [{ browserInstanceId: null }] }, owners), false);
});

test('subscribing from the owner phone as another user is refused, but not as the owner or from other phones', () => {
  assert.equal(isOwnerInspectionBrowser('owner-phone', 3, owners), true);
  assert.equal(isOwnerInspectionBrowser('owner-phone', 1, owners), false);
  assert.equal(isOwnerInspectionBrowser('employee-phone', 3, owners), false);
  assert.equal(isOwnerInspectionBrowser(undefined, 3, owners), false);
});
