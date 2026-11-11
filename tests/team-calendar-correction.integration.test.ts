import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { markCalendarWorking } from '../lib/team-calendar-correction';
import { parseCalendarWorkingCorrection, resolveCalendarFact } from '../lib/team-calendar-fact';

const url=process.env.DATABASE_URL;
test('isolated PostgreSQL: audited correction, retries, cancellation and preservation', {skip:!url}, async()=>{
 const parsed=new URL(url!);
 assert.equal(parsed.hostname,'127.0.0.1');assert.equal(parsed.port,'55611');assert.equal(parsed.pathname,'/qr_calendar_test');
 const db=new PrismaClient();const users:number[]=[];
 try {
  const admin=await db.user.create({data:{login:'calendar-integration-admin',name:'Тестовый администратор',passwordHash:'unused-local-test',role:'ADMIN'}});users.push(admin.id);
  const employee=await db.user.create({data:{login:'calendar-integration-employee',name:'Тестовый сотрудник',passwordHash:'unused-local-test',role:'EMPLOYEE',department:'procurement'}});users.push(employee.id);
  const date='2026-11-10',now=new Date('2026-11-11T17:00:00+03:00');
  const plan=await db.workScheduleEntry.create({data:{userId:employee.id,date,department:'procurement',status:'off'}});
  const counts=async()=>Promise.all([db.workDayEntry.count(),db.workdayStartIntent.count(),db.shiftControlRun.count(),db.cashOperation.count(),db.workdayNotification.count(),db.adminInboxReceipt.count(),db.adminInboxDelivery.count()]);
  const before=await counts();
  const input={employeeId:employee.id,date,reason:'Сотрудник сообщил: работал, забыл QR',status:'working' as const,requestId:randomUUID(),expectedCorrectionId:null,actor:admin,now};
  const [first,retry]=await Promise.all([markCalendarWorking(db,input),markCalendarWorking(db,input)]);
  assert.equal(first.id,retry.id,'retry never doubles the audit event');
  assert.equal(await db.adminInboxEvent.count({where:{sourceType:'workday_calendar_fact',sourceId:{in:users.map(id=>`${id}:2026-11-10`)}}}),1);
  const correction=parseCalendarWorkingCorrection(first.body)!;
  assert.equal(correction.actorId,admin.id);assert.equal(correction.reason,input.reason);
  const base={date,department:'procurement',plan:'off',source:'Приложение',vacation:false,qrAccepted:false,now};
  assert.equal(resolveCalendarFact({...base,correction}).state,'working');
  assert.deepEqual(await counts(),before,'no fake QR/workday, task, money or notification writes');
  assert.deepEqual(await db.workScheduleEntry.findUnique({where:{id:plan.id}}),plan,'saved plan is unchanged');
  await assert.rejects(markCalendarWorking(db,{...input,requestId:randomUUID()}),/CALENDAR_STALE_CORRECTION/);
  await assert.rejects(markCalendarWorking(db,{...input,requestId:randomUUID(),actor:{...admin,role:'EMPLOYEE'}}),/CALENDAR_FORBIDDEN/);
  await assert.rejects(markCalendarWorking(db,{...input,date:'2026-11-12',requestId:randomUUID()}),/CALENDAR_INVALID_CORRECTION/);
  await assert.rejects(markCalendarWorking(db,{...input,reason:' ',requestId:randomUUID()}),/CALENDAR_INVALID_CORRECTION/);
  const cancelled=await markCalendarWorking(db,{...input,status:'reset',reason:'Уточнили: сотрудник не работал',requestId:randomUUID(),expectedCorrectionId:first.id,now:new Date(+now+1000)});
  assert.equal(resolveCalendarFact({...base,correction:parseCalendarWorkingCorrection(cancelled.body)}).state,'off');
  assert.equal(await db.adminInboxEvent.count({where:{sourceType:'workday_calendar_fact',sourceId:{in:users.map(id=>`${id}:2026-11-10`)}}}),2,'cancellation appends history instead of deleting it');
  assert.deepEqual(await counts(),before);
  const qr=await db.workdayStartIntent.create({data:{userId:employee.id,date,department:'procurement',qrAcceptedAt:new Date('2026-11-10T10:00:00+03:00'),expiresAt:new Date('2026-11-10T10:05:00+03:00')}});
  assert.ok(qr.id);
  assert.equal(resolveCalendarFact({...base,qrAccepted:true,correction:parseCalendarWorkingCorrection(cancelled.body)}).state,'working','real QR still wins after cancelling a manual correction');
 } finally {
  await db.adminInboxEvent.deleteMany({where:{sourceType:'workday_calendar_fact',sourceId:{in:users.map(id=>`${id}:2026-11-10`)}}});
  await db.user.deleteMany({where:{id:{in:users}}});await db.$disconnect();
 }
});
