import assert from 'node:assert/strict';
import test from 'node:test';
import { expectedColleagueShiftCode, hasColleagueShiftConflict } from '../lib/workday-colleague-shift';

const base={department:'retail',colleagueUserId:2,scheduledWorkingUserIds:[2],startedWorkdays:[] as Array<{userId:number;shiftCode:string}>};
test('colleague hours remain unknown until their own shift is selected',()=>{
  for(const department of ['retail','wholesale'])for(const scheduledWorkingUserIds of [[],[2],[1,2]])for(const missingScheduleUserIds of [[],[3]])for(const shiftCode of ['09_18','11_20','09_20','other']){
    const input={...base,department,scheduledWorkingUserIds,missingScheduleUserIds,startedWorkdays:[{userId:1,shiftCode}]};
    assert.equal(expectedColleagueShiftCode(input),null);
    assert.equal(hasColleagueShiftConflict(input),false,'a colleague choice is not a schedule conflict');
  }
});
test('a real chosen shift stays factual even with an empty or off-day plan',()=>{
  for(const department of ['retail','wholesale'])for(const shiftCode of ['09_18','11_20','09_19','10_19']){
    const input={...base,department,scheduledWorkingUserIds:[],missingScheduleUserIds:[2],startedWorkdays:[{userId:2,shiftCode}]};
    assert.equal(expectedColleagueShiftCode(input),shiftCode);
    assert.equal(hasColleagueShiftConflict(input),false);
  }
});
test('unsupported departments and contradictory actual records never produce a guessed shift',()=>{
  assert.equal(expectedColleagueShiftCode({...base,department:'operations'}),null);
  const input={...base,startedWorkdays:[{userId:2,shiftCode:'09_18'},{userId:2,shiftCode:'11_20'}]};
  assert.equal(expectedColleagueShiftCode(input),null);assert.equal(hasColleagueShiftConflict(input),true);
});
