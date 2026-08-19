import assert from 'node:assert/strict';
import test from 'node:test';
import { adminWorkdayControlFilter, isActiveWorkdayTimingViolation, matchesAdminWorkdayControlFilter } from '../lib/admin-workday-view';

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
