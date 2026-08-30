import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLatenessShadowSnapshot, evaluateLatenessShadowV1, LATENESS_SHADOW_POLICY_V1 } from '../lib/attendance-shadow';
import { parseWorkdayQrDepartment, workdayStartIntentExpiresAt, WORKDAY_START_INTENT_TTL_MS } from '../lib/workday-qr';
import { evaluateDepartmentShiftCombination } from '../lib/workday-shift-combination';
import { deriveWorkdayShiftSelection } from '../lib/workday-shift-selection';

test('lateness-shadow-v1 keeps every agreed boundary stable', () => {
  const expectations: Array<[number, number]> = [
    [0, 0], [1, 0], [5, 0],
    [6, 1], [10, 1],
    [11, 2], [20, 2],
    [21, 4], [40, 4],
    [41, 6], [120, 6],
  ];

  for (const [minutes, pointsX2] of expectations) {
    assert.deepEqual(evaluateLatenessShadowV1(minutes), {
      policyVersion: LATENESS_SHADOW_POLICY_V1,
      pointsX2,
    });
  }
});

test('lateness snapshot uses QR time rather than later WorkDay creation time', () => {
  const snapshot = buildLatenessShadowSnapshot(9 * 60, 9 * 60 + 48);
  assert.equal(snapshot.lateMinutes, 48);
  assert.equal(snapshot.pointsX2, 6);
  assert.equal(snapshot.policyVersion, LATENESS_SHADOW_POLICY_V1);
});

test('QR parser accepts only exact department payloads', () => {
  assert.equal(parseWorkdayQrDepartment('offonika-workday-start:retail'), 'retail');
  assert.equal(parseWorkdayQrDepartment(' OFFONIKA-WORKDAY-START:WHOLESALE '), 'wholesale');
  assert.equal(parseWorkdayQrDepartment('offonika-workday-start:operations'), null);
  assert.equal(parseWorkdayQrDepartment('https://offonika.example/retail'), null);
});

test('start intent expiration is a fixed server-side window', () => {
  const acceptedAt = new Date('2026-08-29T06:00:00.000Z');
  assert.equal(workdayStartIntentExpiresAt(acceptedAt).getTime(), acceptedAt.getTime() + WORKDAY_START_INTENT_TTL_MS);
});

test('retail single-worker and two-worker combinations are evaluated independently of employee assignment', () => {
  assert.equal(evaluateDepartmentShiftCombination({
    department: 'retail',
    scheduledWorkingUserIds: [1],
    startedWorkdays: [{ userId: 1, shiftCode: '09_20' }],
  }).status, 'valid');

  assert.equal(evaluateDepartmentShiftCombination({
    department: 'retail',
    scheduledWorkingUserIds: [1, 2],
    startedWorkdays: [
      { userId: 2, shiftCode: '11_20' },
      { userId: 1, shiftCode: '09_18' },
    ],
  }).status, 'valid');
});

test('combination shadow waits for incomplete pilot starts and flags only the aggregate mismatch', () => {
  assert.equal(evaluateDepartmentShiftCombination({
    department: 'wholesale',
    scheduledWorkingUserIds: [3, 4],
    startedWorkdays: [{ userId: 3, shiftCode: '09_18' }],
  }).status, 'waiting');

  assert.equal(evaluateDepartmentShiftCombination({
    department: 'wholesale',
    scheduledWorkingUserIds: [3, 4],
    startedWorkdays: [
      { userId: 3, shiftCode: '10_19' },
      { userId: 4, shiftCode: '10_19' },
    ],
  }).status, 'mismatch');
});

test('solo override on a two-person schedule is visible immediately as a combination anomaly', () => {
  assert.equal(evaluateDepartmentShiftCombination({
    department: 'wholesale',
    scheduledWorkingUserIds: [3, 4],
    startedWorkdays: [{ userId: 3, shiftCode: '09_19' }],
  }).status, 'mismatch');
});

test('unscheduled starts are observable mismatches and zero-worker days remain unverifiable', () => {
  const unexpected = evaluateDepartmentShiftCombination({
    department: 'retail',
    scheduledWorkingUserIds: [1],
    startedWorkdays: [
      { userId: 1, shiftCode: '09_20' },
      { userId: 2, shiftCode: '09_18' },
    ],
  });
  assert.equal(unexpected.status, 'mismatch');
  assert.equal(unexpected.unexpectedStartCount, 1);

  assert.equal(evaluateDepartmentShiftCombination({
    department: 'retail',
    scheduledWorkingUserIds: [],
    startedWorkdays: [],
  }).status, 'unavailable');
});

test('single scheduled employee receives the department long shift', () => {
  assert.deepEqual(deriveWorkdayShiftSelection({
    department: 'wholesale',
    currentUserId: 7,
    scheduledWorkingUserIds: [7],
    startedWorkdays: [],
  }), {
    mode: 'solo',
    scheduledCount: 1,
    allowedShiftCodes: ['09_19'],
    exceptionShiftCodes: [],
  });

  assert.deepEqual(deriveWorkdayShiftSelection({
    department: 'retail',
    currentUserId: 2,
    scheduledWorkingUserIds: [2],
    startedWorkdays: [],
  }).allowedShiftCodes, ['09_20']);
});

test('second scheduled employee receives only the remaining paired shift', () => {
  assert.deepEqual(deriveWorkdayShiftSelection({
    department: 'retail',
    currentUserId: 2,
    scheduledWorkingUserIds: [1, 2],
    startedWorkdays: [{ userId: 1, shiftCode: '09_18' }],
  }), {
    mode: 'remaining',
    scheduledCount: 2,
    allowedShiftCodes: ['11_20'],
    exceptionShiftCodes: [],
  });

  assert.deepEqual(deriveWorkdayShiftSelection({
    department: 'wholesale',
    currentUserId: 4,
    scheduledWorkingUserIds: [3, 4],
    startedWorkdays: [{ userId: 3, shiftCode: '10_19' }],
  }).allowedShiftCodes, ['09_18']);
});

test('first of two employees can choose either paired shift and missing schedule fails open', () => {
  assert.deepEqual(deriveWorkdayShiftSelection({
    department: 'wholesale',
    currentUserId: 3,
    scheduledWorkingUserIds: [3, 4],
    startedWorkdays: [],
  }).allowedShiftCodes, ['09_18', '10_19']);

  assert.deepEqual(deriveWorkdayShiftSelection({
    department: 'wholesale',
    currentUserId: 3,
    scheduledWorkingUserIds: [3, 4],
    startedWorkdays: [],
  }).exceptionShiftCodes, ['09_19']);

  const fallback = deriveWorkdayShiftSelection({
    department: 'wholesale',
    currentUserId: 3,
    scheduledWorkingUserIds: [],
    startedWorkdays: [],
  });
  assert.equal(fallback.mode, 'unavailable');
  assert.deepEqual(fallback.allowedShiftCodes, ['09_18', '09_19', '10_19']);
});
