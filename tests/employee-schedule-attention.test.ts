import assert from 'node:assert/strict';
import test from 'node:test';
import { scheduleAttentionItems } from '../lib/employee-schedule-attention';
import { employeeActionReminder } from '../lib/employee-action-reminder';
import { employeeAttentionIconKind, employeeReminderIconKind } from '../lib/employee-notice-icons';
const base = () => ({ userId: 2, department: 'retail', today: '2026-10-23', dated: [{ date: '2026-10-27', notice: { id: 1, kind: 'schedule_replacement_request', title: 'Сможете выйти 27 октября?', readAt: null as Date | null } }], entries: [{ date: '2026-10-27', userId: 3, status: 'working', user: { name: 'Пример Магомед' } }, { date: '2026-10-27', userId: 2, status: 'off', user: { name: 'Пример Милана' } }, {date:'2026-10-23',userId:2,status:'off',user:{name:'Пример Милана'}}, {date:'2026-10-24',userId:2,status:'off',user:{name:'Пример Милана'}}], vacations: [] as Array<{userId:number;dateFrom:string;dateTo:string}> });
test('reading preserves the request and its cross-tab reminder', () => {
 const data=base(); const before=scheduleAttentionItems(data).filter(i=>i.scheduleAction==='replacement'); data.dated[0].notice.readAt=new Date(); const after=scheduleAttentionItems(data).filter(i=>i.scheduleAction==='replacement');
 assert.equal(after.length,1); assert.deepEqual(after[0].notificationIds,[]); assert.deepEqual(after[0].actions,before[0].actions);
 const reminder=employeeActionReminder(null,after)!; assert.equal(reminder.target,'attention'); assert.match(reminder.href,/attention=schedule/); assert.equal(employeeReminderIconKind(reminder),'schedule'); assert.equal(employeeAttentionIconKind('schedule'),'schedule');
});
test('past dates, vacation, own working and restored coverage retire the action', () => {
 for(const variant of ['past','vacation','working','covered']) { const data=base();
 if(variant==='past')data.today='2026-10-28';
 if(variant==='vacation')data.vacations=[{userId:2,dateFrom:'2026-10-26',dateTo:'2026-10-28'}];
 if(variant==='working')data.entries[1].status='working';
 if(variant==='covered')data.entries.push({...data.entries[0],userId:4});
 assert.equal(scheduleAttentionItems(data).filter(i=>i.scheduleAction==='replacement').length,0,variant);
 }
});
test('unknown future day does not create a replacement request, not a dated replacement question',()=>{
 const data=base(); data.entries.splice(1,1); assert.equal(scheduleAttentionItems(data).length,0);
 data.entries.push({date:'2026-10-27',userId:2,status:'off',user:{name:'Пример Милана'}});data.dated[0].notice.kind='schedule_fill_request';assert.equal(scheduleAttentionItems(data).length,0);
});
test('calendar questions do not overtake receipts and payable requests',()=>{
 const schedule=scheduleAttentionItems(base())[0];
 for(const kind of ['receipt','cash'] as const){const other={...schedule,id:kind,kind,priority:1};assert.equal(employeeActionReminder(null,[schedule,other])?.id,kind);}
});
test('a due checklist stays above a future schedule question on other tabs',()=>{
 const items=scheduleAttentionItems(base());const day={workDay:{date:'2026-10-23',status:'active'},shiftControl:{run:{date:'2026-10-23',status:'active'},tasks:[{id:7,title:'Пересчитать кассу',category:'cash',status:'pending',sortOrder:1,plannedTimeMinutes:9*60}]}};
 assert.equal(employeeActionReminder(day,items,new Date('2026-10-23T07:00:00Z'))?.id,'task:7');day.shiftControl.tasks[0].status='done';assert.equal(employeeActionReminder(day,items,new Date('2026-10-23T07:00:00Z'))?.id,items[0].id);
});
