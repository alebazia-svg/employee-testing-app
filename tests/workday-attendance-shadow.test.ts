import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLatenessShadowSnapshot, evaluateLatenessShadowV1, LATENESS_SHADOW_POLICY_V1 } from '../lib/attendance-shadow';
import { parseWorkdayQrDepartment, workdayStartIntentExpiresAt, WORKDAY_START_INTENT_TTL_MS } from '../lib/workday-qr';
import { evaluateDepartmentShiftCombination } from '../lib/workday-shift-combination';
import { deriveWorkdayShiftSelection, loadWorkdayShiftSelection } from '../lib/workday-shift-selection';

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

test('every department shift stays available for any schedule or colleague start', () => {
  for (const department of ['retail', 'wholesale']) {
    const expected = department === 'retail' ? ['09_18', '09_20', '11_20'] : ['09_18', '09_19', '10_19'];
    for (const scheduledWorkingUserIds of [[], [1], [2], [1, 2], [2, 2]]) {
      for (const startedWorkdays of [[], [{userId:2,shiftCode:'09_18'}], [{userId:2,shiftCode:'11_20'}], [{userId:2,shiftCode:'other'}]]) {
        for (const missingScheduleUserIds of [[], [3]]) {
          const selection = deriveWorkdayShiftSelection({department,currentUserId:1,scheduledWorkingUserIds,startedWorkdays,missingScheduleUserIds});
          assert.equal(selection.mode, 'manual');
          assert.deepEqual(selection.allowedShiftCodes, expected);
          assert.deepEqual(selection.exceptionShiftCodes, []);
        }
      }
    }
  }
});

test('start and correction choices do not read or wait for calendar data', async () => {
  const unavailableDb = new Proxy({}, {get(){throw Error('Calendar must not be read for shift selection');}});
  for (const department of ['retail', 'wholesale']) {
    const selection = await loadWorkdayShiftSelection(unavailableDb as never,{department,currentUserId:1,date:'2026-11-04'});
    assert.equal(selection.mode, 'manual');
    assert.equal(selection.scheduledCount,null,'calendar count is unassessed, not a fabricated zero');
    assert.equal(selection.allowedShiftCodes.length,3);
    assert.deepEqual(selection.exceptionShiftCodes,[]);
  }
});

test('choosing 11–20 uses its own start for lateness, including a solo day', () => {
  assert.equal(buildLatenessShadowSnapshot(660,656).lateMinutes,0);
  assert.equal(buildLatenessShadowSnapshot(660,665).lateMinutes,5);
  assert.equal(buildLatenessShadowSnapshot(540,656).lateMinutes,116,'09-start remains a different, explicit choice');
});

test('calendar recommendations preserve the former helpful suggestion without hiding alternatives',()=>{
  const solo={department:'retail',currentUserId:1,scheduledWorkingUserIds:[1],startedWorkdays:[] as Array<{userId:number;shiftCode:string}>};
  assert.deepEqual(deriveWorkdayShiftSelection(solo).recommendedShiftCodes,['09_20']);
  assert.deepEqual(deriveWorkdayShiftSelection({...solo,department:'wholesale'}).recommendedShiftCodes,['09_19']);
  assert.deepEqual(deriveWorkdayShiftSelection({...solo,scheduledWorkingUserIds:[1,2]}).recommendedShiftCodes,['09_18','11_20']);
  const remaining=deriveWorkdayShiftSelection({...solo,startedWorkdays:[{userId:2,shiftCode:'09_18'}]});
  assert.deepEqual(remaining.recommendedShiftCodes,['11_20']);
  assert.deepEqual(remaining.allowedShiftCodes,['09_18','09_20','11_20']);
  for(const variant of [{...solo,missingScheduleUserIds:[2]},{...solo,scheduledWorkingUserIds:[]},{...solo,startedWorkdays:[{userId:2,shiftCode:'other'}]}]){
    const selection=deriveWorkdayShiftSelection(variant);
    assert.deepEqual(selection.recommendedShiftCodes,[]);
    assert.equal(selection.allowedShiftCodes.length,3);
  }
});

test('a failed recommendation read falls back to every normal shift',async()=>{
  const failedDb=new Proxy({}, {get(){throw Error('Schedule unavailable');}});
  const selection=await loadWorkdayShiftSelection(failedDb as never,{department:'retail',currentUserId:1,date:'2026-11-04',recommendation:true});
  assert.deepEqual(selection.recommendedShiftCodes,[]);
  assert.deepEqual(selection.allowedShiftCodes,['09_18','09_20','11_20']);
});

test('first arrival recommendations follow Moscow QR time, including early arrival for a late shift',()=>{
  for(const [department,clock,code] of [
    ['wholesale','09:29:59','09_19'],['wholesale','09:30:00','10_19'],['wholesale','10:05:00','10_19'],
    ['retail','10:29:59','09_20'],['retail','10:30:00','11_20'],['retail','10:36:00','11_20'],['retail','11:05:00','11_20'],
  ]){
    const selection=deriveWorkdayShiftSelection({department,currentUserId:1,scheduledWorkingUserIds:[1],startedWorkdays:[],qrAcceptedAt:new Date(`2026-11-04T${clock}+03:00`)});
    assert.deepEqual(selection.recommendedShiftCodes,[code],`${department} ${clock}`);
    assert.equal(selection.allowedShiftCodes.length,3);
  }
});

test('a real opening colleague suggests the paired late shift even with missing plans',()=>{
  for(const [department,code] of [['wholesale','10_19'],['retail','11_20']]){
    const selection=deriveWorkdayShiftSelection({department,currentUserId:2,scheduledWorkingUserIds:[],missingScheduleUserIds:[1,2],startedWorkdays:[{userId:1,shiftCode:'09_18'}],qrAcceptedAt:new Date('2026-11-04T09:10:00+03:00')});
    assert.deepEqual(selection.recommendedShiftCodes,[code]);
    assert.equal(selection.recommendationHint,'С учётом смены коллеги');
    assert.equal(selection.allowedShiftCodes.length,3);
  }
});

test('two late arrivals do not recommend a fictitious early start to the second employee',()=>{
  for(const [department,code,clock] of [['wholesale','10_19','10:05:00'],['retail','11_20','11:05:00']]){
    const selection=deriveWorkdayShiftSelection({department,currentUserId:2,scheduledWorkingUserIds:[1,2],startedWorkdays:[{userId:1,shiftCode:code}],qrAcceptedAt:new Date(`2026-11-04T${clock}+03:00`)});
    assert.deepEqual(selection.recommendedShiftCodes,[code]);
    assert.equal(selection.recommendationHint,'По времени отметки');
    assert.ok(selection.allowedShiftCodes.includes('09_18'));
  }
});
