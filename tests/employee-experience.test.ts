import test from 'node:test';
import assert from 'node:assert/strict';
import { readExperience } from '../lib/employee-experience-policy';
import { parseActivityInput } from '../lib/employee-activity-policy';
import { parseEmployeeUiObservation } from '../lib/employee-ui-observation';
import { parseEmployeeScreen } from '../lib/employee-screen-state';
import { buildAuditTimeline } from '../lib/employee-audit-timeline';
import { buildProcessView } from '../lib/employee-process-view';
import { activityMayRefresh,activityRefreshDelay } from '../lib/employee-activity-live';
import type { EmployeeActivityReport } from '../lib/employee-activity-report';
const at=(s:number)=>new Date(Date.UTC(2026,10,8,7,0,s));
const source={id:'session-a',label:'Телефон менеджера',browserCode:'browser-a',kind:'employee_account' as const};
const event=(target:string,stage:string,s:number,extra:Record<string,unknown>={})=>({id:`${target}-${stage}-${s}`,kind:'experience',section:'notifications',notificationId:null,sessionId:source.id,source,createdAt:at(s),context:{target,stage,attemptId:'attempt-12345',...extra}});
const report=(events:any[]):EmployeeActivityReport=>({date:'2026-11-08',checkedAt:at(60).toISOString(),startedAt:at(0).toISOString(),retentionDays:90,truncated:false,shift:{status:'unknown',startedAt:null,endedAt:null},sections:[],audit:buildAuditTimeline(events,[],'2026-11-08'),obligations:[],episodes:[]});
test('experience vocabulary rejects arbitrary text, foreign IDs and forged server acknowledgement',()=>{
 const valid={target:'guide',stage:'automatic_shown',attemptId:'attempt-12345'};
 assert.ok(readExperience(valid));assert.ok(parseActivityInput({key:'event-12345',kind:'experience',context:valid}));
 for(const c of [{...valid,stage:'acknowledged'},{...valid,text:'private'},{...valid,reason:'denied'},{...valid,action:'task_save'},{...valid,attemptId:''},{target:'workflow',action:'task_save',stage:'submitted',attemptId:'attempt-12345',taskId:-1}])assert.equal(readExperience(c),null);
});
test('guide shown, explicit close and saved acknowledgement are separate and visible',()=>{
 const events=[event('guide','automatic_shown',0),event('guide','close_button',3)];
 let row=buildProcessView(report(events))[0];assert.match(row.outcome,/закрыта без подтверждения/);assert.equal(row.confirmed,false);
 events.push({...event('guide','x',4),kind:'work_help_ack',context:{version:'schedule-work-v1',button:'understood'}} as any);
 row=buildProcessView(report(events))[0];assert.match(row.outcome,/Понятно/);assert.equal(row.confirmed,true);assert.equal(row.steps.length,3);
});
test('owner test is preserved and explicitly labelled, never attributed to employee acquaintance',()=>{
 const e={...event('guide','x',1),kind:'work_help_ack',context:{ownerRequestedRepeat:{reason:'owner test'}}};
 const row=buildProcessView(report([e]))[0];assert.match(row.outcome,/владельц/);assert.match(row.steps[0].note||'',/не подтверждает/);
});
test('each connection has its own setup chain; another phone cannot resolve a failure',()=>{
 const a=event('push_setup','failed',0,{reason:'request'});
 const b={...event('push_setup','connected',10),sessionId:'session-b',source:{...source,id:'session-b'}};
 const rows=buildProcessView(report([a,b]));assert.equal(rows.length,2);assert.equal(rows.find(r=>r.unresolved)?.steps[0].source?.id,'session-a');
});
test('denied permission is a browser fact, not a claim of an employee refusal; later connection retains it',()=>{
 const events=[event('push_setup','shown',0),event('push_setup','enable_clicked',1),event('push_setup','permission_denied',2,{reason:'denied'}),event('push_setup','failed',3,{reason:'denied'})];
 let row=buildProcessView(report(events))[0];assert.equal(row.unresolved,true);assert.match(row.attentionReason||'',/запрещены/);assert.doesNotMatch(row.steps.map(s=>s.label).join(' '),/отказал/);
 events.push(event('push_setup','connected',20));row=buildProcessView(report(events))[0];assert.equal(row.unresolved,false);assert.equal(row.steps.length,5);assert.equal(row.confirmed,true);
});
test('repeat notification opens retain times and never establish task completion',()=>{
 const events=[1,10,30].map(s=>({...event('x','x',s),kind:'interaction',context:{target:'notification',ref:'7',stage:'open'}}));
 const data=report(events),row=buildProcessView(data)[0];assert.equal(row.steps.filter(s=>s.opened==='notification').length,3);assert.equal(row.confirmed,false);assert.match(row.summary.join(' '),/Открытий: 3/);
});
test('screen snapshot accepts only known state and never fields or arbitrary dialogs',()=>{
 assert.ok(parseEmployeeScreen({section:'day',dialog:'guide',guideMode:'automatic'}));assert.ok(parseEmployeeScreen({section:'day',dialog:'form',form:'task',taskId:5}));
 for(const s of [{section:'day',text:'draft'},{section:'unknown'},{section:'day',dialog:'notification',notificationId:-1},{section:'day',dialog:'guide',notificationId:5},{section:'day',dialog:'form',form:'schedule',date:'2026-02-31'}])assert.equal(parseEmployeeScreen(s),null);
 const ui={setup:'notifications',busy:false,error:null,online:true,sampledAt:at(0).toISOString()};assert.ok(parseEmployeeUiObservation(ui));assert.ok(parseEmployeeUiObservation({...ui,screen:{section:'day'}}));
});
test('live reader is bounded, serial, stops in background and backs off failures',()=>{
 const input={visible:true,currentDay:true,inFlight:false,now:10000,lastAttempt:0,failures:0};assert.equal(activityMayRefresh(input),true);
 for(const patch of [{visible:false},{inFlight:true},{currentDay:false},{lastAttempt:9000}])assert.equal(activityMayRefresh({...input,...patch}),false);
 assert.equal(activityRefreshDelay(0),5000);assert.equal(activityRefreshDelay(2),20000);assert.equal(activityRefreshDelay(20),30000);assert.equal(activityMayRefresh({...input,currentDay:false,force:true}),true);
});
test('remote error and loading states are explicit; unknown fields and contradictory dialog states are rejected',()=>{
 assert.ok(parseEmployeeScreen({section:'notifications',dialog:'notification',notificationId:7,noticeState:'error'}));
 assert.ok(parseEmployeeScreen({section:'day',dialog:'guide',guideMode:'automatic',guideReason:'both',guideError:true,guideBusy:false}));
 assert.equal(parseEmployeeScreen({section:'day',dialog:'guide',noticeState:'error'}),null);
 assert.equal(parseEmployeeScreen({section:'day',dialog:'guide',guideReason:'private arbitrary text'}),null);
});

