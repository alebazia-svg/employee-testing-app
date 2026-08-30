import assert from 'node:assert/strict';
import test from 'node:test';
import { expectedColleagueShiftCode } from '../lib/workday-colleague-shift';

test('solo scheduled colleague gets the department solo shift', () => {
  assert.equal(expectedColleagueShiftCode({
    department: 'retail',
    colleagueUserId: 2,
    scheduledWorkingUserIds: [2],
    startedWorkdays: [],
  }), '09_20');
});

test('scheduled colleague gets the remaining paired shift after the first start', () => {
  assert.equal(expectedColleagueShiftCode({
    department: 'retail',
    colleagueUserId: 2,
    scheduledWorkingUserIds: [1, 2],
    startedWorkdays: [{ userId: 1, shiftCode: '09_18' }],
  }), '11_20');
  assert.equal(expectedColleagueShiftCode({
    department: 'wholesale',
    colleagueUserId: 4,
    scheduledWorkingUserIds: [3, 4],
    startedWorkdays: [{ userId: 3, shiftCode: '09_18' }],
  }), '10_19');
});

test('paired colleague time remains unknown before either employee starts', () => {
  assert.equal(expectedColleagueShiftCode({
    department: 'retail',
    colleagueUserId: 2,
    scheduledWorkingUserIds: [1, 2],
    startedWorkdays: [],
  }), null);
});

test('unsupported or off-schedule colleague never receives a guessed shift', () => {
  assert.equal(expectedColleagueShiftCode({
    department: 'operations',
    colleagueUserId: 2,
    scheduledWorkingUserIds: [2],
    startedWorkdays: [],
  }), null);
  assert.equal(expectedColleagueShiftCode({
    department: 'retail',
    colleagueUserId: 3,
    scheduledWorkingUserIds: [1, 2],
    startedWorkdays: [{ userId: 1, shiftCode: '09_18' }],
  }), null);
});
