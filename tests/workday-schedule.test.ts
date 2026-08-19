import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildScheduleMonthRange,
  isValidScheduleDateKey,
  isValidScheduleMonthKey,
  scheduleMonthKeyFromDate,
} from '../lib/workday-schedule';

test('builds the complete Monday-to-Sunday grid for a six-row month', () => {
  const range = buildScheduleMonthRange('2026-08');
  assert.ok(range);
  assert.equal(range.from, '2026-07-27');
  assert.equal(range.to, '2026-09-06');
  assert.equal(range.dates.length, 42);
});

test('builds the complete grid for a five-row month', () => {
  const range = buildScheduleMonthRange('2026-02');
  assert.ok(range);
  assert.equal(range.from, '2026-01-26');
  assert.equal(range.to, '2026-03-01');
  assert.equal(range.dates.length, 35);
});

test('rejects impossible date and month keys', () => {
  assert.equal(isValidScheduleMonthKey('2026-13'), false);
  assert.equal(isValidScheduleMonthKey('2026-08'), true);
  assert.equal(isValidScheduleDateKey('2026-02-29'), false);
  assert.equal(isValidScheduleDateKey('2028-02-29'), true);
  assert.equal(scheduleMonthKeyFromDate('2026-08-19'), '2026-08');
  assert.equal(scheduleMonthKeyFromDate('2026-02-30'), null);
});
