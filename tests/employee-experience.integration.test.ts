import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { writeEmployeeActivity } from '../lib/employee-activity';
import { employeeActivityReport } from '../lib/employee-activity-report';
import { buildProcessView } from '../lib/employee-process-view';
if(process.env.DATABASE_URL!=='postgresql://activity:local-activity-review-only@127.0.0.1:55508/activity_live_review')throw Error('Isolated activity review DB only');
const users:number[]=[];
async function fixture(){
 const user=await prisma.user.create({data:{login:'experience-'+crypto.randomUUID(),name:'Isolated activity test',role:'EMPLOYEE',department:'procurement',passwordHash:'not-a-login'}});users.push(user.id);
 const browser=crypto.randomUUID();
 const session=await prisma.portalAccessSession.create({data:{userId:user.id,sessionHash:crypto.randomUUID(),device:'iPhone',browser:'Safari',browserInstanceId:browser,observedBrowserId:browser,expiresAt:new Date(Date.now()+86400000)}});
 return {user,session};
}
test('real DB writes new guide events, preserves idempotency, and reports the exact browser without sensitive data',async()=>{
 const {user,session}=await fixture(),now=new Date();
 const input={key:'guide-shown-123',kind:'experience' as const,context:{target:'guide' as const,stage:'automatic_shown' as const,attemptId:'guide-attempt-123'}};
 assert.equal(await writeEmployeeActivity(user.id,session.sessionHash,input,now),true);
 assert.equal(await writeEmployeeActivity(user.id,session.sessionHash,input,now),true);
 assert.equal(await prisma.portalActivityEvent.count({where:{userId:user.id}}),1);
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(now),report=await employeeActivityReport(user.id,date,now);
 const row=buildProcessView(report)[0];assert.match(row.outcome,/показана/);assert.equal(row.steps[0].source?.browserCode,session.browserInstanceId);
 assert.equal(row.confirmed,false);assert.doesNotMatch(JSON.stringify(report),new RegExp(session.sessionHash));assert.doesNotMatch(JSON.stringify(report),/passwordHash|p256dh|sessionHash/);
});
test('connected success requires a real active subscription of this account on this session',async()=>{
 const {user,session}=await fixture();
 const input={key:'connected-12345',kind:'experience' as const,context:{target:'push_setup' as const,stage:'connected' as const,attemptId:'push-attempt-123'}};
 assert.equal(await writeEmployeeActivity(user.id,session.sessionHash,input),false);
 const sub=await prisma.workdayPushSubscription.create({data:{userId:user.id,endpoint:'https://local.invalid/'+user.id,p256dh:'demo',auth:'demo'}});
 await prisma.portalAccessSession.update({where:{id:session.id},data:{pushSubscriptionId:sub.id}});
 assert.equal(await writeEmployeeActivity(user.id,session.sessionHash,input),true);
 await prisma.workdayPushSubscription.update({where:{id:sub.id},data:{disabledAt:new Date()}});
 assert.equal(await writeEmployeeActivity(user.id,session.sessionHash,{...input,key:'connected-disabled-123'}),false);
});
test('foreign account, closed, expired and service sessions cannot write new observations',async()=>{
 const {user,session}=await fixture();
 const input={key:'guide-boundary-123',kind:'experience' as const,context:{target:'guide' as const,stage:'close_button' as const,attemptId:'guide-attempt-123'}};
 assert.equal(await writeEmployeeActivity(user.id+10000,session.sessionHash,input),false);
 for(const patch of [{isService:true},{isService:false,loggedOutAt:new Date()},{loggedOutAt:null,expiresAt:new Date(Date.now()-1)}]){
  await prisma.portalAccessSession.update({where:{id:session.id},data:patch});assert.equal(await writeEmployeeActivity(user.id,session.sessionHash,input),false);
 }
});
test('task references are owned, and read-only reporting never changes notification read markers or business rows',async()=>{
 const {user,session}=await fixture(),other=await fixture(),now=new Date();
 const day=await prisma.workDayEntry.create({data:{userId:other.user.id,date:'2026-11-08',department:'procurement',shiftCode:'other',shiftLabel:'Test',startedAt:now}});
 const run=await prisma.shiftControlRun.create({data:{userId:other.user.id,workDayEntryId:day.id,date:'2026-11-08',department:'procurement'}});
 const task=await prisma.shiftControlTask.create({data:{runId:run.id,sortOrder:1,title:'Test',category:'cash'}});
 assert.equal(await writeEmployeeActivity(user.id,session.sessionHash,{key:'foreign-task-123',kind:'experience',context:{target:'workflow',action:'task_save',stage:'submitted',attemptId:'task-attempt-123',taskId:task.id}}),false);
 const notice=await prisma.workdayNotification.create({data:{userId:user.id,fingerprint:'experience-notice-'+user.id,kind:'planned',title:'Test',body:'Demo only',sentAt:now,scheduledAt:now}});
 const before=await prisma.workdayNotification.findUnique({where:{id:notice.id}});
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(now);await employeeActivityReport(user.id,date);
 assert.deepEqual(await prisma.workdayNotification.findUnique({where:{id:notice.id}}),before);
});
after(async()=>{await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();});
test('a reported background transition immediately stops treating the selected phone screen as current',async()=>{
 const {loadEmployeeInspectionDevices}=await import('../lib/employee-inspection-state-server');
 const {user,session}=await fixture(),now=new Date();
 await prisma.portalAccessSession.update({where:{id:session.id},data:{displayMode:'app',contextCheckedAt:now,pushState:'not_connected',pushCheckedAt:now,appCheckedAt:now,appObservation:{version:'1.21.48',builtAt:now.toISOString(),clientId:crypto.randomUUID(),state:'current',ui:{setup:'notifications',busy:false,error:null,online:true,sampledAt:now.toISOString(),screen:{section:'day'}}}}});
 assert.equal((await loadEmployeeInspectionDevices(user.id,session.id,now)).connections[0].live,true);
 const hidden=new Date(now.getTime()+100);
 assert.equal(await writeEmployeeActivity(user.id,session.sessionHash,{key:'background-report-123',kind:'experience',context:{target:'workflow',action:'app',stage:'background',attemptId:'background-attempt-123'}},hidden),true);
 const result=await loadEmployeeInspectionDevices(user.id,session.id,new Date(now.getTime()+1000));
 assert.equal(result.connections[0].live,false);assert.equal(result.connections[0].runtime?.screen?.section,'day');
});

