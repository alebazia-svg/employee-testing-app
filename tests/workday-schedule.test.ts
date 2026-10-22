import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildScheduleMonthRange,
  buildInitialScheduleRange,
  isValidScheduleDateKey,
  isValidScheduleMonthKey,
  scheduleMonthKeyFromDate,
} from '../lib/workday-schedule';

test('initial snapshot includes every calendar cell and all 31 upcoming dates', () => {
  for (const today of ['2026-10-23', '2026-11-30', '2026-12-31', '2027-01-01', '2028-02-29']) {
    const initial = buildInitialScheduleRange(today);
    const month = buildScheduleMonthRange(today.slice(0, 7))!;
    assert.equal(initial.monthKey, today.slice(0, 7));
    for (const date of month.dates) assert.ok(initial.dates.includes(date));
    const last = new Date(`${today}T00:00:00Z`);
    last.setUTCDate(last.getUTCDate() + 30);
    assert.ok(initial.dates.includes(last.toISOString().slice(0, 10)));
    assert.equal(initial.dates.length, new Set(initial.dates).size);
    assert.deepEqual(initial.dates, [...initial.dates].sort());
    assert.ok(initial.dates.length <= 73);
  }
});

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
