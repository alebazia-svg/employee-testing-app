import assert from 'node:assert/strict';
import test from 'node:test';
import { buyerDeadline, cashIssueDeadline, deadlineAt, shiftDeadlines, urgentDeadline, type DecisionShift } from '../lib/admin-inbox-deadlines';
import { digestDue, readDigestState, selectAdminAttention, type AttentionItem } from '../lib/admin-inbox-attention-policy';
const now = new Date('2026-10-12T14:30:00Z'); // 17:30 MSK
const shift: DecisionShift = { id: 1, date: '2026-10-12', startedAt: new Date('2026-10-12T06:00:00Z'), endedAt: null, shiftEndMinutes: 1200, deviations: [], shiftControlRun: { tasks: [{ id: 2, plannedTimeMinutes: 1080, status: 'pending', completedAt: null }] } };
const request = new Date('2026-10-12T14:00:00Z');
test('cash task and selected shift, completed/missing/past shifts, actual early finish', () => {
  assert.equal(urgentDeadline(shiftDeadlines(shift,request,now),now)?.label,'Пересчёт кассы');
  assert.equal(urgentDeadline(shiftDeadlines({...shift,shiftControlRun:null},request,now),now),undefined);
  assert.equal(shiftDeadlines({...shift,date:'2026-10-11'},request,now).length,0);
  assert.equal(shiftDeadlines(null,request,now).length,0);
  assert.equal(urgentDeadline(shiftDeadlines({...shift,deviations:[{requestedEndMinutes:1050}]},request,now),now)?.phase,'due');
  assert.equal(urgentDeadline(shiftDeadlines({...shift,endedAt:now},request,now),now)?.label,'Смена уже завершена');
  assert.equal(shiftDeadlines(shift,new Date('2026-10-12T15:01:00Z'),now).length,1,'old unfinished cash task cannot predate a request');
  assert.equal(shiftDeadlines({...shift,shiftControlRun:{tasks:[{...shift.shiftControlRun!.tasks[0],completedAt:now}]}},request,now).length,1);
});
test('recipient deadline is 18 MSK on request day; issue clock starts no earlier than active shift', () => {
  assert.equal(buyerDeadline(request).at,'2026-10-12T15:00:00.000Z');
  assert.equal(urgentDeadline([buyerDeadline(request)],new Date(+now-1)),undefined);
  assert.equal(urgentDeadline([buyerDeadline(request)],now)?.phase,'upcoming');
  assert.equal(urgentDeadline([buyerDeadline(request)],new Date('2026-10-12T15:00Z'))?.phase,'due');
  assert.equal(cashIssueDeadline(request,now).at,'2026-10-12T15:30:00.000Z');
  assert.equal(deadlineAt('bad',1080),null);
});
const item: AttentionItem = {id:'one',readAt:'read',event:{type:'expense_request.created',sourceType:'expense_request',sourceId:'one',occurredAt:request.toISOString()},meta:{category:'requests'},sourceState:{active:true}};
test('deadline escalations replace summary once each, coalesce five minutes, preserve hourly cadence', () => {
  const urgent = {...item,event:{...item.event,urgency:urgentDeadline([buyerDeadline(request)],now)}};
  const previous = {ids:['one'],repeat:true};
  assert.equal(digestDue({items:[urgent],previous,sentAt:new Date(+now-4*60000),now}),null);
  const first=digestDue({items:[urgent],previous,sentAt:new Date(+now-5*60000),now})!;
  assert.equal(first.repeat,true);
  assert.equal(digestDue({items:[urgent],previous:first,sentAt:now,now:new Date(+now+15*60000)}),null);
  const dueTime=new Date('2026-10-12T15:00Z');
  const due={...urgent,event:{...urgent.event,urgency:urgentDeadline([buyerDeadline(request)],dueTime)}};
  const second=digestDue({items:[due],previous:first,sentAt:now,now:dueTime})!;
  assert.ok(second);
  assert.equal(digestDue({items:[due],previous:second,sentAt:dueTime,now:new Date(+dueTime+5*60000)}),null);
  assert.equal(digestDue({items:[],previous:second,sentAt:now,now:dueTime}),null);
  assert.deepEqual(readDigestState(JSON.stringify(second)),second);
  assert.deepEqual(readDigestState('{"ids":["one"],"repeat":true}'),previous);
  const newer={...item,id:'two',event:{...item.event,sourceId:'two',occurredAt:now.toISOString()}};
  assert.equal(selectAdminAttention([newer,urgent])[0].id,'one','deadline cannot be buried by newest sorting');
});
test('an overdue recount cannot suppress a later approaching shift deadline', () => {
  const recount={key:'count',at:'2026-10-12T13:00:00.000Z',label:'Пересчёт'};
  const end={key:'end',at:'2026-10-12T15:00:00.000Z',label:'Конец смены'};
  const earlier=new Date('2026-10-12T14:10:00Z');
  const before={...item,event:{...item.event,urgency:urgentDeadline([recount,end],earlier)}};
  const state=digestDue({items:[before],previous:{ids:[],repeat:false},sentAt:null,now:earlier})!;
  const after={...item,event:{...item.event,urgency:urgentDeadline([recount,end],now)}};
  assert.ok(digestDue({items:[after],previous:state,sentAt:earlier,now}));
});
