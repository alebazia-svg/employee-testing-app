import test from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {reconcileScheduleQuestions,activeScheduleNotices} from '../lib/work-schedule-notifications';
import {persistEmployeeScheduleChange} from '../lib/work-schedule-persistence';
import {reconcileScheduleCoverageQuestion,loadScheduleCoverageQuestions} from '../lib/schedule-coverage-reconciliation';

test('isolated database: direct calendar answer retires read notification; coverage restoration, reopening and deduplication', {skip:process.env.SCHEDULE_REMINDER_TEST!=='1'},async()=>{
 const url=new URL(process.env.DATABASE_URL!);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55471');assert.equal(url.pathname,'/schedule_preview_20261026');
 const db=new PrismaClient(),date='2099-10-26',now=new Date('2099-10-26T05:30Z'),prefix=`schedule-proof-${Date.now()}`;
 let ids:number[]=[];
 try {
  const admin=await db.user.create({data:{login:prefix+'admin',name:'Учебный ADMIN',passwordHash:'disabled',role:'ADMIN'}});
  const liana=await db.user.create({data:{login:prefix+'a',name:'Пример Лиана',passwordHash:'disabled',role:'EMPLOYEE',department:'wholesale'}});
  const zalina=await db.user.create({data:{login:prefix+'b',name:'Пример Залина',passwordHash:'disabled',role:'EMPLOYEE',department:'wholesale'}});ids=[admin.id,liana.id,zalina.id];
  await db.workScheduleEntry.create({data:{userId:liana.id,date,department:'wholesale',status:'working'}});
  await db.$transaction(tx=>persistEmployeeScheduleChange(tx,{user:liana,date,status:'off',previousStatus:'working',departmentEntries:[{userId:liana.id,status:'working'}],source:'employee'}));
  const notice=await db.workdayNotification.findFirstOrThrow({where:{userId:zalina.id,fingerprint:`schedule-coverage:wholesale:${date}:${zalina.id}`}});
  assert.match(notice.body,/Отметьте: работаете вы или у вас выходной/);
  await db.workdayNotification.update({where:{id:notice.id},data:{status:'sent',sentAt:now,readAt:now}});
  assert.equal((await activeScheduleNotices(db,[notice],'2099-10-26')).size,1,'read alone does not answer');
  for(let i=0;i<2;i++) await reconcileScheduleQuestions(db,{actorId:0,department:'wholesale',date,requestKnownOff:false});
  assert.equal(await db.workdayNotification.count({where:{userId:zalina.id,fingerprint:notice.fingerprint}}),1);
  // Calendar save, without noticeId or notification action.
  await db.$transaction(tx=>persistEmployeeScheduleChange(tx,{user:zalina,date,status:'working',previousStatus:null,departmentEntries:[{userId:liana.id,status:'off'}],source:'employee'}));
  assert.equal((await activeScheduleNotices(db,[notice],'2099-10-26')).size,0);
  assert.equal((await db.workdayNotification.findUniqueOrThrow({where:{id:notice.id}})).status,'answered');
  await db.$transaction(tx=>persistEmployeeScheduleChange(tx,{user:liana,date,status:'working',previousStatus:'off',departmentEntries:[{userId:liana.id,status:'off'},{userId:zalina.id,status:'working'}],source:'employee'}));
  await reconcileScheduleCoverageQuestion(db,'wholesale',date,now);
  assert.equal((await loadScheduleCoverageQuestions(db,[`wholesale:${date}`],now)).get(`wholesale:${date}`)?.active,false);
  await db.$transaction(tx=>persistEmployeeScheduleChange(tx,{user:liana,date,status:'off',previousStatus:'working',departmentEntries:[{userId:liana.id,status:'working'},{userId:zalina.id,status:'working'}],source:'employee'}));
  assert.equal((await loadScheduleCoverageQuestions(db,[`wholesale:${date}`],now)).get(`wholesale:${date}`)?.active,true);
  assert.equal(await db.adminInboxEvent.count({where:{eventKey:`schedule-coverage:wholesale:${date}`}}),1);
 } finally {
  await db.workdayNotification.deleteMany({where:{fingerprint:{startsWith:`schedule-coverage:wholesale:${date}:`}}});
  await db.adminInboxEvent.deleteMany({where:{eventKey:`schedule-coverage:wholesale:${date}`}});
  await db.user.deleteMany({where:{id:{in:ids}}});await db.$disconnect();
 }
});
