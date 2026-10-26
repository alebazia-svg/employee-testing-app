import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {prisma} from '../lib/prisma';
import {loadScheduleCoverageQuestions,reconcileScheduleCoverageQuestion} from '../lib/schedule-coverage-reconciliation';
import {reconcileScheduleNearQuestions,activeScheduleNotices,reconcileScheduleQuestions} from '../lib/work-schedule-notifications';
import {SCHEDULE_NEAR_KIND} from '../lib/schedule-near-reminder';

test('closed wholesale question stays out of ADMIN; retail reduced/empty and daily reminders follow live plans', {skip:process.env.SCHEDULE_POLICY_INTEGRATION!=='1'}, async()=>{
 assert.equal(process.env.DATABASE_URL,'postgresql://preview:handover-local-only@127.0.0.1:55471/schedule_policy_test');
 const prefix='schedule-policy-'+Date.now(),day='2099-10-26',tomorrow='2099-10-27',now=new Date(day+'T16:00:00Z'),ids:number[]=[],events:string[]=[];
 try{
  for(const [name,role,department] of [['ADMIN','ADMIN','retail'],['Залина','EMPLOYEE','wholesale'],['Лиана','EMPLOYEE','wholesale'],['Зухра','EMPLOYEE','retail'],['Милана','EMPLOYEE','retail']]){
   const user=await prisma.user.create({data:{login:prefix+name,name,role,department,passwordHash:'unused'}});ids.push(user.id);
  }
  const [admin,z,l,r1,r2]=ids;
  const set=async(userId:number,date:string,status:string,department:string)=>prisma.workScheduleEntry.upsert({where:{userId_date:{userId,date}},create:{userId,date,status,department},update:{status}});
  for(const userId of [z,l])for(const date of [day,tomorrow])await set(userId,date,userId===z?'working':'off','wholesale');
  const old=await prisma.adminInboxEvent.create({data:{eventKey:`schedule-coverage:wholesale:${day}`,type:'work_schedule.coverage_gap',sourceType:'work_schedule_coverage',sourceId:`wholesale:${day}`,title:'Старый неполный график',body:'Старое сообщение',href:'/admin/attendance',occurredAt:new Date(day+'T06:11:00Z')}});events.push(old.id);
  await prisma.adminInboxReceipt.create({data:{userId:admin,eventId:old.id}});
  const mocks:Record<string,any>={'server-only':{},'./prisma':{prisma},'@/lib/prisma':{prisma},'./admin-inbox-source-health':{expenseSyncLastSuccess:async()=>now,sourceCheckIsStale:()=>false},'./admin-inbox-deadline-source':{loadDecisionCashiers:async()=>[],expenseCashboxRef:()=>''}};
  const out=await build({entryPoints:['lib/admin-inbox-data.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined);}}]});
  const mod={exports:{} as any},require=createRequire(import.meta.url);new Function('require','module','exports',out.outputFiles[0].text)((n:string)=>mocks[n]??require(n),mod,mod.exports);
  const inbox=()=>mod.exports.loadAdminInbox({userId:admin,limit:200,view:'attention',now});
  assert.equal((await inbox()).attention.some((i:any)=>i.event.id===old.id||i.event.sourceId===`wholesale:${day}`),false,'live plans close the old morning item before another worker runs');
  for(let i=0;i<3;i++)await prisma.$transaction(tx=>reconcileScheduleCoverageQuestion(tx,'wholesale',day,now));
  assert.equal(await prisma.adminInboxEvent.count({where:{eventKey:old.eventKey}}),1);
  assert.ok((await prisma.adminInboxReceipt.findFirstOrThrow({where:{eventId:old.id}})).readAt);
  await set(z,day,'off','wholesale');
  await prisma.$transaction(tx=>reconcileScheduleCoverageQuestion(tx,'wholesale',day,now));
  assert.equal((await inbox()).attention.some((i:any)=>i.event.sourceId===`wholesale:${day}`),true);
  await prisma.$transaction(tx=>reconcileScheduleQuestions(tx,{actorId:z,department:'wholesale',date:day,requestKnownOff:true,now}));
  const ask=await prisma.workdayNotification.findFirstOrThrow({where:{userId:l,kind:'schedule_replacement_request'}});
  assert.match(ask.title,/Сможете работать/);
  await set(z,day,'working','wholesale');
  assert.equal((await activeScheduleNotices(prisma,[ask],day)).size,0,'replacement disappears once one wholesale colleague works');
  assert.equal((await inbox()).attention.some((i:any)=>i.event.sourceId===`wholesale:${day}`),false);
  await set(r1,day,'working','retail');await set(r2,day,'off','retail');
  let q=(await loadScheduleCoverageQuestions(prisma,[`retail:${day}`],now)).get(`retail:${day}`)!;
  assert.equal(q.active,true);assert.match(q.title,/нужна ли подмена/);assert.match(q.body,/не ошибка сотрудника/);
  await set(r2,day,'working','retail');q=(await loadScheduleCoverageQuestions(prisma,[`retail:${day}`],now)).get(`retail:${day}`)!;assert.equal(q.active,false);
  await prisma.$transaction(tx=>reconcileScheduleNearQuestions(tx,'wholesale',now));
  assert.equal(await prisma.workdayNotification.count({where:{userId:z,kind:SCHEDULE_NEAR_KIND}}),0,'later empty days do not create a near reminder');
  await prisma.workScheduleEntry.delete({where:{userId_date:{userId:z,date:tomorrow}}});
  for(let i=0;i<3;i++)await prisma.$transaction(tx=>reconcileScheduleNearQuestions(tx,'wholesale',now));
  const notice=await prisma.workdayNotification.findFirstOrThrow({where:{userId:z,kind:SCHEDULE_NEAR_KIND}});
  assert.equal(await prisma.workdayNotification.count({where:{userId:z,kind:SCHEDULE_NEAR_KIND}}),1);assert.match(notice.body,/Завтра не заполнен/);
  await set(z,tomorrow,'off','wholesale');
  assert.equal((await activeScheduleNotices(prisma,[notice],day)).size,0,'saving off closes bell/push eligibility immediately');
  await prisma.$transaction(tx=>reconcileScheduleNearQuestions(tx,'wholesale',new Date(tomorrow+'T09:00:00Z')));
  const next=await prisma.workdayNotification.findFirstOrThrow({where:{userId:z,kind:SCHEDULE_NEAR_KIND,status:'pending'}});
  assert.notEqual(next.id,notice.id);assert.match(next.fingerprint,/2099-10-27/);
 }finally{
  await prisma.adminInboxEvent.deleteMany({where:{sourceType:'work_schedule_coverage',sourceId:{in:[`wholesale:${day}`,`retail:${day}`]}}});
  await prisma.workdayNotification.deleteMany({where:{userId:{in:ids}}});await prisma.user.deleteMany({where:{id:{in:ids}}});await prisma.$disconnect();
 }
});
