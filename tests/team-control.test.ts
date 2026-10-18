import test from 'node:test';
import assert from 'node:assert/strict';
import { googleDay, taskTimingLabel, usesAppSchedule, dateKeyFromGoogle, teamStartControl, teamOperationAlerts } from '../lib/team-control';
const schedule=(plannedWork:boolean|null)=>({date:'18.10.2026',employee:'Магомед',plannedWork,scheduleNote:''});
const mark={date:'2026-10-18',timestamp:'18.10.2026 09:02:00',employee:'Косторенко Магомед',action:'Начало рабочего дня',time:'09:02',shift:'09:00–18:00'};
test('known aliases match; marks do not fabricate a plan',()=>{const d=googleDay('Костеренко Магомед','2026-10-18',[],[mark]);assert.equal(d.plan,null);assert.equal(d.arrival,542);assert.equal(d.lateMinutes,2);assert.equal(d.departure,null)});
test('explicit day off remains distinct from missing plan',()=>{assert.equal(googleDay('Магомед','2026-10-18',[schedule(false)],[]).plan,'off');assert.equal(googleDay('Магомед','2026-10-18',[schedule(null)],[]).plan,null)});
test('conflicting plans and shifts fail to unknown rather than blame',()=>{const d=googleDay('Магомед','2026-10-18',[schedule(true),schedule(false)],[mark,{...mark,shift:'11:00–20:00'}]);assert.equal(d.plan,null);assert.equal(d.ambiguous,true);assert.equal(d.lateMinutes,0)});
test('other dates cannot leak into selected day',()=>{assert.equal(googleDay('Магомед','2026-10-19',[schedule(true)],[mark]).arrival,null);assert.equal(dateKeyFromGoogle('18.10.2026'),'2026-10-18')});
test('pilot does not silently enroll other employees',()=>{assert.equal(usesAppSchedule('Ляна'),true);assert.equal(usesAppSchedule('Абшаева Зухра'),false);assert.equal(usesAppSchedule('Астемир Тохов'),false)});
test('timeliness uses Moscow time, not UTC or the cash result',()=>{assert.deepEqual(taskTimingLabel(540,'2026-10-18T06:00:00Z','2026-10-18'),{text:'В срок',tone:'green'});assert.deepEqual(taskTimingLabel(540,'2026-10-18T07:00:00Z','2026-10-18'),{text:'Позже на 60 мин',tone:'amber'});assert.equal(taskTimingLabel(540,'2026-10-19T06:00:00Z','2026-10-18').text,'Позже на 1440 мин');assert.equal(taskTimingLabel(840,null,'2026-10-18').tone,'neutral');assert.equal(taskTimingLabel(840,null,'2026-10-18',15).text,'Просрочено на 15 мин')});

test('absence uses a known shift time and never a department cutoff',()=>{
 const check=(date:string,start:number|null,now=600)=>teamStartControl('working',false,true,date,'2026-10-18',now,start);
 assert.deepEqual(check('2026-10-18',660),{missing:false,unknownTime:false});
 assert.equal(check('2026-10-18',540).missing,true);
 assert.deepEqual(check('2026-10-18',null),{missing:false,unknownTime:true});
 assert.equal(check('2026-10-17',null).missing,true);
 assert.deepEqual(check('2026-10-19',null),{missing:false,unknownTime:false});
 assert.equal(teamStartControl('off',false,true,'2026-10-18','2026-10-18',900,null).unknownTime,false);
 assert.equal(teamStartControl('working',false,false,'2026-10-17','2026-10-18',900,540).missing,false);
});
test('closing and cash exceptions are independent of completed checklists',()=>{
 assert.deepEqual(teamOperationAlerts([{status:'pending'},{status:'approved'}],[{status:'posted_1c_pair'},{status:'one_c_error'},{status:'pending_1c'}]),['Запросов на завершение: 1','Инкассаций без подтверждения 1С: 1','Инкассаций в обработке: 1']);
 assert.deepEqual(teamOperationAlerts([],[{status:'posted_1c_pair'}]),[]);
});
