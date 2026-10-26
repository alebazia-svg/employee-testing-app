import test from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {activeScheduleNotices,reconcileScheduleWeekQuestions} from '../lib/work-schedule-notifications';
import {persistEmployeeScheduleChange} from '../lib/work-schedule-persistence';
import {reconcileScheduleCoverageQuestion,loadScheduleCoverageQuestions,queueScheduleFillQuestions} from '../lib/schedule-coverage-reconciliation';
import {requiredScheduleWeekDates} from '../lib/schedule-week-reminder';

test('isolated DB: one weekly question, legacy retirement, partial/direct/bulk/admin fill, vacation, reopening without another push and coverage lifecycle', {skip:process.env.SCHEDULE_REMINDER_TEST!=='1'},async()=>{
 const url=new URL(process.env.DATABASE_URL!);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55471');assert.equal(url.pathname,'/schedule_preview_20261026');
 const db=new PrismaClient(),date='2099-10-26',now=new Date('2099-10-26T05:30Z'),prefix=`schedule-proof-${Date.now()}`;
 let ids:number[]=[];
 try {
  const admin=await db.user.create({data:{login:prefix+'admin',name:'Учебный ADMIN',passwordHash:'disabled',role:'ADMIN'}});
  const liana=await db.user.create({data:{login:prefix+'a',name:'Пример Лиана',passwordHash:'disabled',role:'EMPLOYEE',department:'wholesale'}});
  const zalina=await db.user.create({data:{login:prefix+'b',name:'Пример Залина',passwordHash:'disabled',role:'EMPLOYEE',department:'wholesale'}});ids=[admin.id,liana.id,zalina.id];
  const old=await db.workdayNotification.create({data:{userId:zalina.id,kind:'schedule_fill_request',fingerprint:`schedule-coverage:wholesale:${date}:${zalina.id}`,title:'Old day question',body:'',scheduledAt:now,status:'sent',sentAt:now}});
  await queueScheduleFillQuestions(db,new Date('2099-10-26T05:29Z'));
  assert.equal(await db.workdayNotification.count({where:{fingerprint:`schedule-week:wholesale:2099-10-26:${zalina.id}`}}),0,'weekly reminders do not start before 08:30 Moscow');
  await reconcileScheduleWeekQuestions(db,'wholesale',now);
  const fingerprint=`schedule-week:wholesale:2099-10-26:${zalina.id}`;
  const notice=await db.workdayNotification.findUniqueOrThrow({where:{fingerprint}});
  assert.equal((await db.workdayNotification.findUniqueOrThrow({where:{id:old.id}})).status,'resolved');
  await db.workdayNotification.update({where:{id:notice.id},data:{status:'sent',sentAt:now,readAt:now,pushStatus:'delivered',pushDeliveredAt:now}});
  assert.equal((await activeScheduleNotices(db,[notice],date)).size,1,'read alone is not done');
  for(let i=0;i<2;i++)await reconcileScheduleWeekQuestions(db,'wholesale',now);
  assert.equal(await db.workdayNotification.count({where:{fingerprint}}),1);
  await db.$transaction(tx=>persistEmployeeScheduleChange(tx,{user:zalina,date,status:'working',previousStatus:null,departmentEntries:[],source:'employee'}));
  assert.equal((await activeScheduleNotices(db,[notice],date)).size,1,'today filled but remaining week still missing');
  await reconcileScheduleWeekQuestions(db,'wholesale',now);
  const tomorrowNotice=await db.workdayNotification.findUniqueOrThrow({where:{fingerprint}});
  assert.match(tomorrowNotice.body,/^Завтра не отмечено\./,'advance reminder uses the existing weekly notice');
  await reconcileScheduleWeekQuestions(db,'wholesale',new Date('2099-10-27T05:30Z'));
  const todayNotice=await db.workdayNotification.findUniqueOrThrow({where:{fingerprint}});
  assert.equal(todayNotice.id,notice.id,'next morning keeps the same notice');
  assert.match(todayNotice.body,/^Сегодня не отмечено\./);
  assert.equal(todayNotice.pushStatus,'delivered');
  assert.equal(+todayNotice.sentAt!,+now,'next morning does not queue another push');
  assert.equal(+todayNotice.pushDeliveredAt!,+now);
  assert.equal(+todayNotice.readAt!,+now,'read state survives the factual text update');
  assert.equal(await db.workdayNotification.count({where:{fingerprint}}),1);
  // A direct calendar/bulk/admin save does not need noticeId or notification response.
  await db.workScheduleEntry.createMany({data:requiredScheduleWeekDates(date).slice(1).map(day=>({userId:zalina.id,date:day,department:'wholesale',status:'off'}))});
  assert.equal((await activeScheduleNotices(db,[notice],date)).size,0,'live filter retires before next worker');
  await reconcileScheduleWeekQuestions(db,'wholesale',now);
  assert.equal((await db.workdayNotification.findUniqueOrThrow({where:{fingerprint}})).status,'resolved');
  await db.workScheduleEntry.delete({where:{userId_date:{userId:zalina.id,date:'2099-10-30'}}});
  await reconcileScheduleWeekQuestions(db,'wholesale',now);
  const reopened=await db.workdayNotification.findUniqueOrThrow({where:{fingerprint}});
  assert.equal(reopened.status,'sent');assert.equal(reopened.pushStatus,'cancelled');assert.equal(+reopened.sentAt!,+now,'no new push after an already sent weekly question');
  await db.employeeVacation.create({data:{userId:zalina.id,department:'wholesale',dateFrom:'2099-10-30',dateTo:'2099-10-30',status:'active',createdById:admin.id,updatedById:admin.id}});
  assert.equal((await activeScheduleNotices(db,[reopened],date)).size,0);
  // Friday changes the target once. It remains the same key over the weekend/Monday.
  const friday=new Date('2099-10-30T05:30Z');
  await reconcileScheduleWeekQuestions(db,'wholesale',friday);
  const nextKey=`schedule-week:wholesale:2099-11-02:${zalina.id}`;
  const next=await db.workdayNotification.findUniqueOrThrow({where:{fingerprint:nextKey}});
  assert.equal((await activeScheduleNotices(db,[reopened],'2099-10-30')).size,0);
  assert.equal((await activeScheduleNotices(db,[next],'2099-10-30')).size,1);
  await reconcileScheduleWeekQuestions(db,'wholesale',new Date('2099-11-02T05:30Z'));
  assert.equal(await db.workdayNotification.count({where:{fingerprint:nextKey}}),1);
  await db.workScheduleEntry.createMany({data:requiredScheduleWeekDates('2099-10-30').map(day=>({userId:zalina.id,date:day,department:'wholesale',status:'off'})),skipDuplicates:true});
  assert.equal((await activeScheduleNotices(db,[next],'2099-10-30')).size,0,'dates after next Sunday are not required');
  await db.workScheduleEntry.create({data:{userId:liana.id,date,department:'wholesale',status:'working'}});
  await reconcileScheduleCoverageQuestion(db,'wholesale',date,now);
  assert.equal((await loadScheduleCoverageQuestions(db,[`wholesale:${date}`],now)).get(`wholesale:${date}`)?.active,false);
  await db.$transaction(tx=>persistEmployeeScheduleChange(tx,{user:liana,date,status:'off',previousStatus:'working',departmentEntries:[{userId:liana.id,status:'working'},{userId:zalina.id,status:'working'}],source:'employee'}));
  assert.equal((await loadScheduleCoverageQuestions(db,[`wholesale:${date}`],now)).get(`wholesale:${date}`)?.active,true);
  assert.equal(await db.adminInboxEvent.count({where:{eventKey:`schedule-coverage:wholesale:${date}`}}),1);
 } finally {
  await db.workdayNotification.deleteMany({where:{OR:[{fingerprint:{startsWith:'schedule-week:wholesale:2099-'}},{fingerprint:{startsWith:`schedule-coverage:wholesale:${date}:`}}]}});
  await db.adminInboxEvent.deleteMany({where:{eventKey:`schedule-coverage:wholesale:${date}`}});
  await db.employeeVacation.deleteMany({where:{userId:{in:ids}}});
  await db.user.deleteMany({where:{id:{in:ids}}});await db.$disconnect();
 }
});
