import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuditTimeline, type AuditStep, type ActivitySource } from '../lib/employee-audit-timeline';
import type { EmployeeActivityReport, ActivityObligation } from '../lib/employee-activity-report';
import { managerActivity, humanActivityHistory, humanActivityLabel, matchesActivity, latestActivityText } from '../lib/employee-activity-presentation';
const at=(s:number)=>new Date(Date.UTC(2026,10,8,9,0,s)).toISOString();
const source=(id:string,kind:ActivitySource['kind']='employee_account'):ActivitySource=>({id,label:kind==='owner_check'?'Mac Бэлы':'iPhone · Safari',browserCode:'browser-'+id,kind});
const report=(patch:Partial<EmployeeActivityReport>={}):EmployeeActivityReport=>({date:'2026-11-08',checkedAt:at(100),startedAt:at(-100),retentionDays:90,truncated:false,shift:{status:'active',startedAt:at(-10),endedAt:null},sections:[],obligations:[],episodes:[],audit:[],...patch});
const step=(id:string,s:number,extra:Partial<AuditStep>={}):AuditStep=>({id,at:at(s),label:id,origin:'app',tone:'plain',source:source('a'),...extra});
const episode=(steps:AuditStep[],extra:Record<string,unknown>={})=>({id:'review:one',title:'Чек по кредитной операции',start:steps[0].at,end:steps.at(-1)!.at,steps,notice:'Нужно проверить чек.',visits:false,unopened:false,...extra});
const obligation=(patch:Partial<ActivityObligation>={}):ActivityObligation=>({id:1,auditKey:'review:one',title:'Чек по кредитной операции',body:'Нужно проверить чек.',sentAt:at(0),openedAt:null,legacyReadAt:null,push:'',result:'Выполнение не подтверждено',resultAt:null,note:'По последней сохранённой проверке вопрос остаётся открытым.',attention:'employee',reason:'Сотрудник ещё на смене; просрочка не установлена.',sourceAt:at(1),...patch});
const context={id:'review:one',title:'Проверить чек',section:'notifications' as const,unresolved:false};

