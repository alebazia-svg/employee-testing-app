import assert from 'node:assert/strict';
import test from 'node:test';
import {PrismaClient} from '@prisma/client';
import {readPayrollAccess} from '../lib/employee-payroll-access-store';
const url=process.env.PAYROLL_DAY_REVIEW_TEST_DATABASE_URL;
test('isolated PostgreSQL: tomorrow plan blocks even after today start, then unlocks immediately',{skip:!url},async()=>{
 assert.equal(new URL(url!).hostname,'127.0.0.1');assert.equal(new URL(url!).pathname,'/payroll_day_review_qa_20261031');
 const db=new PrismaClient({datasources:{db:{url}}}),userId=8,today='2026-10-31',tomorrow='2026-11-01';
 const dates=[today,tomorrow],now=new Date(today+'T14:00:00+03:00');
 const plans=await db.workScheduleEntry.findMany({where:{userId,date:{in:dates}}});
 const old=await db.workDayEntry.findUnique({where:{userId_date:{userId,date:today}}});
 let createdId:number|undefined;
 try{
  await db.workScheduleEntry.deleteMany({where:{userId,date:{in:dates}}});
  await db.workScheduleEntry.create({data:{userId,date:today,department:'retail',status:'working'}});
  const day=await db.workDayEntry.upsert({where:{userId_date:{userId,date:today}},create:{userId,date:today,department:'retail',shiftCode:'qa',shiftLabel:'Local test only',startedAt:new Date(today+'T09:15:00+03:00')},update:{startedAt:new Date(today+'T09:15:00+03:00'),status:'active',endedAt:null}});
  if(!old)createdId=day.id;
  assert.equal((await readPayrollAccess(userId,now,db))?.kind,'schedule');
  for(const status of ['off','working']){
   await db.workScheduleEntry.upsert({where:{userId_date:{userId,date:tomorrow}},create:{userId,date:tomorrow,department:'retail',status},update:{status}});
   assert.equal(await readPayrollAccess(userId,now,db),null);
  }
  await db.workDayEntry.update({where:{id:day.id},data:{startedAt:new Date('2026-10-30T09:00:00+03:00')}});
  assert.equal((await readPayrollAccess(userId,now,db))?.kind,'start','invalid date fact cannot replace today QR');
 }finally{
  await db.$transaction(async tx=>{
   await tx.workScheduleEntry.deleteMany({where:{userId,date:{in:dates}}});
   if(plans.length)await tx.workScheduleEntry.createMany({data:plans});
   if(old)await tx.workDayEntry.update({where:{id:old.id},data:{startedAt:old.startedAt,status:old.status,endedAt:old.endedAt,updatedAt:old.updatedAt}});
   else if(createdId)await tx.workDayEntry.delete({where:{id:createdId}});
  });
  await db.$disconnect();
 }
});
test('disabled feature does not access the new table or affect old installation',async()=>{
 const old=process.env.PAYROLL_DAY_REVIEW_ENABLED;delete process.env.PAYROLL_DAY_REVIEW_ENABLED;
 try{assert.equal(await readPayrollAccess(8,new Date(),{$transaction:()=>{throw Error('database must not be read');}} as any),null);}finally{process.env.PAYROLL_DAY_REVIEW_ENABLED=old;}
});
