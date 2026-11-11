import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTeamCalendarEvidence} from '../lib/team-calendar-evidence';
import {resolveControlCalendarDay} from '../lib/team-control-calendar';
const date='2026-11-11',now=new Date('2026-11-11T20:30:00+03:00');
test('an abandoned or expired scan is not a working day; a committed QR workday is',async()=>{
 const rows=[{userId:4,date,qrAcceptedAt:new Date('2026-11-11T09:00:00+03:00')}];
 const db:any={workDayEntry:{findMany:async()=>rows},workdayStartIntent:{findMany:async()=>{throw Error('temporary scans must not drive accounting')}},adminInboxEvent:{findMany:async()=>[]}};
 const result=await loadTeamCalendarEvidence(db,{userIds:[4,5],dates:[date],now});
 assert.equal(result.get(`4:${date}`)?.qrAccepted,true);
 assert.equal(result.get(`5:${date}`)?.qrAccepted,false);
 for(const department of ['retail','wholesale','procurement']){
 const day=resolveControlCalendarDay({date,department,plan:'working',source:'Приложение',vacation:false,qrAccepted:result.get(`5:${date}`)!.qrAccepted,hasWorkDay:false,now});
 assert.equal(day.state,'Выходной');assert.equal(day.startNote,undefined);
 }
});
test('a manually corrected day does not pretend the employee has an active shift',()=>{
 const correction={version:1 as const,userId:6,date,status:'working' as const,actorId:1,actorName:'Админ',reason:'Подтверждено',correctedAt:now.toISOString()};
 const day=resolveControlCalendarDay({date,department:'retail',plan:'off',source:'Приложение',vacation:false,qrAccepted:false,hasWorkDay:false,now,correction});
 assert.equal(day.state,'Рабочий день');assert.equal(day.fact.source,'Исправлено администратором');assert.equal(day.calendarState,'working');
 assert.notEqual(day.state,'Работает');
});
for(const source of ['workDayEntry','adminInboxEvent'])test(`${source} failure does not fabricate days off`,async()=>{
 const db:any=Object.fromEntries(['workDayEntry','adminInboxEvent'].map(n=>[n,{findMany:async()=>{if(n===source)throw Error('unavailable');return []}}]));
 await assert.rejects(loadTeamCalendarEvidence(db,{userIds:[4],dates:[date],now}),/unavailable/);
});