test('one opening has one human action while retaining both exact source records',()=>{
 const raw=[step('open',1,{opened:'notification'}),step('card',1.2,{opened:'card'})];
 const rows=humanActivityHistory(raw,context);assert.equal(rows.length,1);assert.equal(rows[0].label,'Открыл сообщение');assert.deepEqual(rows[0].raw,raw);
});
test('separate browsers, unknown sources, distant and repeated openings are never collapsed',()=>{
 for(const second of [step('card',1.2,{opened:'card',source:source('b')}),step('card',3,{opened:'card'}),step('open-again',1.2,{opened:'notification'})])assert.equal(humanActivityHistory([step('open',1,{opened:'notification'}),second],context).length,2);
 assert.equal(humanActivityHistory([step('open',1,{opened:'notification',source:undefined}),step('card',1.1,{opened:'card',source:undefined})],context).length,2);
 const twice=[step('open1',1,{opened:'notification'}),step('card1',1.1,{opened:'card'}),step('open2',5,{opened:'notification'}),step('card2',5.1,{opened:'card'})];
 const human=humanActivityHistory(twice,context);assert.equal(human.length,2);assert.equal(human.flatMap(h=>h.raw).length,4);
});
test('repeated notification opens remain unfinished work and time explicitly means latest opening',()=>{
 const data=report({audit:[episode([step('sent',0,{origin:'system',source:undefined,stage:'sent',target:'notification'}),step('open1',2,{opened:'notification'}),step('open2',5,{opened:'notification'})])],obligations:[obligation()]});
 const view=managerActivity(data),row=view.rows[0];assert.equal(row.status,'unknown');assert.equal(row.openings.length,2);assert.equal(view.counts.result,0);assert.equal(row.time.label,'открыто');assert.equal(row.time.at,at(5));assert.match(row.result,/После последнего открытия проверка результата не записана/);assert.equal(row.resultCheck,'before_opening');assert.equal(view.counts.question,0);assert.equal(view.counts.unknown,1);assert.match(row.push.label,/не подтверждено/);assert.equal(row.obligation?.sourceAt,at(1));
});
test('information with no open is not a failed task, and legacy readAt cannot manufacture an opening',()=>{
 const row=managerActivity(report({audit:[episode([step('shown',2,{target:'notification',stage:'shown'})])],obligations:[obligation({result:'Информационное сообщение',legacyReadAt:at(3),attention:null})]})).rows[0];
 assert.equal(row.status,'observed');assert.equal(row.openings.length,0);assert.equal(row.time.label,'показано');assert.match(row.result,/открытие не записано/);
});
test('provider acceptance is not device receipt, display or reading',()=>{
 const row=managerActivity(report({audit:[episode([step('sent',0,{origin:'system',source:undefined,stage:'sent',target:'notification',pushAcceptedAt:at(1)})])]})).rows[0];
 assert.match(row.push.label,/получение неизвестно/);assert.equal(row.push.source,undefined);assert.equal(row.openings.length,0);assert.equal(row.item.confirmed,false);
});
test('device receipt and display request identify exactly that connection without proving an OS banner',()=>{
 const row=managerActivity(report({audit:[episode([step('recv',1,{target:'push_delivery',stage:'received'}),step('display',2,{target:'push_delivery',stage:'display_requested'})])]})).rows[0];
 assert.equal(row.push.label,'Получен устройством');assert.equal(row.push.source?.id,'a');assert.match(row.push.explanation,/баннера ОС и прочтение не установлены/);assert.equal(row.openings.length,0);assert.notEqual(row.status,'result');
});
test('push tap is not a successfully opened in-app message',()=>{
 const row=managerActivity(report({audit:[episode([step('click',2,{target:'push_delivery',stage:'clicked'})])]})).rows[0];
 assert.match(row.push.label,/нажатие/);assert.equal(row.openings.length,0);assert.equal(row.item.confirmed,false);
});
test('business completion cannot clear a push display failure, but a later same-device display request can',()=>{
 const failure=step('failed',1,{target:'push_delivery',stage:'display_failed',tone:'error'});
 const done=step('result:review:one',4,{origin:'system',source:undefined,tone:'success',label:'Вопрос закрыт'});
 const data=report({audit:[episode([failure,done])],obligations:[obligation({result:'Вопрос закрыт',resultAt:at(4),attention:null})]});
 assert.equal(managerActivity(data).rows[0].status,'difficulty');
 data.audit![0].steps.push(step('other-display',5,{target:'push_delivery',stage:'display_requested',source:source('b')}));assert.equal(managerActivity(data).rows[0].status,'difficulty');
 data.audit![0].steps.push(step('own-display',6,{target:'push_delivery',stage:'display_requested'}));assert.equal(managerActivity(data).rows[0].status,'result');
});
test('missing fresh business evidence needs information, not blame or an invented current problem',()=>{
 const row=managerActivity(report({audit:[episode([step('sent',0,{origin:'system',source:undefined,stage:'sent',target:'notification'})])],obligations:[obligation({attention:'unknown',note:'Источник устарел.'})]})).rows[0];
 assert.equal(row.status,'unknown');assert.match(row.nextStep||'',/свежие сведения/);assert.doesNotMatch(row.result,/просроч|не выполнил/);
});
test('labelled saved time and distinct dates preserve repeated schedule history',()=>{
 const fact=(id:number,date:string,s:number)=>({id:`schedule:${id}`,section:'schedule' as const,period:'2026-11',scheduleDate:date,at:at(s),title:`График ${date}`,note:'Сохранено',visit:false});
 const data=report({sections:[{id:'schedule',label:'График',visits:0,actions:3,lastAt:at(30),events:[fact(3,'2026-11-10',30),fact(2,'2026-11-09',20),fact(1,'2026-11-09',10)]}]});
 const row=managerActivity(data).rows[0];assert.equal(row.status,'result');assert.match(row.result,/2 даты · 9–10 ноября/);assert.equal(row.item.steps.length,3);assert.deepEqual(row.time,{at:at(30),label:'сохранено'});assert.doesNotMatch(row.result,/месяц заполнен/);
});
test('a later failed save has its own timestamp and does not hide earlier saved facts',()=>{
 const events=[{id:'failed-save',kind:'operation',section:'schedule',notificationId:null,sessionId:'a',source:source('a'),createdAt:new Date(at(40)),context:{action:'schedule_save',stage:'failed',period:'2026-11-10',attemptId:'attempt-failed'}}];
 const data=report({audit:buildAuditTimeline(events,[],'2026-11-08'),sections:[{id:'schedule',label:'График',visits:0,actions:1,lastAt:at(30),events:[{id:'schedule:1',section:'schedule',period:'2026-11',scheduleDate:'2026-11-09',at:at(30),title:'График 9 ноября сохранён',note:'Сохранено',visit:false}]}]});
 const row=managerActivity(data).rows[0];assert.equal(row.status,'difficulty');assert.equal(row.time.at,at(40));assert.equal(row.time.label,'затруднение');assert.ok(row.history.some(h=>h.raw.some(s=>s.id==='fact:schedule:1')));
});
test('payroll loads are views, not saved work; latest action ignores a later automatic request and background',()=>{
 const event=(id:string,action:string,stage:string,s:number)=>({id,kind:'operation',section:'payroll',notificationId:null,createdAt:new Date(at(s)),sessionId:'a',source:source('a'),context:{action,stage,period:'2026-11',attemptId:'attempt-'+id}});
 const audit=buildAuditTimeline([event('view','payroll_view','started',1),event('load','payroll_load','completed',10),{id:'bg',kind:'experience',section:'day',notificationId:null,createdAt:new Date(at(20)),sessionId:'a',source:source('a'),context:{target:'workflow',action:'app',stage:'background',attemptId:'background-123'}}],[],'2026-11-08');
 const view=managerActivity(report({audit}));assert.equal(view.rows[0].status,'observed');assert.equal(view.counts.result,0);assert.equal(view.latest?.at,at(1));assert.match(latestActivityText(view.latest!),/зарплату/);assert.equal(view.chronology.some(h=>h.raw.some(s=>s.id==='bg')),true);
 assert.equal(humanActivityLabel(step('load',1,{target:'payroll_load',stage:'completed'}),'Зарплата'),'Данные зарплаты загрузились');
});
test('source selection recomputes difficulty and never inherits another browser failure',()=>{
 const events=[{id:'error-a',kind:'operation',section:'payroll',notificationId:null,createdAt:new Date(at(1)),sessionId:'a',source:source('a'),context:{action:'payroll_load',stage:'failed',period:'2026-11',attemptId:'attempt-error'}},{id:'good-b',kind:'operation',section:'payroll',notificationId:null,createdAt:new Date(at(2)),sessionId:'b',source:source('b'),context:{action:'payroll_load',stage:'completed',period:'2026-11',attemptId:'attempt-good'}}];
 const data=report({audit:buildAuditTimeline(events,[],'2026-11-08')});
 assert.equal(managerActivity(data).counts.difficulty,1);const selected=managerActivity(data,'b');assert.equal(selected.counts.difficulty,0);assert.equal(selected.rows.length,1);assert.equal(selected.rows[0].item.steps.some(s=>s.source?.id==='a'),false);assert.equal(managerActivity(data,'missing').rows.length,0);
});
test('owner checks remain named and cannot become employee acknowledgement',()=>{
 const event={id:'ack-owner',kind:'work_help_ack',section:'schedule',notificationId:null,createdAt:new Date(at(2)),sessionId:'owner',source:source('owner','owner_check'),context:null};
 const row=managerActivity(report({audit:buildAuditTimeline([event],[],'2026-11-08')})).rows[0];assert.equal(row.ownerCheck,true);assert.match(row.result,/проверке владельцем/);assert.equal(row.history[0].raw[0].source?.label,'Mac Бэлы');
});
test('request response alone has no business completion and statuses are disjoint',()=>{
 const audit=buildAuditTimeline([{id:'response',kind:'experience',section:'procurement',notificationId:null,createdAt:new Date(at(1)),sessionId:'a',source:source('a'),context:{target:'workflow',action:'procurement_payment',stage:'response_received',attemptId:'request-123'}}],[],'2026-11-08');
 const view=managerActivity(report({audit}));assert.equal(view.counts.result,0);assert.equal(view.rows[0].status,'unknown');assert.match(view.rows[0].result,/итог операции не подтверждён/);assert.equal(Object.values(view.counts).reduce((a,b)=>a+b,0),view.rows.length);
 assert.equal(matchesActivity(view.rows[0],'Платёж','procurement',false),true);assert.equal(matchesActivity(view.rows[0],'','procurement',true),false);
});
test('an empty journal neither invents results nor asserts the employee did not work',()=>{
 const view=managerActivity(report());assert.deepEqual(view.rows,[]);assert.equal(view.latest,undefined);assert.equal(Object.values(view.counts).reduce((a,b)=>a+b,0),0);
});