test('same displayed second preserves guide click before saved acknowledgement without changing either timestamp',()=>{
 const click=event('guide','acknowledge_clicked',1),ack={...event('guide','x',1),kind:'work_help_ack',context:{version:'schedule-work-v1'}};
 click.createdAt=new Date(at(1).getTime()+100);ack.createdAt=at(1);
 const row=buildProcessView(report([ack,click]))[0];assert.equal(row.steps[0].stage,'acknowledge_clicked');assert.equal(row.steps[1].stage,'acknowledged');assert.equal(row.steps[0].at,click.createdAt.toISOString());assert.equal(row.steps[1].at,ack.createdAt.toISOString());assert.ok(row.end>=row.at);
});

test('only the bulk schedule workflow accepts an explicit valid month',()=>{
 const c={target:'workflow',action:'schedule_bulk',stage:'closed',attemptId:'schedule-month-123',period:'2026-11'};
 assert.ok(readExperience(c));
 assert.equal(readExperience({...c,period:'2026-13'}),null);
 assert.equal(readExperience({...c,action:'cash_form'}),null);
 assert.equal(readExperience({...c,period:'2026-11-31'}),null);
});
test('only cash form/photo events accept an opaque draft reference, without collecting form data',()=>{
 const base={target:'workflow',action:'cash_form',stage:'opened',attemptId:'cash-attempt-123',ref:'cash-draft-key-123'};
 assert.ok(readExperience(base));assert.ok(readExperience({...base,action:'cash_photo'}));
 for(const patch of [{action:'learning'},{ref:'http://private.test'},{ref:'short'},{amount:1000},{target:'guide'}])assert.equal(readExperience({...base,...patch}),null);
});
