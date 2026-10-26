import test from 'node:test';
import assert from 'node:assert/strict';
import {readOperationContext} from '../lib/employee-operation-policy';
import {parseActivityInput} from '../lib/employee-activity-policy';
import {buildAuditTimeline} from '../lib/employee-audit-timeline';
import {buildProcessView,filterProcessView,elapsed} from '../lib/employee-process-view';
import type {EmployeeActivityReport} from '../lib/employee-activity-report';
const at=(s:number)=>new Date(Date.UTC(2026,9,26,9,0,s));
const event=(action:string,stage:string,s:number,extra:Record<string,unknown>={})=>({id:`${action}-${stage}-${s}`,kind:'operation',section:'day',notificationId:null,createdAt:at(s),context:{action,stage,attemptId:'attempt-12345',...extra}});
const report=(audit:ReturnType<typeof buildAuditTimeline>,extra:Partial<EmployeeActivityReport>={}):EmployeeActivityReport=>({audit,date:'2026-10-26',checkedAt:at(3600).toISOString(),startedAt:at(0).toISOString(),retentionDays:90,truncated:false,shift:{status:'active',startedAt:null,endedAt:null},sections:[],episodes:[],obligations:[],...extra});
test('long intervals use days and hours instead of thousands of minutes',()=>{
 assert.equal(elapsed(500),'меньше секунды');assert.equal(elapsed(2100),'2 с');
 assert.equal(elapsed(121000),'2 мин 1 с');assert.equal(elapsed(3600000),'1 ч');
 assert.equal(elapsed(2739*60000+21000),'1 д 21 ч 39 мин');assert.equal(elapsed(86400000),'1 д');
});
test('financial confirmation explanation is only shown for cash, not schedule or payroll',()=>{
 const audit=buildAuditTimeline([event('schedule_save','completed',1,{period:'2026-10-27'}),event('payroll_load','completed',2,{period:'2026-10'}),event('cash_send','completed',3,{ref:'cash-key-123'})],[],'2026-10-26');
 assert.equal(audit.find(e=>e.id==='schedule:2026-10')?.steps[0].note,undefined);
 assert.equal(audit.find(e=>e.id==='payroll:2026-10')?.steps[0].note,undefined);
 assert.match(audit.find(e=>e.id==='encashment:cash-key-123')?.steps[0].note||'',/не означает проведение в 1С/);
});
test('operation whitelist rejects raw data, fake system results and invalid dates',()=>{
 const c={action:'payroll_load',stage:'completed',attemptId:'attempt-12345',period:'2026-10',durationMs:520};
 assert.ok(readOperationContext(c));assert.ok(parseActivityInput({key:'event-12345',kind:'operation',context:c}));
 for(const patch of [{amount:500},{message:'secret'},{stage:'posted'},{period:'2026-02-31'},{durationMs:-1},{ref:'unrelated'},{stage:'queued'},{action:'payroll_view'}])assert.equal(readOperationContext({...c,...patch}),null);
});
test('cash retry and server posting are one operation; client completion alone is not posted',()=>{
 const audit=buildAuditTimeline([event('cash_send','started',0,{ref:'cash-key-123'}),event('cash_send','queued',5,{ref:'cash-key-123',durationMs:5000}),event('cash_send','started',60,{ref:'cash-key-123',attemptId:'attempt-67890'}),event('cash_send','completed',64,{ref:'cash-key-123',attemptId:'attempt-67890',durationMs:4000})],[],'2026-10-26');
 let rows=buildProcessView(report(audit));assert.equal(rows.length,1);assert.equal(rows[0].confirmed,false);assert.match(rows[0].summary.join(' '),/Попыток отправки: 2/);assert.equal(rows[0].hasProblems,true);assert.equal(rows[0].unresolved,false);
 rows=buildProcessView(report(audit,{cashEvidence:[{key:'cash-key-123',at:at(62).toISOString(),postedAt:at(63).toISOString(),document:'123',status:'posted'}]}));
 assert.equal(rows.length,1);assert.equal(rows[0].confirmed,true);assert.match(rows[0].outcome,/1С/);
});
test('payroll counts actual views, not load retries, and distinguishes later success',()=>{
 const audit=buildAuditTimeline([event('payroll_view','started',0,{period:'2026-10'}),event('payroll_load','started',0,{period:'2026-10'}),event('payroll_load','failed',15,{period:'2026-10',durationMs:15000}),event('payroll_load','completed',30,{period:'2026-10',durationMs:2000})],[],'2026-10-26');
 const [row]=buildProcessView(report(audit));assert.equal(row.visits,1);assert.equal(row.unresolved,false);assert.match(row.summary.join(' '),/Обновление: 2 с/);assert.equal(row.confirmed,false);
});
test('workday visits are hidden; unknown historical payroll period is not guessed',()=>{
 const visit=(section:string,s:number)=>({...event('x','x',s),kind:'visit',section});
 const audit=buildAuditTimeline([visit('day',0),visit('day',60),visit('payroll',120),visit('payroll',300)],[],'2026-10-26');
 const rows=buildProcessView(report(audit));assert.equal(rows.length,1);assert.equal(rows[0].visits,2);assert.match(rows[0].outcome,/не записаны/);
});
test('legacy visits are not assigned to a known period or merged by timestamp alone',()=>{
 const audit=buildAuditTimeline([{...event('x','x',0),kind:'visit',section:'payroll'},event('payroll_view','started',0,{period:'2026-10'}),{...event('x','x',600),kind:'visit',section:'payroll'}],[],'2026-10-26');
 const rows=buildProcessView(report(audit));assert.equal(rows.reduce((sum,r)=>sum+r.visits,0),3);assert.equal(rows.find(r=>r.id==='visits:payroll')?.visits,2);
});
test('schedule month collects saved changes but cannot hide a failed later save',()=>{
 const audit=buildAuditTimeline([event('schedule_view','started',0,{period:'2026-10'}),event('schedule_save','completed',10,{period:'2026-10-27',durationMs:500}),event('schedule_save','failed',30,{period:'2026-10-28',durationMs:1000})],[],'2026-10-26');
 const rows=buildProcessView(report(audit,{sections:[{id:'schedule',label:'График',visits:0,actions:1,lastAt:at(10).toISOString(),events:[{id:'schedule:5',section:'schedule',period:'2026-10',at:at(10).toISOString(),title:'27 октября: выходной → рабочий день',note:'Сохранено',visit:false}]}]}));
 assert.equal(rows.length,1);assert.equal(rows[0].confirmed,false);assert.equal(rows[0].unresolved,true);assert.match(rows[0].outcome,/без подтверждённого результата/);assert.ok(rows[0].steps.some(s=>s.label.includes('выходной → рабочий день')));
});
test('empty data never invents no errors or no work',()=>assert.deepEqual(buildProcessView(report([])),[]));
test('notification load failure is understandable without opening details, not claimed as a current outage',()=>{
 const audit=buildAuditTimeline([{id:'notice-error',kind:'interaction',section:'notifications',notificationId:7,createdAt:at(1),context:{target:'notification',ref:'7',stage:'error',message:'load_failed'}}],[],'2026-10-26');
 audit[0].result='Информационное сообщение';
 const [row]=buildProcessView(report(audit));
 assert.equal(row.outcome,'Информационное сообщение');assert.equal(row.confirmed,false);assert.equal(row.unresolved,true);
 assert.equal(row.attentionReason,'Не удалось загрузить уведомление');
 assert.equal(row.summary.some(s=>s.includes('Есть событие без подтверждённого результата')),false);
});
test('later confirmed notification result remains visible and resolves the earlier error',()=>{
 const audit=buildAuditTimeline([{id:'notice-error',kind:'interaction',section:'notifications',notificationId:7,createdAt:at(1),context:{target:'notification',ref:'7',stage:'error',message:'load_failed'}}],[],'2026-10-26',[{id:'notification:7',title:'Проверка',result:'Подтверждено системой',at:at(10).toISOString()}]);
 const [row]=buildProcessView(report(audit));
 assert.equal(row.outcome,'Подтверждено системой');assert.equal(row.confirmed,true);assert.equal(row.unresolved,false);
 assert.equal(row.attentionReason,undefined);
 assert.ok(row.summary.includes('После затруднения получен результат'));
 assert.equal(row.summary.some(s=>s.startsWith('Ошибка при работе')),false);
 assert.ok(row.steps.some(s=>s.label==='Не удалось загрузить данные карточки.'));
});
test('persisted 1C failure stays a problem despite a successful client response',()=>{
 const audit=buildAuditTimeline([event('cash_send','completed',2,{ref:'cash-key-123'})],[],'2026-10-26');
 const [row]=buildProcessView(report(audit,{cashEvidence:[{key:'cash-key-123',at:at(1).toISOString(),postedAt:null,document:null,status:'one_c_error'}]}));
 assert.equal(row.hasProblems,true);assert.equal(row.unresolved,true);assert.equal(row.confirmed,false);assert.match(row.outcome,/Ошибка передачи в 1С/);
 assert.equal(row.steps.some(s=>s.id.startsWith('cash-posted:')),false);
});
test('a later success for another schedule date cannot resolve a failed change',()=>{
 const audit=buildAuditTimeline([event('schedule_save','failed',0,{period:'2026-10-27'}),event('schedule_save','completed',10,{period:'2026-10-28',attemptId:'attempt-other'})],[],'2026-10-26');
 const [row]=buildProcessView(report(audit));assert.equal(row.unresolved,true);assert.match(row.steps[0].label,/27 октября/);
});
test('unmet workday prerequisites are not presented as missing server data',()=>{
 const audit=buildAuditTimeline([event('day_end','failed',0,{period:'2026-10-26',reason:'prerequisite'})],[],'2026-10-26');
 assert.match(audit[0].steps[0].note||'',/обязательные действия/);
 assert.equal(readOperationContext({action:'payroll_load',stage:'failed',attemptId:'attempt-12345',reason:'prerequisite'}),null);
});
test('start result merges into the attempted start without double rows',()=>{
 const audit=buildAuditTimeline([event('day_start','started',0,{period:'2026-10-26'}),event('day_start','completed',1,{period:'2026-10-26',durationMs:1000})],[],'2026-10-26');
 const rows=buildProcessView(report(audit,{sections:[{id:'day',label:'Рабочий день',visits:0,actions:1,lastAt:at(1).toISOString(),events:[{id:'start:1',section:'day',at:at(1).toISOString(),title:'Начало смены',note:'Запись системы',visit:false}]}]}));
 assert.equal(rows.length,1);assert.equal(rows[0].confirmed,true);
});
test('review count counts affected operations, excludes recovered errors, and follows section and search',()=>{
 const audit=buildAuditTimeline([
  event('payroll_load','failed',1,{period:'2026-09'}),event('payroll_load','failed',2,{period:'2026-09'}),
  event('payroll_load','failed',3,{period:'2026-10'}),event('payroll_load','completed',4,{period:'2026-10'}),
  event('schedule_save','failed',5,{period:'2026-10-27'}),
 ],[],'2026-10-26');
 const rows=buildProcessView(report(audit));
 let filtered=filterProcessView(rows,{query:'',section:'all',attentionOnly:true});
 assert.equal(filtered.attentionCount,2);assert.equal(filtered.items.length,2);
 assert.ok(filtered.items.some(r=>r.attentionReason==='Не удалось загрузить зарплату'));
 assert.equal(filtered.items.some(r=>r.id==='payroll:2026-10'),false);
 filtered=filterProcessView(rows,{query:'',section:'payroll',attentionOnly:true});
 assert.equal(filtered.attentionCount,1);assert.equal(filtered.items[0].id,'payroll:2026-09');
 filtered=filterProcessView(rows,{query:' СОХРАНЕНИЕ ГРАФИКА ',section:'all',attentionOnly:true});
 assert.equal(filtered.attentionCount,1);assert.equal(filtered.items[0].section,'schedule');
 assert.equal(filterProcessView(rows,{query:'',section:'all',attentionOnly:false}).items.length,3);
 assert.ok(rows.find(r=>r.id==='payroll:2026-10')?.steps.some(s=>s.stage==='failed'));
});
test('ordinary waiting and confirmation prompts do not create review counts',()=>{
 const audit=buildAuditTimeline([
  event('schedule_save','confirmation',1,{period:'2026-10-27'}),event('cash_send','started',2,{ref:'cash-key-123'}),
 ],[],'2026-10-26');
 const rows=buildProcessView(report(audit));
 assert.equal(filterProcessView(rows,{query:'',section:'all',attentionOnly:true}).attentionCount,0);
 assert.equal(rows[0].outcome,'Ожидает подтверждения изменения');
 assert.equal(rows.some(r=>r.attentionReason),false);
});
test('unopened informational notification and legacy missing detail are not employee problems',()=>{
 const audit=buildAuditTimeline([], [{id:7,title:'Сообщение',body:'Информация',kind:'info',fingerprint:'info:7',sentAt:at(1),taskId:null,issueId:null,reviewId:null,pushDeliveredAt:null}],'2026-10-26');
 audit[0].result='Информационное сообщение';
 const rows=buildProcessView(report(audit));
 assert.equal(filterProcessView(rows,{query:'',section:'all',attentionOnly:true}).attentionCount,0);
 assert.equal(filterProcessView([],{query:'',section:'all',attentionOnly:true}).attentionCount,0);
});
test('payroll unavailable differs from a failed load; queued cash is explicit; persisted error remains counted',()=>{
 const audit=buildAuditTimeline([
  event('payroll_load','failed',1,{period:'2026-09',reason:'unavailable'}),
  event('cash_send','queued',2,{ref:'cash-offline-123'}),
 ],[],'2026-10-26');
 const rows=buildProcessView(report(audit,{cashEvidence:[{key:'cash-server-123',at:at(3).toISOString(),postedAt:null,document:null,status:'one_c_error'}]}));
 assert.equal(rows[0].attentionReason,'Расчёт зарплаты пока недоступен');
 assert.equal(rows[1].attentionReason,'Инкассация осталась на телефоне');
 assert.equal(rows[2].attentionReason,'Ошибка передачи в 1С — нужна проверка');
 assert.equal(filterProcessView(rows,{query:'',section:'all',attentionOnly:true}).attentionCount,3);
});