test('task form, validation and saved task are one named history with a real saved outcome',()=>{
 const ev=(id:string,action:string,stage:string,s:number)=>({id,kind:'experience',section:'day',notificationId:null,createdAt:new Date(at(s)),sessionId:'a',source:source('a'),context:{target:'workflow',action,stage,taskId:7,attemptId:'task-flow-123'}});
 const audit=buildAuditTimeline([ev('form','task_form','opened',1),ev('validation','task_save','validation',2),ev('submit','task_save','submit_clicked',3)],[],'2026-11-08');
 const data=report({audit,sections:[{id:'day',label:'Рабочий день',visits:0,actions:1,lastAt:at(4),events:[{id:'task:7',section:'day',at:at(4),title:'Пересчитать кассу',note:'Сохранено',visit:false}]}]});
 const view=managerActivity(data);assert.equal(view.rows.length,1);assert.equal(view.rows[0].item.title,'Пересчитать кассу');assert.equal(view.rows[0].status,'result');assert.equal(view.rows[0].item.steps.length,4);
});
test('a saved task clears its earlier form error but retains error history',()=>{
 const event={id:'task-error',kind:'experience',section:'day',notificationId:null,createdAt:new Date(at(1)),sessionId:'a',source:source('a'),context:{target:'workflow',action:'task_save',stage:'error_shown',taskId:7,attemptId:'task-flow-123'}};
 const data=report({audit:buildAuditTimeline([event],[],'2026-11-08'),sections:[{id:'day',label:'Рабочий день',visits:0,actions:1,lastAt:at(4),events:[{id:'task:7',section:'day',at:at(4),title:'Пересчитать кассу',note:'Сохранено',visit:false}]}]});
 const row=managerActivity(data).rows[0];assert.equal(row.status,'result');assert.ok(row.history.some(h=>h.raw.some(s=>s.tone==='error')));
});
test('cash draft and eventual saved operation correlate by explicit key, not event time',()=>{
 const event={id:'cash-form',kind:'experience',section:'day',notificationId:null,createdAt:new Date(at(1)),sessionId:'a',source:source('a'),context:{target:'workflow',action:'cash_form',stage:'opened',ref:'cash-exact-key-1',attemptId:'cash-form-123'}};
 const data=report({audit:buildAuditTimeline([event],[],'2026-11-08'),cashEvidence:[{key:'cash-exact-key-1',at:at(4),postedAt:at(5),document:'12',status:'posted'}]});
 const row=managerActivity(data).rows[0];assert.equal(managerActivity(data).rows.length,1);assert.equal(row.item.id,'encashment:cash-exact-key-1');assert.equal(row.status,'result');assert.match(row.result,/1С/);assert.ok(row.history.some(h=>h.raw.some(s=>s.ref==='cash-exact-key-1')));
});
test('a later saved different schedule date cannot erase a failed date',()=>{
 const event={id:'save-error',kind:'operation',section:'schedule',notificationId:null,createdAt:new Date(at(1)),sessionId:'a',source:source('a'),context:{action:'schedule_save',stage:'failed',period:'2026-11-10',attemptId:'save-bad-123'}};
 const data=report({audit:buildAuditTimeline([event],[],'2026-11-08'),sections:[{id:'schedule',label:'График',visits:0,actions:1,lastAt:at(4),events:[{id:'schedule:1',section:'schedule',period:'2026-11',scheduleDate:'2026-11-09',at:at(4),title:'График 9 ноября',note:'Сохранено',visit:false}]}]});
 assert.equal(managerActivity(data).rows[0].status,'difficulty');
 data.sections[0].events[0].scheduleDate='2026-11-10';assert.equal(managerActivity(data).rows[0].status,'result');
});

