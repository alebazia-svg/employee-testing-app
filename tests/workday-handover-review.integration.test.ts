import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {prisma} from '../lib/prisma';
import {loadAdminInbox} from '../lib/admin-inbox-data';
import {loadOpenHandoverReviews,syncClosedHandoverReviews,acknowledgeHandoverReview,handoverReviewInclude} from '../lib/workday-handover-review-server';
import {handoverReviewRecord,HANDOVER_REVIEW_SOURCE} from '../lib/workday-handover-review';
const enabled=process.env.HANDOVER_REVIEW_INTEGRATION==='1';
test('PostgreSQL: backfill, read, simultaneous acknowledgement, reload and retained history', {skip:!enabled}, async()=>{
 assert.equal(process.env.DATABASE_URL,'postgresql://preview:schedule-source-local-only@127.0.0.1:55481/handover_review_test_20261103');
 const fetchBefore=global.fetch;
 global.fetch=async()=>{throw new Error('Network disabled for isolated persistence test');};
 const prefix=`handover-${Date.now()}`;
 const userIds:number[]=[];const taskIds:number[]=[];
 const now=new Date('2026-11-03T07:00:00Z');
 try {
  const admin=await prisma.user.create({data:{name:'Администратор 1',login:prefix+'a',passwordHash:'unused',role:'ADMIN'}});userIds.push(admin.id);
  const other=await prisma.user.create({data:{name:'Администратор 2',login:prefix+'b',passwordHash:'unused',role:'ADMIN'}});userIds.push(other.id);
  const employee=await prisma.user.create({data:{name:'Тестовая Залина',login:prefix+'e',passwordHash:'unused',role:'EMPLOYEE',department:'wholesale'}});userIds.push(employee.id);
  async function make(date:string,status:string,ended:boolean,handoverData?:object){
   const day=await prisma.workDayEntry.create({data:{userId:employee.id,date,department:'wholesale',shiftCode:'09_19',shiftLabel:'09:00–19:00',startedAt:new Date(`${date}T05:58:00Z`),endedAt:ended?new Date('2026-11-03T06:57:00Z'):null,status:ended?'completed':'active',comment:'Предыдущий рабочий день закрыт позже. Обязательные шаги пропущены.\nПричина: Забыл закрыть смену.'}});
   const run=await prisma.shiftControlRun.create({data:{userId:employee.id,workDayEntryId:day.id,date,department:'wholesale',status:ended?'completed':'active',closingComment:day.comment,tasks:{create:{category:'handover',title:'Сдать смену',sortOrder:3,status,plannedTimeMinutes:1140,handoverData}}},include:{tasks:true}});
   const task=run.tasks[0];taskIds.push(task.id);return {day,task};
  }
  const missing=await make('2026-11-02','missed',true,{personalCash:{cashBalance:2890},oneCAudit:{capturedAt:'2026-11-02T16:06:00Z',personalCash:{balance:2890,status:'captured'}}});
  const originalDay=await prisma.workDayEntry.findUniqueOrThrow({where:{id:missing.day.id}});
  const originalTask=await prisma.shiftControlTask.findUniqueOrThrow({where:{id:missing.task.id}});
  await make('2026-11-01','done',true);
  await make('2026-10-31','missed',true,{adminClosure:{requestId:'approved',adminId:admin.id,closedAt:now.toISOString()}});
  await make('2026-11-03','pending',false);
  assert.equal((await loadOpenHandoverReviews(prisma,{dateBefore:'2026-11-03'})).length,1);
  await syncClosedHandoverReviews(prisma,{now});await syncClosedHandoverReviews(prisma,{now});
  const event=await prisma.adminInboxEvent.findUniqueOrThrow({where:{eventKey:`workday:handover-review:${missing.task.id}`}});
  assert.equal(await prisma.adminInboxEvent.count({where:{sourceType:HANDOVER_REVIEW_SOURCE,sourceId:String(missing.task.id)}}),1);
  assert.equal(await prisma.adminInboxReceipt.count({where:{eventId:event.id}}),2);
  const inbox=()=>loadAdminInbox({userId:admin.id,limit:100,view:'attention',now});
  assert.equal((await inbox()).items.filter(item=>item.event.sourceType===HANDOVER_REVIEW_SOURCE).length,1);
  await prisma.adminInboxReceipt.updateMany({where:{eventId:event.id},data:{readAt:now}});
  assert.equal((await inbox()).items.filter(item=>item.event.sourceType===HANDOVER_REVIEW_SOURCE).length,1,'reading is not acknowledgement');
  await assert.rejects(prisma.$transaction(async tx=>{
    await acknowledgeHandoverReview(tx,missing.task.id,admin.id,now);
    throw new Error('simulated transaction failure');
  }),/simulated transaction failure/);
  assert.equal(await prisma.shiftControlManualReview.count({where:{taskId:missing.task.id}}),0,'failed transaction must not record acknowledgement');
  assert.equal((await inbox()).items.filter(item=>item.event.sourceType===HANDOVER_REVIEW_SOURCE).length,1,'save failure must leave the reminder active');
  const results=await Promise.all([admin,other].map(actor=>prisma.$transaction(tx=>acknowledgeHandoverReview(tx,missing.task.id,actor.id,now))));
  assert.ok(results.every(result=>result.ok));
  assert.equal(await prisma.shiftControlManualReview.count({where:{taskId:missing.task.id}}),1,'concurrent calls must create one journal record');
  assert.equal((await loadOpenHandoverReviews(prisma,{dateBefore:'2026-11-03'})).length,0);
  assert.equal((await inbox()).items.filter(item=>item.event.sourceType===HANDOVER_REVIEW_SOURCE).length,0);
  const otherInbox=await loadAdminInbox({userId:other.id,limit:100,view:'attention',now});
  assert.equal(otherInbox.items.filter(item=>item.event.sourceType===HANDOVER_REVIEW_SOURCE).length,0);
  await syncClosedHandoverReviews(prisma,{now:new Date(+now+60000)});
  assert.equal(await prisma.adminInboxEvent.count({where:{sourceType:HANDOVER_REVIEW_SOURCE,sourceId:String(missing.task.id)}}),1,'runner must not recreate a resolved reminder');
  const history=await loadAdminInbox({userId:admin.id,limit:100,view:'history',now});
  const historical=history.items.find(item=>item.event.sourceType===HANDOVER_REVIEW_SOURCE);
  assert.ok(historical);assert.equal(historical.sourceState.active,false);assert.equal(historical.sourceState.label,'Проверено');
  const reloaded=await prisma.shiftControlTask.findUniqueOrThrow({where:{id:missing.task.id},include:handoverReviewInclude});
  assert.ok(handoverReviewRecord(reloaded.id,reloaded.manualReviews)?.reviewedBy.name);
  assert.deepEqual(await prisma.workDayEntry.findUniqueOrThrow({where:{id:missing.day.id}}),originalDay,'original closure must remain unchanged');
  assert.deepEqual(await prisma.shiftControlTask.findUniqueOrThrow({where:{id:missing.task.id}}),originalTask,'task stays missed, original cash/audit data is untouched');
  // The actual employee finish handler must create a review for the next late close.
  const stale=await make('2026-10-29','pending',false);
  const mocks:Record<string,unknown>={
    '@/lib/auth':{getCurrentUser:async()=>employee},'@/lib/prisma':{prisma},
    '@/lib/terminal-fiscal-handover':{refreshHandoverReceipts:async()=>undefined,escalateHandoverReceipts:async()=>undefined},
    '@/lib/workday-required-issues':{findOpenRequiredWorkdayIssues:async()=>[],findApprovedCloseException:async()=>null},
  };
  const bundle=await build({entryPoints:['app/api/employee/workday/finish/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated-close',setup(b){b.onResolve({filter:/.*/},args=>args.path in mocks?{path:args.path,external:true}:undefined);}}]});
  const mod={exports:{} as {POST:(req:Request)=>Promise<Response>}},require=createRequire(import.meta.url);
  new Function('require','module','exports',bundle.outputFiles[0].text)((key:string)=>key in mocks?mocks[key]:require(key),mod,mod.exports);
  const closeRequest=()=>new Request('http://localhost/api/employee/workday/finish',{method:'POST',body:JSON.stringify({workDayId:stale.day.id,closeStale:true,staleCloseReason:'forgot_close'})});
  const closed=await mod.exports.POST(closeRequest());assert.equal(closed.status,200);assert.equal((await closed.json()).staleClosed,true);
  assert.equal((await prisma.shiftControlTask.findUniqueOrThrow({where:{id:stale.task.id}})).status,'missed');
  assert.equal(await prisma.adminInboxEvent.count({where:{eventKey:`workday:handover-review:${stale.task.id}`}}),1,'the real closure transaction creates the event');
  assert.equal((await mod.exports.POST(closeRequest())).status,404);
  assert.equal(await prisma.adminInboxEvent.count({where:{eventKey:`workday:handover-review:${stale.task.id}`}}),1,'a close retry does not duplicate the event');
  for(const taskId of taskIds.filter(id=>id!==missing.task.id && id!==stale.task.id)){
   const result=await prisma.$transaction(tx=>acknowledgeHandoverReview(tx,taskId,admin.id,now));
   assert.equal(result.ok,false,'active/filled/admin-authorized handovers reject acknowledgement');
  }
 } finally {
  global.fetch=fetchBefore;
  await prisma.adminInboxEvent.deleteMany({where:{sourceType:HANDOVER_REVIEW_SOURCE,sourceId:{in:taskIds.map(String)}}});
  await prisma.shiftControlManualReview.deleteMany({where:{reviewedById:{in:userIds}}});
  await prisma.user.deleteMany({where:{id:{in:userIds}}});
  await prisma.$disconnect();
 }
});
