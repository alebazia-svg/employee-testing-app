import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCalendarFact } from '../lib/team-calendar-fact';
import { resolveControlCalendarDay } from '../lib/team-control-calendar';
import { resolveTeamAttendance } from '../lib/team-attendance';
import { googleDay } from '../lib/team-control';
import { mapGoogleAttendanceRows } from '../lib/google-sheets';
import { teamRowStatus } from '../lib/team-control-order';

const date='2026-11-15', now=new Date('2026-11-16T09:00:00+03:00');
const base={date,department:'retail',plan:'working',source:'Приложение',vacation:false,qrAccepted:false,googleMarksAvailable:true,now};
const emptyGoogle={plan:null,arrival:null,departure:null,shift:'',lateMinutes:0,note:'',ambiguous:false};

test('a Google arrival prevents automatic off in every department and preserves the saved plan',()=>{
 for(const department of ['retail','wholesale','procurement'])for(const plan of ['working','off','unset','unavailable','vacation']){
  const input={...base,department,plan,vacation:plan==='vacation',googleArrival:547};
  const before=JSON.stringify(input),result=resolveCalendarFact(input);
  assert.equal(result.state,'working');assert.equal(result.source,'Google · резерв');
  assert.equal(result.caption,plan==='working'?'':'Google · резерв');
  assert.equal(result.canMarkWorking,false);assert.equal(JSON.stringify(input),before);
 }
});

test('only a plan, a checkout without an arrival, and an actual start have different meanings',()=>{
 assert.equal(resolveCalendarFact(base).state,'off','a working plan alone is not an attendance mark');
 const checkout=resolveCalendarFact({...base,googleDeparture:1080});
 assert.equal(checkout.state,'working');assert.match(checkout.explanation,/Окончание/);
 assert.doesNotMatch(checkout.explanation,/Начало рабочего дня отмечено/);
 for(const bad of [NaN,-1,1440,547.5])assert.equal(resolveCalendarFact({...base,googleArrival:bad}).state,'off');
});

test('committed app starts win over Google, including older app rows without the QR field',()=>{
 for(const qrAccepted of [false,true]){
  const result=resolveCalendarFact({...base,plan:'off',appStarted:true,qrAccepted,googleArrival:480});
  assert.equal(result.state,'working');assert.equal(result.source,qrAccepted?'По QR':'Приложение');
  assert.equal(result.usesGoogleAttendance,false);assert.equal(result.canMarkWorking,false);
 }
});

test('actual Google evidence supersedes a manual confirmation without changing its audit record',()=>{
 const correction={version:1 as const,userId:1,date,status:'working' as const,actorId:99,actorName:'Администратор',reason:'Подтверждён выход без QR',correctedAt:now.toISOString()};
 const before=JSON.stringify(correction);
 assert.equal(resolveCalendarFact({...base,correction}).source,'Исправлено администратором');
 assert.equal(resolveCalendarFact({...base,correction,googleArrival:547}).source,'Google · резерв');
 assert.equal(JSON.stringify(correction),before);
});

test('a later Google read replaces automatic off without changing the original working plan',()=>{
 const input={...base};
 assert.equal(resolveCalendarFact(input).source,'Автоматически');
 assert.equal(resolveCalendarFact({...input,googleArrival:547}).source,'Google · резерв');
 assert.equal(input.plan,'working');
 assert.equal(resolveCalendarFact({...input,date:'2026-11-17',googleArrival:547}).source,'Приложение','future dates retain their plan');
 assert.equal(resolveCalendarFact({...input,date:'2026-10-23',googleArrival:547}).source,'Приложение','pre-cutover history retains its rule');
});

test('optional Google outage never blocks accounting or erases app evidence or a chosen day off',()=>{
 const unknown=resolveControlCalendarDay({...base,googleMarksAvailable:false,hasWorkDay:false});
 assert.equal(unknown.settled,true);assert.equal(unknown.fact.state,'off');assert.equal(unknown.state,'Выходной');
 assert.equal(unknown.fact.source,'Автоматически');
 assert.equal(resolveCalendarFact({...base,googleMarksAvailable:false,googleArrival:547}).usesGoogleAttendance,false);
 assert.equal(resolveCalendarFact({...base,googleMarksAvailable:false,qrAccepted:true}).source,'По QR');
 const off=resolveControlCalendarDay({...base,plan:'off',googleMarksAvailable:false,hasWorkDay:false});
 assert.equal(off.state,'Выходной');assert.equal(off.fact.source,'Приложение');assert.equal(off.stateNote,undefined);
});

test('an unused or unavailable Google reserve does not change department closing boundaries',()=>{
 for(const [department,time] of [['retail','20:00'],['wholesale','19:00'],['procurement','18:00']]){
  const closing=new Date(`${date}T${time}:00+03:00`);
  for(const googleMarksAvailable of [false,true]){
   const input={...base,department,googleMarksAvailable};
   assert.equal(resolveCalendarFact({...input,now:new Date(+closing-1)}).state,'working');
   const after=resolveCalendarFact({...input,now:closing});
   assert.equal(after.state,'off');assert.equal(after.source,'Автоматически');
  }
 }
});

test('calendar accounting does not replace actual Google arrival/departure states or filter categories',()=>{
 for(const [arrival,departure,state,status] of [[547,null,'Приход отмечен','arrival'],[547,1080,'Завершил · 18:00','finished'],[null,1080,'Завершил · 18:00','finished']] as const){
  const google={...emptyGoogle,arrival,departure};
  const calendar=resolveControlCalendarDay({...base,plan:'off',googleArrival:arrival,googleDeparture:departure,hasWorkDay:false});
  const attendance=resolveTeamAttendance({date,today:'2026-11-16',google,googleAvailable:true,fallbackState:'Выходной'});
  assert.equal(calendar.settled,true);assert.equal(calendar.state,null);assert.equal(calendar.calendarState,'working');
  assert.equal(attendance.state,state);assert.equal(attendance.start,arrival===null?'—':'09:07');
  assert.equal(attendance.sourceLabel,'Google · резерв');assert.equal(attendance.active,false);
  // A departure-only record is completed, not a generic working-day correction.
  assert.equal(teamRowStatus({id:1,name:'Пример',state:attendance.state,start:attendance.start,end:attendance.end,planState:'off',sourceUnavailable:false,missing:false,calendarState:calendar.calendarState}),status);
 }
});

test('Google matching uses the existing Russian date parser and employee identity, not a nearby day or colleague',()=>{
 const marks=mapGoogleAttendanceRows([['15.11.2026 09:07:00','Начало рабочего дня','','Астемир Тохов','Рабочий день']]);
 for(const [name,selected,expected] of [['Астемир Тохов',date,'working'],['Кумыков Мухамед',date,'off'],['Астемир Тохов','2026-11-14','off']]){
  const google=googleDay(name,selected,[],marks);
  assert.equal(resolveCalendarFact({...base,date:selected,googleArrival:google.arrival}).state,expected);
 }
});
