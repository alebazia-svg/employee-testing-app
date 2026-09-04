import assert from 'node:assert/strict';
import test from 'node:test';
import { expectedColleagueShiftCode, hasColleagueShiftConflict } from '../lib/workday-colleague-shift';
import { deriveWorkdayShiftSelection } from '../lib/workday-shift-selection';

test('colleague plan matches actual remaining shift selection in both departments', () => {
  for (const department of ['retail', 'wholesale']) {
    const pair = department === 'retail' ? ['09_18', '11_20'] : ['09_18', '10_19'];
    for (const scheduledWorkingUserIds of [[2], [1, 2], [2, 2]]) {
      for (const firstShift of pair) {
        const input = {
          department,
          colleagueUserId: 2,
          scheduledWorkingUserIds,
          startedWorkdays: [{ userId: 1, shiftCode: firstShift }],
        };
        const selection = deriveWorkdayShiftSelection({ ...input, currentUserId: 2 });
        assert.deepEqual(selection.allowedShiftCodes, [expectedColleagueShiftCode(input)]);
        assert.equal(selection.mode, 'remaining');
      }
    }
  }
});

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

test('scheduled colleague gets the remaining shift after an off-schedule colleague actually starts', () => {
  const input = {
    department: 'retail',
    colleagueUserId: 2,
    scheduledWorkingUserIds: [2],
    startedWorkdays: [{ userId: 1, shiftCode: '09_18' }],
  };

  assert.equal(expectedColleagueShiftCode(input), '11_20');
  assert.equal(hasColleagueShiftConflict(input), false);
});

test('conflicting actual starts are not presented as a guessed colleague shift', () => {
  const input = {
    department: 'retail',
    colleagueUserId: 2,
    scheduledWorkingUserIds: [2],
    startedWorkdays: [{ userId: 1, shiftCode: '09_20' }],
  };

  assert.equal(expectedColleagueShiftCode(input), null);
  assert.equal(hasColleagueShiftConflict(input), true);
});

test('an extra off-schedule start makes a two-person schedule ambiguous', () => {
  const input = {
    department: 'retail',
    colleagueUserId: 2,
    scheduledWorkingUserIds: [2, 3],
    startedWorkdays: [{ userId: 1, shiftCode: '09_18' }],
  };

  assert.equal(expectedColleagueShiftCode(input), null);
  assert.equal(hasColleagueShiftConflict(input), true);
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
