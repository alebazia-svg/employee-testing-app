import assert from 'node:assert/strict';
import test from 'node:test';
import {retailAttendanceSource as resolve} from '../lib/retail-attendance-source';
const google={plan:'working' as const,arrival:540,departure:null,shift:'9-18',note:'',lateMinutes:0,ambiguous:false};
test('Google works during pilot; an actual app shift overrides duplicate or contradictory Google marks',()=>{
 assert.equal(resolve(google,null).source,'Google');
 assert.equal(resolve({...google,plan:'off'},null).day.plan,'working','actual Google start overrides off plan');
 const app={startedAt:new Date('2026-10-20T07:15:00Z'),endedAt:null,status:'active'};
 const chosen=resolve(google,app,'working');assert.equal(chosen.source,'Приложение');assert.equal(chosen.day.arrival,615);
 assert.equal(resolve({...google,plan:'off'},app,'working').day.plan,'working');
 assert.equal(resolve({...google,plan:'off'},app,'off').day.plan,'working');
 assert.equal(resolve({...google,arrival:null},null).day.arrival,null,'missing start never becomes a day off');
 assert.equal(resolve(google,{...app,status:'cancelled'}).source,'Google');
 assert.equal(resolve(google,{...app,status:'completed',endedAt:new Date('2026-10-20T15:00:00Z')}).day.departure,1080);
});
