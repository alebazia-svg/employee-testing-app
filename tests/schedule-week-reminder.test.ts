import test from 'node:test';
import assert from 'node:assert/strict';
import {requiredScheduleWeekDates,schedulePlanningWeek,scheduleWeekReminder,scheduleWeekNoticeRef,scheduleWeekAllowsDate,SCHEDULE_WEEK_KIND} from '../lib/schedule-week-reminder';
import {scheduleAttentionItems} from '../lib/employee-schedule-attention';
import {employeeActionReminder} from '../lib/employee-action-reminder';
import {employeeReminderIconKind} from '../lib/employee-notice-icons';
import {notificationTargetKey,workdayNotificationHref} from '../lib/workday-notifications';
import {requestedDates} from '../lib/employee-schedule-snapshot';
const today='2026-10-26',weekStart=today;
test('weekly snapshots load the entire visible grid including saved past days without requiring those days to be filled',()=>{
 const wednesday='2026-10-28';
 assert.deepEqual(requestedDates(null,weekStart,wednesday)?.dates,['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01']);
 assert.equal(requiredScheduleWeekDates(wednesday)[0],wednesday);
 const friday=requestedDates(null,'2026-11-02','2026-10-30')!;
 assert.equal(friday.dates.length,14);assert.equal(friday.dates[0],weekStart);assert.equal(friday.dates.at(-1),'2026-11-08');
 assert.equal(requestedDates(null,'2026-11-02','2026-10-29'),null);
 assert.equal(requestedDates(null,'2026-11-09','2026-10-30'),null);
 assert.equal(requestedDates('2026-10',weekStart,today),null);
 assert.equal(requestedDates(null,'',today),null);
 assert.equal(requestedDates(null,null,wednesday)?.dates[0],wednesday,'ordinary upcoming-day snapshot is unchanged');
});
test('fixed Monday-Sunday window, next week starts being requested on Friday, never a rolling extra day',()=>{
 assert.equal(schedulePlanningWeek('2026-10-29'),'2026-10-26');
 assert.equal(schedulePlanningWeek('2026-10-30'),'2026-11-02');
 assert.equal(schedulePlanningWeek('2026-11-01'),'2026-11-02');
 assert.equal(schedulePlanningWeek('2026-11-02'),'2026-11-02');
 assert.equal(requiredScheduleWeekDates(today).length,7);assert.equal(requiredScheduleWeekDates('2026-10-30').length,10);
 assert.equal(requiredScheduleWeekDates('2026-10-30').at(-1),'2026-11-08');
 assert.equal(requiredScheduleWeekDates('2026-12-31').at(-1),'2027-01-03');
 assert.equal(requiredScheduleWeekDates('2028-02-28').at(-1),'2028-03-05');
});
test('weekly save scope crosses month/year but cannot write past dates or arbitrary future weeks',()=>{
 for(const d of ['2026-10-26','2026-10-31','2026-11-01'])assert.equal(scheduleWeekAllowsDate(weekStart,d,today),true);
 for(const d of ['2026-10-25','2026-11-02'])assert.equal(scheduleWeekAllowsDate(weekStart,d,today),false);
 assert.equal(scheduleWeekAllowsDate('2026-11-02','2026-11-08','2026-10-29'),false);
 assert.equal(scheduleWeekAllowsDate('2026-11-02','2026-11-08','2026-10-30'),true);
 assert.equal(scheduleWeekAllowsDate('2026-11-09','2026-11-10','2026-10-30'),false);
});
test('working/off/vacation complete a date; today and tomorrow qualifiers are facts, not repeated messages',()=>{
 const state=(entries:Array<{date:string;status:string}>,vacations:Array<{dateFrom:string;dateTo:string}>=[])=>scheduleWeekReminder({today,weekStart,entries,vacations});
 assert.equal(state([]).title,'Заполните график');assert.equal(state([]).qualifier,'Сегодня не отмечено');
 assert.equal(state([{date:today,status:'working'}]).qualifier,'Завтра не отмечено');
 assert.equal(state([{date:today,status:'working'},{date:'2026-10-27',status:'off'}]).qualifier,'');
 const all=requiredScheduleWeekDates(today).map(date=>({date,status:'off'}));assert.equal(state(all).active,false);
 assert.equal(state(all.slice(0,2),[{dateFrom:'2026-10-28',dateTo:'2026-11-03'}]).active,false);
 assert.equal(scheduleWeekReminder({today,weekStart:'2026-10-19',entries:[],vacations:[]}).active,false);
});
test('one weekly action survives reading and today-only save, opens bounded calendar and retires without filling the whole month',()=>{
 const data={userId:2,department:'retail',today,dated:[{date:today,notice:{id:3,kind:SCHEDULE_WEEK_KIND,title:'',readAt:null as Date|null}}],entries:[] as Array<{date:string;userId:number;status:string;user:{name:string}}>,vacations:[]};
 let item=scheduleAttentionItems(data)[0];assert.equal(item.scheduleAction,'week');data.dated[0].notice.readAt=new Date();
 data.entries.push({date:today,userId:2,status:'working',user:{name:'Учебный'}});item=scheduleAttentionItems(data)[0];assert.equal(item.status,'Завтра не отмечено');assert.deepEqual(item.notificationIds,[]);
 const reminder=employeeActionReminder(null,[item])!;assert.equal(reminder.target,'schedule');assert.match(reminder.href,/week=2026-10-26/);assert.equal(employeeReminderIconKind(reminder),'schedule');
 data.entries=requiredScheduleWeekDates(today).map(date=>({date,userId:2,status:'off',user:{name:'Учебный'}}));assert.deepEqual(scheduleAttentionItems(data),[]);
});
test('weekly reminder key and route differ from a concrete replacement; malformed week cannot be activated',()=>{
 assert.equal(scheduleWeekNoticeRef('schedule-week:retail:2026-10-27:2'),null);
 assert.equal(scheduleWeekNoticeRef('schedule-week:retail:2026-02-30:2'),null);
 const row={id:1,taskId:null,issueId:null,reviewId:null,kind:SCHEDULE_WEEK_KIND,fingerprint:'schedule-week:retail:2026-10-26:2'};
 assert.equal(notificationTargetKey(row),'schedule-week:retail:2026-10-26');assert.match(workdayNotificationHref(row),/week=2026-10-26/);
 assert.notEqual(notificationTargetKey(row),notificationTargetKey({...row,kind:'schedule_replacement_request',fingerprint:'schedule-coverage:retail:2026-10-27:2'}));
});
test('weekly planning and dated replacement stay separate; missing plans do not create another replacement',()=>{
 const n={id:4,kind:'schedule_replacement_request',title:'',readAt:null};
 const items=scheduleAttentionItems({userId:2,department:'retail',today,dated:[{date:today,notice:{...n,id:5,kind:SCHEDULE_WEEK_KIND}},{date:'2026-10-27',notice:n},{date:'2026-10-28',notice:{...n,id:6}}],entries:[{date:'2026-10-27',userId:2,status:'off',user:{name:'Учебный'}}],vacations:[]});
 assert.equal(items.length,2);assert.equal(items.filter(i=>i.scheduleAction==='week').length,1);assert.equal(items.filter(i=>i.scheduleAction==='replacement').length,1);
});
test('schedule planning never displaces a due checklist task or an actionable receipt/cash issue',()=>{
 const schedule=scheduleAttentionItems({userId:2,department:'retail',today,dated:[{date:today,notice:{id:10,kind:SCHEDULE_WEEK_KIND,title:'',readAt:null}}],entries:[],vacations:[]})[0];
 const now=new Date(`${today}T12:00:00+03:00`);
 const workday={workDay:{status:'active',date:today},shiftControl:{run:{date:today,status:'active'},tasks:[{id:9,title:'Пересчитать наличные',category:'cash',status:'pending',sortOrder:1,plannedTimeMinutes:600}]}};
 assert.equal(employeeActionReminder(workday,[schedule],now)?.id,'task:9');
 for(const kind of ['receipt','cash','closing','encashment'] as const) {
  const issue={...schedule,id:`${kind}:1`,kind,title:'Требуется действие',priority:0};
  assert.equal(employeeActionReminder(workday,[schedule,issue],now)?.id,issue.id);
 }
 workday.shiftControl.tasks[0].status='done';
 assert.equal(employeeActionReminder(workday,[schedule],now)?.id,schedule.id);
});
