import assert from 'node:assert/strict';
import test from 'node:test';
import {PrismaClient} from '@prisma/client';
import {PAYROLL_ACCESS_MANAGERS} from '../lib/employee-payroll-access';
import {readPayrollAccess} from '../lib/employee-payroll-access-store';
const url=process.env.PAYROLL_ACCESS_RECOVERY_TEST_DATABASE_URL;
test('all manager roles: missing past QR does not gate salary; planning and today start still do, with read-only access',{skip:!url},async()=>{
 assert.equal(new URL(url!).hostname,'127.0.0.1');assert.equal(new URL(url!).port,'55941');assert.equal(new URL(url!).pathname,'/payroll_day_review_qa_20261031');
 const db=new PrismaClient({datasources:{db:{url}}});const ids:number[]=[];
 const now=new Date('2026-11-25T14:00:00+03:00');
 try{
  for(const [i,name]of PAYROLL_ACCESS_MANAGERS.entries()){
   const existing=await db.user.findFirst({where:{payrollName:name}});
   // The disposable fixture may contain the UI actor; use only newly created actors here.
   if(existing){assert.equal(await readPayrollAccess(existing.id,now,db),null,'existing QR-started manager is not trapped by an older missing day');continue;}
   const u=await db.user.create({data:{name,payrollName:name,login:`past-day-qa-${i}`,passwordHash:'unused',role:'EMPLOYEE',department:i%2?'wholesale':'retail'}});ids.push(u.id);
   await db.workScheduleEntry.createMany({data:['2026-11-01','2026-11-25','2026-11-26'].map(date=>({userId:u.id,date,department:u.department,status:date==='2026-11-25'?'off':'working'}))});
   const before=await db.workScheduleEntry.findMany({where:{userId:u.id},orderBy:{date:'asc'}});
   assert.equal(await readPayrollAccess(u.id,now,db),null,name+' on day off: past plan is not evidence of an attendance obligation');
   assert.deepEqual(await db.workScheduleEntry.findMany({where:{userId:u.id},orderBy:{date:'asc'}}),before);
   assert.equal(await db.workDayEntry.count({where:{userId:u.id}}),0,'read cannot fabricate QR facts');
   await db.workScheduleEntry.update({where:{userId_date:{userId:u.id,date:'2026-11-25'}},data:{status:'working'}});
   assert.equal((await readPayrollAccess(u.id,now,db))?.kind,'start');
   const day=await db.workDayEntry.create({data:{userId:u.id,date:'2026-11-25',department:u.department,shiftCode:'qa',shiftLabel:'QA',startedAt:new Date('2026-11-25T09:00:00+03:00'),qrAcceptedAt:new Date('2026-11-25T09:00:00+03:00')}});
   assert.equal(await readPayrollAccess(u.id,now,db),null,'successful QR start opens access despite old missing day');
   assert.deepEqual(await db.workDayEntry.findUnique({where:{id:day.id}}),day,'read preserves active shift');
   await db.workScheduleEntry.delete({where:{userId_date:{userId:u.id,date:'2026-11-26'}}});
   assert.equal((await readPayrollAccess(u.id,now,db))?.kind,'schedule','tomorrow still required after QR');
   await db.workScheduleEntry.create({data:{userId:u.id,date:'2026-11-26',department:u.department,status:'off'}});
   assert.equal(await readPayrollAccess(u.id,now,db),null);
  }
  assert.ok(ids.length>=4);
  assert.equal(await db.payrollDayReview.count({where:{employeeId:{in:ids}}}),0);
  assert.equal(await db.payrollPeriod.count({where:{periodKey:'2026-11'}}),0,'salary access does not create a financial period');
  assert.equal(await db.payrollDraftRevision.count({where:{periodKey:'2026-11'}}),0);
 }finally{await db.user.deleteMany({where:{id:{in:ids}}});await db.$disconnect();}
});
