import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuditTimeline } from '../lib/employee-audit-timeline';
import { buildActivityView } from '../lib/employee-activity-view';
import type { EmployeeActivityReport } from '../lib/employee-activity-report';
const at = (t:string) => new Date(`2026-10-26T${t}:00+03:00`);
const n = {id:1,title:'Принять кассу',body:'Пересчитайте наличные',kind:'task',fingerprint:'task:1',taskId:5,issueId:null,reviewId:null,sentAt:at('11:00'),pushDeliveredAt:at('11:00')};
const event = (id:string,stage:string,t:string,target='notification',ref='1') => ({id,kind:'interaction',section:'notifications',notificationId:null,createdAt:at(t),context:{target,ref,stage}});
const report = (overrides: Partial<EmployeeActivityReport> = {}): EmployeeActivityReport => ({date:'2026-10-26',checkedAt:at('13:00').toISOString(),startedAt:at('08:00').toISOString(),retentionDays:90,truncated:false,shift:{status:'active',startedAt:at('10:00').toISOString(),endedAt:null},sections:[],obligations:[],episodes:[],audit:[],...overrides});
test('repeated reminders are one case; provider acceptance is not shown or opened',()=>{
 const audit=buildAuditTimeline([], [n,{...n,id:2,sentAt:at('11:15'),pushDeliveredAt:null},{...n,id:3,sentAt:at('11:30'),pushDeliveredAt:null}],'2026-10-26');
 const v=buildActivityView(report({audit}));
 assert.equal(v.notices.length,1);assert.equal(v.notices[0].sent.length,3);
 assert.equal(v.notices[0].pushAccepted.length,1);assert.equal(v.notices[0].shown.length,0);assert.equal(v.notices[0].opened.length,0);assert.equal(v.notices[0].completed,false);
 assert.equal(v.saved.length,0);
});
test('show, explicit open, answer and system completion remain separate',()=>{
 const audit=buildAuditTimeline([event('s','shown','11:01'),event('o','open','11:02'),event('a','accepted','11:03'),event('cash','shown','11:04','cash','a')],[n],'2026-10-26');
 let v=buildActivityView(report({audit}));assert.equal(v.notices[0].shown.length,1);assert.equal(v.notices[0].opened.length,1);assert.equal(v.notices[0].completed,false);
 const resolved=buildAuditTimeline([],[n],'2026-10-26',[{id:'handover:5',title:n.title,result:'Задача выполнена',at:at('11:47').toISOString()}]);
 v=buildActivityView(report({audit:resolved}));assert.equal(v.notices[0].completed,true);assert.equal(v.notices[0].opened.length,0);
 assert.equal(v.rows.at(-1)?.place,'Рабочий день');assert.equal(v.rows.at(-1)?.origin,'system');
});
test('saved workday, task, schedule and cash facts are restored without counting tasks twice',()=>{
 const audit=buildAuditTimeline([],[n],'2026-10-26',[{id:'handover:5',title:n.title,result:'Задача выполнена',at:at('11:47').toISOString()}]);
 const events=['start:1','task:5','schedule:1','cash:1'].map((id,i)=>({id,section:'day' as const,at:at(i===1?'11:47':'10:00').toISOString(),title:id,note:'Запись портала',visit:false}));
 const v=buildActivityView(report({audit,sections:[{id:'day',label:'Рабочий день',visits:0,actions:4,lastAt:at('11:47').toISOString(),events}]}));
 assert.equal(v.saved.length,4);assert.equal(v.rows.filter(r=>r.id==='saved:task:5').length,0);
 assert.ok(v.rows.find(r=>r.id==='saved:cash:1')?.note?.includes('Автор действия'));
});
test('old notice opened today is not reported as sent today; current result keeps its date',()=>{
 const old={...n,sentAt:at('11:00'),pushDeliveredAt:at('11:00')};old.sentAt=new Date('2026-10-25T08:00:00Z');
 const audit=buildAuditTimeline([event('o','open','11:02')],[old],'2026-10-26');
 const v=buildActivityView(report({audit,obligations:[{id:1,auditKey:'handover:5',title:n.title,body:n.body,sentAt:old.sentAt.toISOString(),openedAt:null,legacyReadAt:at('11:01').toISOString(),push:'',result:'Задача выполнена',resultAt:at('12:00').toISOString(),note:'',attention:null,reason:'',sourceAt:null}]}));
 assert.equal(v.notices[0].sent.length,0);assert.equal(v.notices[0].opened.length,1);assert.equal(v.notices[0].resultAt,at('12:00').toISOString());
});
test('auto read is not opening, and visits are not saved results',()=>{
 const visit={...event('v','open','11:02'),kind:'visit',section:'day'};
 const audit=buildAuditTimeline([visit],[n],'2026-10-26');
 const v=buildActivityView(report({audit,obligations:[{id:1,auditKey:'handover:5',title:n.title,body:n.body,sentAt:n.sentAt.toISOString(),openedAt:at('12:00').toISOString(),legacyReadAt:at('11:01').toISOString(),push:'',result:'Выполнение не подтверждено',resultAt:null,note:'',attention:'unknown',reason:'',sourceAt:null}]}));
 assert.equal(v.notices[0].opened.length,0);assert.equal(v.visits.length,1);assert.equal(v.saved.length,0);
 assert.equal(v.lastContact,at('11:02').toISOString());
});
test('empty and incomplete reports do not fabricate results',()=>{
 for(const truncated of [false,true]) {const v=buildActivityView(report({truncated}));assert.equal(v.rows.length,0);assert.equal(v.notices.length,0);assert.equal(v.lastContact,null);}
});
test('handover completion from two evidence paths appears once',()=>{
 const result={id:'handover:5',title:n.title,result:'Задача выполнена',at:at('12:00').toISOString()};
 const audit=buildAuditTimeline([],[n],'2026-10-26',[result,result]);
 assert.equal(buildActivityView(report({audit})).saved.length,1);
});
test('error shows later saved answer for the same object, never another task',()=>{
 const audit=buildAuditTimeline([event('e','error','11:01'),event('other','accepted','11:02','issue','90'),event('ok','accepted','11:03')],[n],'2026-10-26');
 const v=buildActivityView(report({audit}));
 assert.deepEqual(v.problems[0].followUp,{at:at('11:03').toISOString(),label:'Ответ сохранён'});
 assert.equal(v.notices[0].completed,false);
});
test('equal timestamps preserve recorded order rather than sorting IDs',()=>{
 const audit=buildAuditTimeline([event('z-click','submit','11:01'),event('a-error','error','11:01')],[n],'2026-10-26');
 const v=buildActivityView(report({audit}));
 assert.ok(v.rows.findIndex(r=>r.id.endsWith('z-click')) < v.rows.findIndex(r=>r.id.endsWith('a-error')));
});
test('overview prioritizes unconfirmed results, not recovered errors',()=>{
 const audit=buildAuditTimeline([event('e','error','11:01'),event('ok','accepted','11:03')],[n],'2026-10-26');
 const v=buildActivityView(report({audit}));
 assert.equal(v.pending.length,1);assert.equal(v.unresolvedProblems.length,0);assert.equal(v.recoveredProblems.length,1);
 assert.equal(v.overview.attention,true);assert.match(v.overview.text,/без подтверждённого результата: 1/);
});
test('completed case with an earlier error is quiet, but another unresolved error is not hidden',()=>{
 const result={id:'handover:5',title:n.title,result:'Задача выполнена',at:at('12:00').toISOString()};
 const audit=buildAuditTimeline([event('e','error','11:01')],[n],'2026-10-26',[result]);
 const v=buildActivityView(report({audit}));
 assert.equal(v.pending.length,0);assert.equal(v.completedNotices.length,1);assert.equal(v.overview.attention,false);
 assert.match(v.overview.text,/успешное сохранение/);
 const mixed=buildActivityView(report({audit:buildAuditTimeline([event('e','error','11:01'),event('other','error','11:02','issue','90')],[n],'2026-10-26',[result])}));
 assert.equal(mixed.unresolvedProblems.length,1);assert.equal(mixed.overview.attention,true);
});
test('empty overview does not claim successful work or no problems',()=>{
 const v=buildActivityView(report());assert.equal(v.overview.title,'За день пока нет записей');
 assert.match(v.overview.text,/нельзя судить/);
});
