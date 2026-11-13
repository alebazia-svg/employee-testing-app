import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveControlCalendarDay } from '../lib/team-control-calendar';
import { resolveCalendarFact, type CalendarWorkingCorrection } from '../lib/team-calendar-fact';
import { teamRowStatus } from '../lib/team-control-order';
import { teamControlSummary } from '../lib/team-control-summary';
import { resolveTeamAttendance } from '../lib/team-attendance';

const base = {date:'2026-11-11',department:'retail',plan:'working',source:'Приложение',vacation:false,qrAccepted:false,hasWorkDay:false,now:new Date('2026-11-11T20:00:00+03:00')};
for(const [department,end] of [['retail','20:00'],['wholesale','19:00'],['procurement','18:00']]) {
 test(`${department}: no QR becomes off exactly at department close; original plan stays working`,()=>{
  const now=new Date(`2026-11-11T${end}:00+03:00`),input={...base,department,now};
  assert.equal(resolveControlCalendarDay({...input,now:new Date(+now-1)}).settled,false);
  const result=resolveControlCalendarDay(input);
  assert.equal(result.state,'Выходной');assert.equal(result.calendarState,'off');assert.equal(input.plan,'working');
  assert.equal(resolveCalendarFact(input).state,result.fact.state);
 });
}
for(const plan of ['working','off','unset','unknown','unavailable'])test(`${plan}: closed day without QR agrees with calendar even if Google plan is missing`,()=>{
 const input={...base,plan};assert.equal(resolveControlCalendarDay(input).calendarState,'off');
 assert.equal(resolveControlCalendarDay({...input,qrAccepted:true}).state,'Рабочий день');
});
test('manual accounting after auto off does not invent an active shift',()=>{
 const noQr=resolveControlCalendarDay(base),late=resolveControlCalendarDay({...base,qrAccepted:true,now:new Date('2026-11-11T20:45:00+03:00')});
 assert.equal(noQr.calendarState,'off');assert.equal(late.calendarState,'working');assert.equal(late.sourceLabel,undefined);
 const row={id:4,name:'Зухра',start:'—',end:'—',planState:'working',missing:false,sourceUnavailable:false,state:late.state!,calendarState:late.calendarState};
 assert.equal(teamRowStatus(row),'recorded');assert.notEqual(teamRowStatus(row),'working');assert.notEqual(teamRowStatus(row),'expected');
});
test('real active, unclosed and completed app shifts retain their existing lifecycle and times',()=>{
 const google={plan:null,arrival:null,departure:null,shift:'',lateMinutes:0,note:'',ambiguous:false};
 for(const [date,status,endedAt,expected] of [['2026-11-11','active',null,'Работает'],['2026-11-10','active',null,'Не завершил смену'],['2026-11-11','completed','2026-11-11T18:00:00+03:00','Завершил · 18:00']] as const){
  const workDay={startedAt:`${date}T09:00:00+03:00`,endedAt,shiftLabel:'09:00–18:00',lateMinutes:0,status};
  const attendance=resolveTeamAttendance({date,today:'2026-11-11',workDay,google,googleAvailable:false,fallbackState:'Ожидается начало'});
  const fact=resolveControlCalendarDay({...base,date,hasWorkDay:true,qrAccepted:true});
  assert.equal(fact.settled,false);assert.equal(fact.state,null);assert.equal(fact.sourceLabel,undefined);assert.equal(fact.calendarState,undefined);assert.equal(attendance.state,expected);assert.equal(attendance.start,'09:00');
 }
});
test('vacation is distinct, but actual QR during vacation means a working day',()=>{
 assert.equal(resolveControlCalendarDay({...base,vacation:true,plan:'vacation'}).state,'Отпуск');
 assert.equal(resolveControlCalendarDay({...base,vacation:true,plan:'vacation',qrAccepted:true}).calendarState,'working');
});
test('future and pre-pilot days preserve existing control behavior',()=>{
 for(const date of ['2026-11-12','2026-10-23'])assert.equal(resolveControlCalendarDay({...base,date}).settled,false);
});
test('audited forgotten-QR correction and its reset match the calendar without fake attendance',()=>{
 const correction:CalendarWorkingCorrection={version:1,userId:4,date:base.date,status:'working',actorId:1,actorName:'Администратор',reason:'Работала, забыла QR',correctedAt:base.now.toISOString()};
 const fixed=resolveControlCalendarDay({...base,correction});assert.equal(fixed.state,'Рабочий день');
 assert.equal(resolveControlCalendarDay({...base,correction:{...correction,status:'reset'}}).state,'Выходной');
 assert.equal(resolveControlCalendarDay({...base,qrAccepted:true,correction:{...correction,status:'reset'}}).calendarState,'working');
});
test('off filter and control questions use the actual day while retaining financial and employee issues',()=>{
 const day=resolveControlCalendarDay(base);
 const row={id:4,name:'Зухра',planState:'working',state:day.state!,calendarState:day.calendarState,start:'—',end:'—',missing:false,sourceUnavailable:false,needsReview:false,review:day.state!,alerts:['Инкассация 100 ₽ · ожидается проведение в 1С'],alertTargets:{},issues:[{id:7,title:'Нужна помощь по чеку',meta:'',href:'/issue/7'}],timing:[]};
 assert.equal(teamRowStatus(row),'off');const summary=teamControlSummary(row,base.date);
 assert.equal(summary.items.length,2);assert.ok(summary.items.some(i=>i.label.startsWith('Инкассация')));assert.ok(summary.items.some(i=>i.label==='Нужна помощь по чеку'));
 assert.ok(!summary.items.some(i=>i.key==='missing'));
 assert.equal(teamControlSummary({...row,planState:'unavailable',alerts:[],issues:[]},base.date).kind,'normal');
});

test('an existing app shift without a QR field is never auto-closed or hidden',()=>{
 const day=resolveControlCalendarDay({...base,hasWorkDay:true,qrAccepted:false});
 assert.equal(day.settled,false);assert.equal(day.calendarState,undefined);assert.equal(day.state,null);
 const google={plan:null,arrival:null,departure:null,shift:'',lateMinutes:0,note:'',ambiguous:false};
 const attendance=resolveTeamAttendance({date:base.date,today:base.date,workDay:{startedAt:'2026-11-11T09:00:00+03:00',endedAt:null,status:'completed',shiftLabel:'09:00–18:00',lateMinutes:0},google,googleAvailable:false,fallbackState:'Ожидается начало'});
 assert.equal(attendance.state,'Закрыта без времени завершения');
});

test('compact status and source describe the result without changing the plan or real shift lifecycle',()=>{
 const off=resolveControlCalendarDay(base);
 assert.equal(off.sourceLabel,'Автоматически — без QR');
 assert.equal(off.stateNote,'Выходной учтён автоматически: нет QR-отметки начала смены');
 assert.equal(resolveControlCalendarDay({...base,qrAccepted:true}).sourceLabel,undefined);
 const real=resolveControlCalendarDay({...base,qrAccepted:true,hasWorkDay:true});
 assert.equal(real.sourceLabel,undefined);assert.equal(real.state,null);assert.equal(real.stateNote,undefined);
 assert.equal(resolveControlCalendarDay({...base,hasWorkDay:true}).sourceLabel,undefined);
 assert.equal(resolveControlCalendarDay({...base,now:new Date('2026-11-11T12:00:00+03:00')}).sourceLabel,undefined);
 assert.equal(resolveControlCalendarDay({...base,date:'2026-11-12'}).sourceLabel,undefined);
});