test('saved cash comparison failure and pending task names come from owned persisted records',async()=>{
 const {user,session}=await fixture(),now=new Date(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(now);
 const day=await prisma.workDayEntry.create({data:{userId:user.id,date,department:'retail',shiftCode:'full',shiftLabel:'Test',startedAt:now}});
 const run=await prisma.shiftControlRun.create({data:{userId:user.id,workDayEntryId:day.id,date,department:'retail'}});
 const task=await prisma.shiftControlTask.create({data:{runId:run.id,sortOrder:1,title:'Named cash task',category:'cash',status:'done',completedAt:now,numericValue:0,handoverData:{cashComparison:{status:'unavailable',expected:null}}}});
 const event={key:'task-form-owned-name',kind:'experience' as const,context:{target:'workflow' as const,action:'task_form' as const,stage:'opened' as const,attemptId:'task-name-flow-123',taskId:task.id}};
 assert.equal(await writeEmployeeActivity(user.id,session.sessionHash,event,now),true);
 const report=await employeeActivityReport(user.id,date,new Date(+now+10)),row=(await import('../lib/employee-activity-presentation')).managerActivity(report).rows.find(r=>r.item.id===`handover:${task.id}`)!;
 assert.match(row.item.title,/Named cash task/);assert.equal(row.item.verification,'unavailable');assert.equal(row.item.confirmed,true);assert.equal(row.status,'unknown');
 assert.ok(report.audit?.some(e=>e.title==='Named cash task'));assert.doesNotMatch(JSON.stringify(report),/sourceError/);
});
