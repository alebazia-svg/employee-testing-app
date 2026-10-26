import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleNearDates, scheduleNearReminder, scheduleNearNoticeRef, scheduleCalendarHref, SCHEDULE_NEAR_KIND } from '../lib/schedule-near-reminder';
import { scheduleAttentionItems } from '../lib/employee-schedule-attention';
import { employeeActionReminder } from '../lib/employee-action-reminder';
import { notificationTargetKey, workdayNotificationHref } from '../lib/workday-notifications';

const today = '2026-10-26';
const state = (entries: Array<{date:string;status:string}>, vacations: Array<{dateFrom:string;dateTo:string}>=[]) => scheduleNearReminder({today,entries,vacations});
const saved = [{date:today,status:'working'},{date:'2026-10-27',status:'off'}];

test('only today/tomorrow are required; empty seventh day, next week and month are silent',()=>{
  assert.equal(state(saved).active,false);
  assert.equal(state(saved.filter(e=>e.date!==today)).qualifier,'Сегодня не заполнен');
  assert.equal(state(saved.slice(0,1)).qualifier,'Завтра не заполнен');
  assert.equal(state([]).qualifier,'Сегодня и завтра не заполнены');
  assert.deepEqual(state([]).missing,[today,'2026-10-27']);
  assert.equal(state([...saved,{date:'2026-11-01',status:'unknown'}]).active,false);
});
test('the next day shifts the horizon, including Sunday, month/year end and leap day',()=>{
  for(const [day,next] of [['2026-11-01','2026-11-02'],['2026-10-31','2026-11-01'],['2026-12-31','2027-01-01'],['2028-02-28','2028-02-29']]) assert.deepEqual(scheduleNearDates(day),[day,next]);
  const next=scheduleNearReminder({today:'2026-10-27',entries:saved,vacations:[]});
  assert.deepEqual(next.missing,['2026-10-28']);assert.equal(next.qualifier,'Завтра не заполнен');
  const data={userId:2,department:'retail',today,dated:[],entries:[],vacations:[]};
  assert.notEqual(scheduleAttentionItems(data)[0].id,scheduleAttentionItems({...data,today:'2026-10-27'})[0].id,'yesterday’s temporary snooze must not suppress the next daily action');
});
test('off and active vacations cover the day; old or distant saved days cannot cover a missing near date',()=>{
  assert.equal(state([],[{dateFrom:today,dateTo:'2026-10-27'}]).active,false);
  assert.equal(state(saved.slice(0,1),[{dateFrom:'2026-10-27',dateTo:'2026-10-27'}]).active,false);
  assert.equal(state([{date:'2026-10-25',status:'working'},{date:'2026-10-28',status:'off'}]).missing.length,2);
});
test('one live calendar action is independent of read state and opens an unrestricted month',()=>{
  const data={userId:2,department:'retail',today,dated:[{date:today,notice:{id:7,kind:SCHEDULE_NEAR_KIND,title:'',readAt:null as Date|null}}],entries:[] as Array<{date:string;userId:number;status:string;user:{name:string}}>,vacations:[]};
  let items=scheduleAttentionItems(data);assert.equal(items.length,1);assert.equal(items[0].scheduleAction,'week');assert.equal(items[0].scheduleWeekStart,undefined,'already-open clients receive the existing direct-calendar intent without a bounded week');
  data.dated[0].notice.readAt=new Date();items=scheduleAttentionItems(data);assert.equal(items.length,1);assert.deepEqual(items[0].notificationIds,[]);
  const reminder=employeeActionReminder(null,items)!;assert.equal(reminder.target,'schedule');assert.equal(reminder.href,scheduleCalendarHref(today));assert.ok(!reminder.href.includes('week='));
  data.entries=saved.map(e=>({...e,userId:2,user:{name:'Пример'}}));assert.deepEqual(scheduleAttentionItems(data),[]);
});
test('daily delivery identity is distinct from a colleague replacement, malformed or foreign scopes are rejected',()=>{
  for(const key of ['schedule-near:retail:2026-02-30:2','schedule-near:retail:2026-10-26:0','schedule-near:operations:2026-10-26:2']) assert.equal(scheduleNearNoticeRef(key),null);
  const row={id:1,taskId:null,issueId:null,reviewId:null,kind:SCHEDULE_NEAR_KIND,fingerprint:`schedule-near:retail:${today}:2`};
  assert.equal(notificationTargetKey(row),`schedule-near:retail:${today}`);
  assert.ok(!workdayNotificationHref(row).includes('week='));
  assert.notEqual(notificationTargetKey(row),notificationTargetKey({...row,kind:'schedule_replacement_request',fingerprint:`schedule-coverage:retail:${today}:2`}));
});
test('near planning remains visible without a sent notice, but never overrides urgent tasks or receipt issues',()=>{
  const items=scheduleAttentionItems({userId:2,department:'retail',today,dated:[],entries:[],vacations:[]});
  assert.equal(items.length,1);
  const workday={workDay:{status:'active',date:today},shiftControl:{run:{date:today,status:'active'},tasks:[{id:9,title:'Пересчитать наличные',category:'cash',status:'pending',sortOrder:1,plannedTimeMinutes:600}]}};
  const now=new Date(`${today}T12:00:00+03:00`);
  assert.equal(employeeActionReminder(workday,items,now)?.id,'task:9');
  assert.equal(employeeActionReminder(workday,[...items,{...items[0],id:'receipt:1',kind:'receipt',priority:0}],now)?.id,'receipt:1');
});
test('a real replacement request stays separate from near-plan filling; an unknown distant date is never a new fill obligation',()=>{
  const base={userId:2,department:'retail',today,dated:[{date:'2026-11-05',notice:{id:11,kind:'schedule_replacement_request',title:'',readAt:null}}],entries:[{date:'2026-11-05',userId:2,status:'off',user:{name:'Пример'}},{date:'2026-11-05',userId:3,status:'working',user:{name:'Коллега'}}],vacations:[]};
  assert.deepEqual(scheduleAttentionItems(base).map(i=>i.id),[`schedule-plan:${today}`,'schedule:2026-11-05']);
  base.entries.splice(0,1);
  assert.deepEqual(scheduleAttentionItems(base).map(i=>i.id),[`schedule-plan:${today}`]);
});
