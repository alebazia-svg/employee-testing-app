import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateWorkdayTiming } from '../lib/workday-timing';

const todayDateKey = '2026-07-25';

test('does not flag an active workday before shift end', () => {
  const violations = evaluateWorkdayTiming({
    dateKey: todayDateKey,
    todayDateKey,
    nowMinutes: 17 * 60,
    workDay: {
      status: 'active',
      shiftStartMinutes: 9 * 60,
      shiftEndMinutes: 18 * 60,
      startedAt: '2026-07-25T06:00:00.000Z',
      endedAt: null,
      lateMinutes: 0,
    },
  });

  assert.deepEqual(violations, []);
});

test('flags a missing checkout only after shift end', () => {
  const violations = evaluateWorkdayTiming({
    dateKey: todayDateKey,
    todayDateKey,
    nowMinutes: 18 * 60 + 1,
    workDay: {
      status: 'active',
      shiftStartMinutes: 9 * 60,
      shiftEndMinutes: 18 * 60,
      startedAt: '2026-07-25T06:00:00.000Z',
      endedAt: null,
      lateMinutes: 0,
    },
  });

  assert.equal(violations.length, 1);
  assert.equal(violations[0].kind, 'missing_checkout');
  assert.equal(violations[0].minutesLate, 1);
});

test('includes late start and each late checklist task', () => {
  const violations = evaluateWorkdayTiming({
    dateKey: todayDateKey,
    todayDateKey,
    nowMinutes: 23 * 60,
    workDay: {
      status: 'completed',
      shiftStartMinutes: 9 * 60,
      shiftEndMinutes: 18 * 60,
      startedAt: '2026-07-25T06:15:00.000Z',
      endedAt: '2026-07-25T20:00:00.000Z',
      lateMinutes: 15,
    },
    tasks: [
      {
        id: 10,
        title: 'Проверить кредиты',
        plannedTimeMinutes: 13 * 60 + 30,
        status: 'done',
        completedAt: '2026-07-25T19:53:00.000Z',
      },
    ],
  });

  assert.deepEqual(violations.map((violation) => violation.kind), ['late_start', 'task_late']);
  assert.equal(violations[1].minutesLate, 563);
});

test('treats a task completed after midnight as late for the previous day', () => {
  const violations = evaluateWorkdayTiming({
    dateKey: '2026-07-24',
    todayDateKey,
    nowMinutes: 60,
    tasks: [
      {
        id: 11,
        title: 'Сдать смену',
        plannedTimeMinutes: 20 * 60,
        status: 'done',
        completedAt: '2026-07-24T21:10:00.000Z',
      },
    ],
  });

  assert.equal(violations.length, 1);
  assert.equal(violations[0].kind, 'task_late');
  assert.equal(violations[0].minutesLate, 250);
});

test('does not flag an unstarted retail day before the latest possible shift', () => {
  const violations = evaluateWorkdayTiming({
    dateKey: todayDateKey,
    todayDateKey,
    nowMinutes: 10 * 60 + 30,
    department: 'retail',
    scheduleStatus: 'working',
    workDay: null,
  });

  assert.deepEqual(violations, []);
});

test('flags an unstarted retail day after the latest possible shift', () => {
  const violations = evaluateWorkdayTiming({
    dateKey: todayDateKey,
    todayDateKey,
    nowMinutes: 11 * 60 + 1,
    department: 'retail',
    scheduleStatus: 'working',
    workDay: null,
  });

  assert.equal(violations.length, 1);
  assert.equal(violations[0].kind, 'workday_not_started');
  assert.equal(violations[0].minutesLate, 1);
});

test('does not infer a start violation for a department without fixed shifts', () => {
  const violations = evaluateWorkdayTiming({
    dateKey: todayDateKey,
    todayDateKey,
    nowMinutes: 15 * 60,
    department: 'operations',
    scheduleStatus: 'working',
    workDay: null,
  });

  assert.deepEqual(violations, []);
});

test('does not flag a task exactly at its deadline', () => {
  const violations = evaluateWorkdayTiming({
    dateKey: todayDateKey,
    todayDateKey,
    nowMinutes: 13 * 60 + 30,
    tasks: [
      {
        id: 12,
        title: 'Проверить кредиты',
        plannedTimeMinutes: 13 * 60 + 30,
        status: 'pending',
        completedAt: null,
      },
    ],
  });

  assert.deepEqual(violations, []);
});

test('does not flag an absent workday on a scheduled day off', () => {
  const violations = evaluateWorkdayTiming({
    dateKey: '2026-07-24',
    todayDateKey,
    nowMinutes: 60,
    department: 'retail',
    scheduleStatus: 'off',
    workDay: null,
  });

  assert.deepEqual(violations, []);
});

test('does not flag checkout when the workday is completed', () => {
  const violations = evaluateWorkdayTiming({
    dateKey: todayDateKey,
    todayDateKey,
    nowMinutes: 23 * 60,
    workDay: {
      status: 'completed',
      shiftStartMinutes: 9 * 60,
      shiftEndMinutes: 18 * 60,
      startedAt: '2026-07-25T06:00:00.000Z',
      endedAt: '2026-07-25T15:05:00.000Z',
      lateMinutes: 0,
    },
  });

  assert.deepEqual(violations, []);
});