test('validation has a clear next step and is not classified as an application failure or missing source',()=>{
 const ev={id:'validation-alone',kind:'experience',section:'day',notificationId:null,createdAt:new Date(at(1)),sessionId:'a',source:source('a'),context:{target:'workflow',action:'task_save',stage:'validation',taskId:7,attemptId:'task-validate-123'}};
 const row=managerActivity(report({audit:buildAuditTimeline([ev],[],'2026-11-08')})).rows[0];
 assert.equal(row.status,'observed');assert.match(row.result,/Форма не отправлена/);assert.match(row.nextStep||'',/обязательные поля/);assert.equal(row.time.label,'проверка');
});
test('a saved result with an unavailable comparison is not an unqualified green success',()=>{
 const data=report({sections:[{id:'day',label:'Рабочий день',visits:0,actions:1,lastAt:at(1),events:[{id:'task:7',section:'day',at:at(1),title:'Пересчёт кассы · 0',note:'Сохранено, сверка недоступна',visit:false,verification:'unavailable'}]}]});
 let row=managerActivity(data).rows[0];assert.equal(row.item.confirmed,true);assert.equal(row.status,'unknown');assert.match(row.result,/сохранён; сверка с 1С недоступна/);assert.equal(managerActivity(data).counts.result,0);
 data.sections[0].events[0].verification='mismatch';row=managerActivity(data).rows[0];assert.equal(row.status,'question');assert.match(row.result,/расхождение/);
});
test('a later push closure cannot hide an earlier recorded push tap',()=>{
 const row=managerActivity(report({audit:[episode([step('push-tap',1,{target:'push_delivery',stage:'clicked'}),step('push-close',2,{target:'push_delivery',stage:'closed'})])]})).rows[0];assert.equal(row.push.label,'Есть нажатие на push');assert.equal(row.openings.length,0);assert.equal(row.history.length,2);
});
test('journal failures explain recovery without exposing browser text or forcing logout',async()=>{
 const {activityReadFailure}=await import('../lib/employee-activity-live');
 assert.match(activityReadFailure(null),/связаться с журналом/);assert.match(activityReadFailure(null,true),/не ответил вовремя/);
 assert.match(activityReadFailure(401),/повторный вход/);assert.match(activityReadFailure(403),/недоступно для этого входа/);
 for(const status of [null,200,400,401,403,404,500])assert.doesNotMatch(activityReadFailure(status),/Failed|fetch|TypeError|JSON|stack/);
});
test('ordinary recorded workflow gestures are understandable actions, not invented failures or successes',()=>{
 for(const stage of ['submit_clicked','submitted','photo_selected','photo_cancelled','confirmed_choice','cancel_requested','finish_requested','auto_finish','reset_by_app','retry']){
  const ev={id:'gesture-'+stage,kind:'experience',section:'day',notificationId:null,createdAt:new Date(at(1)),sessionId:'a',source:source('a'),context:{target:'workflow',action:'learning',stage,attemptId:'gesture-attempt-123'}};
  const row=managerActivity(report({audit:buildAuditTimeline([ev],[],'2026-11-08')})).rows[0];assert.equal(row.status,'observed',stage);assert.equal(row.item.confirmed,false,stage);assert.doesNotMatch(row.result,/Результат не подтверждён/,stage);
 }
});

