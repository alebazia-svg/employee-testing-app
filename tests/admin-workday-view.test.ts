import assert from 'node:assert/strict';
import test from 'node:test';
import { adminWorkdayControlFilter, isActiveWorkdayTimingViolation, matchesAdminWorkdayControlFilter, resolveAdminWorkdayControlCategory } from '../lib/admin-workday-view';

test('today defaults to active exceptions while historical dates can default to all', () => {
  assert.equal(adminWorkdayControlFilter(undefined, 'active'), 'active');
  assert.equal(adminWorkdayControlFilter(undefined, 'all'), 'all');
  assert.equal(adminWorkdayControlFilter('normal', 'active'), 'normal');
  assert.equal(adminWorkdayControlFilter('invalid', 'active'), 'active');
});

test('active filter includes errors and attention but hides pending and normal rows', () => {
  assert.equal(matchesAdminWorkdayControlFilter('error', 'active'), true);
  assert.equal(matchesAdminWorkdayControlFilter('attention', 'active'), true);
  assert.equal(matchesAdminWorkdayControlFilter('pending', 'active'), false);
  assert.equal(matchesAdminWorkdayControlFilter('normal', 'active'), false);
});

test('historical lateness is not presented as an active action', () => {
  assert.equal(isActiveWorkdayTimingViolation('late_start'), false);
  assert.equal(isActiveWorkdayTimingViolation('early_checkout'), false);
  assert.equal(isActiveWorkdayTimingViolation('task_late'), false);
  assert.equal(isActiveWorkdayTimingViolation('task_overdue'), true);
  assert.equal(isActiveWorkdayTimingViolation('missing_checkout'), true);
});

test('an active required issue always makes the employee row an error', () => {
  assert.equal(resolveAdminWorkdayControlCategory({
    hasError: true,
    needsAttention: true,
    cannotVerify: true,
    isPending: true,
  }), 'error');
});

test('attention, pending and normal states keep their priority after errors', () => {
  assert.equal(resolveAdminWorkdayControlCategory({ hasError: false, needsAttention: true, cannotVerify: false, isPending: true }), 'attention');
  assert.equal(resolveAdminWorkdayControlCategory({ hasError: false, needsAttention: false, cannotVerify: true, isPending: true }), 'attention');
  assert.equal(resolveAdminWorkdayControlCategory({ hasError: false, needsAttention: false, cannotVerify: false, isPending: true }), 'pending');
  assert.equal(resolveAdminWorkdayControlCategory({ hasError: false, needsAttention: false, cannotVerify: false, isPending: false }), 'normal');
});
