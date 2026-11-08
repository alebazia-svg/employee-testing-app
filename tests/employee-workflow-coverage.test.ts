import test from 'node:test';
import assert from 'node:assert/strict';
import {readExperience,workflowResourceKey} from '../lib/employee-experience-policy';
import {observedEmployeeRequest,observedRequest,requestFailure} from '../lib/employee-request-observation';
import {buildAuditTimeline} from '../lib/employee-audit-timeline';
import {managerActivity} from '../lib/employee-activity-presentation';
import type {EmployeeActivityReport} from '../lib/employee-activity-report';
import type {WorkflowFact} from '../lib/employee-workflow-outcomes';
const at=(n:number)=>new Date(Date.UTC(2026,10,8,12,0,n)).toISOString();
const source={id:'employee-browser',label:'Mac Бэлы',browserCode:'preserved-code',kind:'owner_check' as const};
const event=(action:string,stage:string,n:number,extra:Record<string,unknown>={})=>({id:`event-${n}-${stage}`,kind:'experience',section:'learning',createdAt:new Date(at(n)),notificationId:null,sessionId:'session-a',source,context:{target:'workflow',action,stage,attemptId:'request-attempt-123',...extra}});
const report=(events:ReturnType<typeof event>[],facts:WorkflowFact[]=[]):EmployeeActivityReport=>({date:'2026-11-08',checkedAt:at(100),startedAt:at(-100),retentionDays:90,truncated:false,shift:{status:'unknown',startedAt:null,endedAt:null},sections:[],obligations:[],episodes:[],audit:buildAuditTimeline(events,[],'2026-11-08'),workflowFacts:facts});
const fact=(patch:Partial<WorkflowFact>={}):WorkflowFact=>({id:'saved-progress',key:'learning:1',title:'Название аттестации сохранено',section:'learning',at:at(3),label:'Прогресс сохранён; аттестация не завершена',status:'observed',action:'learning',ref:'1',operation:'learning_progress',...patch});
test('only matching bounded workflow metadata is accepted; arbitrary text, answers and forged results are rejected',()=>{
 const base={target:'workflow',action:'learning',stage:'request_failed',attemptId:'attempt-safe-123',ref:'1',operation:'learning_finish',failure:'conflict'};
 assert.ok(readExperience(base));
 for(const patch of [{operation:'payment_edit'},{failure:'private error text'},{answers:{1:2}},{ref:'https://private.test'},{stage:'saved'},{action:'salary_review',operation:'learning_finish'},{ref:'0'}])assert.equal(readExperience({...base,...patch}),null);
 assert.equal(workflowResourceKey('cash_form','draft-id'),null);
});
test('explicit route descriptors separate create, batch, edit, schedule, documents, learning and day-review purposes',()=>{
 const cases=[['/api/procurement/payment-plans','POST','payment_create',undefined],['/api/procurement/payment-plans/batch','POST','payment_create',undefined],['/api/procurement/payment-plans/owned/schedule','PATCH','payment_schedule','owned'],['/api/procurement/payment-plans/owned/documents/file','PATCH','document_change','owned'],['/api/attestations/1/progress','PATCH','learning_progress','1'],['/api/attestations/2/finish','POST','learning_finish','2'],['/api/employee/payroll/day-reviews/own','DELETE','salary_cancel','own']] as const;
 for(const [url,method,operation,ref] of cases){const d=observedRequest(url,{method});assert.equal(d?.operation,operation);assert.equal(d?.ref,ref);}
 for(const url of ['https://other.test/api/procurement/payment-plans','/api/admin/procurement/payment-plans','/api/procurement/payment-plans/own/unknown'])assert.equal(observedRequest(url,{method:'POST'}),null);
 for(const [status,reason] of [[400,'validation'],[422,'validation'],[409,'conflict'],[401,'access'],[403,'access'],[404,'missing'],[503,'unavailable'],[418,'request']] as const)assert.equal(requestFailure(status),reason);
});
test('the observer links a created id through headers without reading or consuming a business response',async()=>{
 const events:any[]=[],response=Response.json({private:'unread business body'},{headers:{'X-Portal-Activity-Ref':'created-id'}});
 const observed=observedEmployeeRequest(async()=>response,(...args)=>events.push(args));
 assert.equal(await observed('/api/procurement/payment-plans',{method:'POST'}),response);assert.equal(response.bodyUsed,false);
 assert.equal(events[0][2].attemptId,events[1][2].attemptId);assert.equal(events[1][2].ref,'created-id');assert.doesNotMatch(JSON.stringify(events),/unread|business body/);
});
test('a successful create binds only the same session and attempt; legacy and unrelated attempts stay separate',()=>{
 const events=[event('procurement_payment','submitted',1,{operation:'payment_create'}),event('procurement_payment','response_received',2,{ref:'created-id',operation:'payment_create'}),event('procurement_payment','submitted',4,{attemptId:'other-attempt-123',operation:'payment_create'}),{...event('procurement_payment','submitted',5,{operation:'payment_create'}),sessionId:'another-session'}];
 const rows=managerActivity(report(events)).rows;assert.equal(rows.length,3);assert.equal(rows.find(r=>r.item.id==='workflow:payment:created-id')?.item.steps.length,2);
});
test('separate learning resources never merge and one final result cannot resolve another exam failure',()=>{
 const data=report([event('learning','request_failed',1,{ref:'1',operation:'learning_finish',failure:'unavailable'}),event('learning','response_received',2,{ref:'2',operation:'learning_finish'})],[fact({id:'passed',key:'learning:2',ref:'2',operation:'learning_finish',status:'result',label:'Аттестация завершена · сдал'})]);
 const rows=managerActivity(data).rows;assert.equal(rows.length,2);assert.equal(rows.find(r=>r.item.id==='workflow:learning:1')?.status,'difficulty');assert.equal(rows.find(r=>r.item.id==='workflow:learning:2')?.status,'result');
});
test('saved progress cannot resolve a finish failure; later saved completion can',()=>{
 const data=report([event('learning','request_failed',1,{ref:'1',operation:'learning_finish',failure:'network'})],[fact()]);
 let row=managerActivity(data).rows[0];assert.equal(row.status,'difficulty');assert.match(row.reason||'',/сети/);
 data.workflowFacts!.push(fact({id:'finished',at:at(4),operation:'learning_finish',status:'question',label:'Аттестация завершена · не сдал'}));
 row=managerActivity(data).rows[0];assert.equal(row.status,'question');assert.match(row.result,/не сдал/);assert.equal(row.time.at,at(4));assert.equal(row.item.steps.some(s=>s.tone==='error'),true);assert.match(row.nextStep||'',/не означает ошибку приложения/);
});
test('progress remains a partial saved result with its exact saved time after later navigation',()=>{
 const row=managerActivity(report([event('learning','response_received',2,{ref:'1',operation:'learning_progress'}),event('learning','next_question',5,{ref:'1',operation:'learning_progress'})],[fact()])).rows[0];
 assert.equal(row.status,'observed');assert.match(row.result,/не завершена/);assert.equal(row.time.at,at(3));assert.equal(row.item.title,'Название аттестации сохранено');assert.equal(row.ownerCheck,true);
});
test('persisted payment approval and documents cannot become proof of payment or completion of a day review',()=>{
 const facts=[fact({id:'payment',key:'payment:plan',title:'Название поставщика',section:'procurement',action:'procurement_payment',ref:'plan',operation:'payment_create',status:'question',label:'Заявка сохранена и передана на согласование'}),fact({id:'days',key:'day-review:days',title:'Выходы · ноябрь',section:'payroll',action:'salary_review',ref:'days',operation:'salary_send',status:'question',label:'Запрос сохранён; решение ожидается'})];
 const rows=managerActivity(report([],facts)).rows;assert.equal(rows.length,2);assert.ok(rows.every(r=>r.status==='question'));assert.equal(rows.find(r=>r.item.section==='payroll')?.item.title,'Выходы · ноябрь');
});
test('viewing a previous saved result is not a new completion today or an application access fault',()=>{
 const data=report([event('learning','request_failed',1,{ref:'1',operation:'learning_start',failure:'access'}),event('learning','completed_view',2,{ref:'1',operation:'learning_load'})]);
 data.workflowContexts=[{key:'learning:1',title:'Прежняя аттестация',priorResult:'Аттестация ранее сдана',priorResultAt:'2026-11-07T12:00:00Z'}];
 const view=managerActivity(data);assert.equal(view.rows[0].status,'observed');assert.equal(view.counts.result,0);assert.match(view.rows[0].result,/ранее сдана/);assert.equal(view.rows[0].time.at,at(2));assert.equal(view.rows[0].time.label,'открыто');assert.equal(view.rows[0].item.title,'Прежняя аттестация');assert.equal(view.rows[0].history.length,2);
 const unproven=managerActivity({...data,workflowContexts:[]}).rows[0];assert.equal(unproven.status,'difficulty');
});
test('a saved receipt cannot hide a failed edit or create proof that the payment was executed',()=>{
 const row=managerActivity(report([event('procurement_payment','request_failed',1,{ref:'plan',operation:'payment_edit',failure:'conflict'})],[fact({key:'payment:plan',title:'Поставщик',section:'procurement',action:'procurement_receipt',ref:'plan',operation:'receipt_upload',status:'result',label:'Документ оплаты сохранён'})])).rows[0];
 assert.equal(row.status,'difficulty');assert.match(row.reason||'',/Данные изменились/);assert.ok(row.history.some(h=>h.label==='Документ оплаты сохранён'));
});
test('a stored reply stays in the original open question and never replaces its business state',()=>{
 const audit=buildAuditTimeline([{id:'shown',kind:'interaction',section:'notifications',createdAt:new Date(at(1)),notificationId:1,sessionId:'session-a',source,context:{target:'review',ref:'review-own',stage:'open'}}],[],'2026-11-08');
 const data={...report([]),audit,obligations:[{id:1,auditKey:'review:review-own',title:'Чек',body:'Чек',sentAt:at(0),openedAt:null,legacyReadAt:null,push:'',result:'Выполнение не подтверждено',resultAt:null,note:'Вопрос остаётся открытым',attention:'employee' as const,reason:'',sourceAt:at(4)}],workflowFacts:[fact({id:'reply',key:'review:review-own',caseKey:'review:review-own',at:at(2),label:'Ответ сохранён; исправление проверяется отдельно',status:'observed',action:undefined,ref:undefined,operation:undefined})]};
 const row=managerActivity(data).rows[0];assert.equal(row.status,'question');assert.match(row.result,/вопрос открыт/);assert.equal(row.history.some(h=>h.label.includes('Ответ сохранён')),true);
});
test('filtering a browser keeps only its own cases and their shared saved source facts',()=>{
 const data=report([event('learning','confirmed_choice',1,{ref:'1',operation:'learning_progress'})],[fact(),fact({id:'other',key:'learning:2',ref:'2',title:'Другая аттестация'})]);
 assert.equal(managerActivity(data,'missing-browser').rows.length,0);const own=managerActivity(data,source.id);assert.equal(own.rows.length,1);assert.equal(own.rows[0].item.title,'Название аттестации сохранено');assert.equal(own.rows[0].history.length,2);
});
test('saving a document cannot hide a still pending approval or pending revision on the same payment',()=>{
 const data=report([],[fact({key:'payment:plan',title:'Поставщик',section:'procurement',action:'procurement_receipt',ref:'plan',operation:'receipt_upload',status:'result',label:'Документ оплаты сохранён'})]);
 data.workflowContexts=[{key:'payment:plan',title:'Имя поставщика сохранено',pending:'Заявка ожидает согласования'}];
 const row=managerActivity(data).rows[0];assert.equal(row.status,'question');assert.match(row.result,/Документ оплаты сохранён.*ожидает согласования/);assert.equal(row.item.title,'Имя поставщика сохранено');
});
test('failure codes come only from the bounded response header; arbitrary diagnostics and timeouts stay safe',async()=>{
 const events:any[]=[];
 const run=(response:Response)=>observedEmployeeRequest(async()=>response,(...args)=>events.push(args))('/api/procurement/payment-plans',{method:'POST'});
 await run(new Response(null,{status:400,headers:{'X-Portal-Activity-Failure':'rate'}}));assert.equal(events.at(-1)[2].failure,'rate');
 await run(new Response(null,{status:400,headers:{'X-Portal-Activity-Failure':'private-arbitrary-data'}}));assert.equal(events.at(-1)[2].failure,'validation');assert.doesNotMatch(JSON.stringify(events),/private-arbitrary/);
 const err=new DOMException('Private timeout detail','TimeoutError');await assert.rejects(observedEmployeeRequest(async()=>{throw err},(...args)=>events.push(args))('/api/procurement/payment-plans',{method:'POST'}),e=>e===err);assert.equal(events.at(-1)[2].failure,'timeout');assert.doesNotMatch(JSON.stringify(events),/Private timeout/);
});
test('request start and reply are one human action with both exact entries; separate attempts remain separate',()=>{
 const data=report([event('learning','submitted',1,{ref:'1',operation:'learning_progress'}),event('learning','response_received',2,{ref:'1',operation:'learning_progress'}),event('learning','submitted',4,{ref:'1',operation:'learning_progress',attemptId:'next-attempt-123'}),event('learning','request_failed',5,{ref:'1',operation:'learning_progress',attemptId:'next-attempt-123',failure:'network'})]);
 const rows=managerActivity(data).rows[0].history;assert.equal(rows.length,2);assert.ok(rows.every(r=>r.raw.length===2));assert.equal(rows[1].raw.some(s=>s.tone==='error'),true);
});
test('validation after saved progress explains why completion did not happen without inventing an app fault',()=>{
 const row=managerActivity(report([event('learning','validation',5,{ref:'1',operation:'learning_finish'})],[fact()])).rows[0];
 assert.equal(row.status,'observed');assert.match(row.result,/Прогресс сохранён.*ответить на все вопросы/);assert.equal(row.time.at,at(5));assert.equal(row.time.label,'проверка');assert.match(row.nextStep||'',/оставшиеся вопросы/);
});
test('automatic section visits do not obscure the detailed action on that browser; other navigation stays meaningful',()=>{
 const selected=event('learning','completed_view',1,{ref:'1',operation:'learning_load'});
 const generic={...event('x','x',1.4),id:'generic-visit',kind:'visit',section:'learning',context:null};
 let view=managerActivity(report([selected,generic] as any));assert.equal(view.latest?.itemId,'workflow:learning:1');assert.equal(view.chronology.find(h=>h.itemId==='visit:generic-visit')?.section,'learning');assert.equal(view.chronology.length,2);
 view=managerActivity(report([selected,{...generic,section:'procurement'}] as any));assert.equal(view.latest?.section,'procurement');
 view=managerActivity(report([selected,{...generic,source:{...source,id:'another-browser'}}] as any));assert.equal(view.latest?.itemId,'visit:generic-visit');
});
test('a later UI fault does not conceal the saved business result on that object',()=>{
 const row=managerActivity(report([event('learning','error_shown',5,{ref:'1',operation:'learning_progress',failure:'response'})],[fact()])).rows[0];assert.equal(row.status,'difficulty');assert.match(row.result,/Также есть сохранённый результат.*Прогресс сохранён/);assert.equal(row.time.label,'затруднение');
});