test('only a result check after the latest opening can describe an open question after opening',()=>{
 const data=report({audit:[episode([step('open1',2,{opened:'notification'})])],obligations:[obligation({sourceAt:at(3)})]});
 let row=managerActivity(data).rows[0];
 assert.equal(row.status,'question');assert.equal(row.resultCheck,'after_opening');assert.match(row.result,/После последнего открытия вопрос оставался открытым/);
 data.audit![0].steps.push(step('open-again',4,{opened:'notification'}));
 row=managerActivity(data).rows[0];assert.equal(row.status,'unknown');assert.equal(row.resultCheck,'before_opening');assert.equal(row.openings.length,2);
 data.obligations[0].sourceAt=at(5);
 row=managerActivity(data).rows[0];assert.equal(row.status,'question');assert.equal(row.resultCheck,'after_opening');assert.equal(row.obligation?.sourceAt,at(5));
 assert.equal(row.history.length,2);assert.deepEqual(row.history.flatMap(h=>h.raw),data.audit![0].steps);
});
test('equal, missing, invalid and future check times cannot prove a check followed an opening',()=>{
 for(const sourceAt of [at(2),null,'invalid',at(101)]){
  const row=managerActivity(report({audit:[episode([step('open',2,{opened:'notification'})])],obligations:[obligation({sourceAt,attention:'owner'})]})).rows[0];
  assert.equal(row.status,'unknown',String(sourceAt));assert.equal(row.resultCheck,sourceAt===at(2)?'same_time':'unknown');
  assert.doesNotMatch(row.result,/вопрос оставался открытым/);assert.doesNotMatch(row.nextStep||'',/Смена|просроч|помешало/);
 }
});
test('fresh check time alone cannot override an explicitly unknown source state',()=>{
 const row=managerActivity(report({audit:[episode([step('open',2,{opened:'notification'})])],obligations:[obligation({sourceAt:at(3),attention:'unknown'})]})).rows[0];
 assert.equal(row.status,'unknown');assert.match(row.result,/Свежих подтверждений/);assert.doesNotMatch(row.result,/вопрос открыт/);
});
test('case advice uses the explicit relation and never guesses from a message title or the shift',()=>{
 for(const [id,expected] of [['review:one',/появился ли чек в 1С/],['cash:one',/исполнение этой выдачи денег в 1С/],['handover:1',/результат задания/],['issue:1',/результат по вопросу/],['notification:1',/результат по вопросу/]] as const){
  const row=managerActivity(report({audit:[episode([step('open',2,{opened:'notification'})],{id,title:'Любое название: чек / касса / смена'})],obligations:[obligation({auditKey:id,attention:'owner'})]})).rows[0];
  assert.match(row.nextStep||'',expected);assert.doesNotMatch(row.nextStep||'',/Смена завершена|Смена в портале|Проверьте следующий результат/);
  if(id==='notification:1')assert.doesNotMatch(row.nextStep||'',/появился ли чек|выдачи денег/);
 }
});
test('an unopened question does not invent an opening or a post-opening result check',()=>{
 const row=managerActivity(report({audit:[episode([step('sent',0,{origin:'system',source:undefined,stage:'sent',target:'notification'})])],obligations:[obligation()]})).rows[0];
 assert.equal(row.status,'question');assert.equal(row.resultCheck,undefined);assert.equal(row.openings.length,0);assert.equal(row.result,'По последней проверке вопрос открыт');assert.equal(row.time.label,'в кабинете');
});
test('a persisted closed result is preserved even when the message was opened again later',()=>{
 const done=step('result:review:one',3,{origin:'system',source:undefined,tone:'success',label:'Вопрос закрыт'});
 const row=managerActivity(report({audit:[episode([done,step('open',4,{opened:'notification'})])],obligations:[obligation({result:'Вопрос закрыт',resultAt:at(3),sourceAt:at(3),attention:null})]})).rows[0];
 assert.equal(row.status,'result');assert.equal(row.result,'Вопрос закрыт');assert.equal(row.resultCheck,undefined);assert.equal(row.nextStep,undefined);assert.equal(row.openings.length,1);
});
test('check comparisons use exact seconds across dates and preserve browser-scoped openings',()=>{
 const first=step('open-a',2,{opened:'notification'}),second=step('open-b',5,{opened:'notification',source:source('b')});
 const data=report({audit:[episode([first,second])],obligations:[obligation({sourceAt:at(3)})]});
 assert.equal(managerActivity(data).rows[0].status,'unknown');assert.equal(managerActivity(data,'a').rows[0].status,'question');assert.equal(managerActivity(data,'b').rows[0].status,'unknown');
 data.obligations[0].sourceAt='2026-11-07T23:59:59.000Z';assert.equal(managerActivity(data,'a').rows[0].status,'unknown');
});
