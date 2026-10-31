import assert from 'node:assert/strict';
import test from 'node:test';
import {PrismaClient} from '@prisma/client';
import {readPayrollAccess} from '../lib/employee-payroll-access-store';
import {readAdminDayReview,readDayReview,submitDayReview,decideDayReview,cancelDayReview,overlayApprovedDays} from '../lib/payroll-day-review-store';
const url=process.env.PAYROLL_DAY_REVIEW_TEST_DATABASE_URL;
test('closed/FINAL month: approval removes attendance obligation without changing any financial record',{skip:!url},async()=>{
 assert.equal(new URL(url!).hostname,'127.0.0.1');assert.equal(new URL(url!).pathname,'/payroll_day_review_qa_20261031');
 const db=new PrismaClient({datasources:{db:{url}}}),userId=8,periodKey='2026-10',date='2026-10-31',now=new Date('2026-11-01T10:00:00+03:00');
 const period=await db.payrollPeriod.findUniqueOrThrow({where:{periodKey}});
 const admin=await db.user.findFirstOrThrow({where:{role:'ADMIN',isActive:true}});
 const dates=[date,'2026-11-01','2026-11-02'];const plans=await db.workScheduleEntry.findMany({where:{userId,date:{in:dates}}});
 assert.equal(await db.workDayEntry.count({where:{userId,date}}),0,'fixture must not replace real QA attendance');
 const ids:string[]=[];let finalId:number|undefined;
 const moneyState=async()=>JSON.stringify(await Promise.all([
  db.payrollRun.findMany({where:{periodId:period.id},orderBy:{id:'asc'},include:{employeeResults:{orderBy:{id:'asc'}},manualInputs:true,adjustments:true,analyticsRows:true,sourceFiles:true}}),
  db.payrollAttendanceSnapshot.findUnique({where:{periodKey}}),db.payrollDraftRevision.findMany({where:{periodKey},orderBy:{revision:'asc'}}),
  db.payrollFinboxRevision.findMany({where:{periodKey},orderBy:{revision:'asc'}}),db.payrollOneCControlSnapshot.findMany({where:{periodKey},orderBy:{id:'asc'}}),
  db.workDayEntry.findMany({where:{userId},orderBy:{id:'asc'}}),
 ]));
 try{
  await db.workScheduleEntry.deleteMany({where:{userId,date:{in:dates}}});
  await db.workScheduleEntry.createMany({data:dates.map(d=>({userId,date:d,department:'retail',status:d===date?'working':'off'}))});
  for(const mode of ['CLOSED','FINAL']){
   await db.payrollPeriod.update({where:{id:period.id},data:{status:mode==='CLOSED'?'CLOSED':'OPEN'}});
   if(mode==='FINAL'){
    const last=await db.payrollRun.aggregate({where:{periodId:period.id},_max:{runNumber:true}});
    const final=await db.payrollRun.create({data:{periodId:period.id,runNumber:(last._max.runNumber??0)+1,status:'FINAL',grossPay:12345,netPay:12000}});finalId=final.id;
   }
   const before=await moneyState();assert.equal((await readPayrollAccess(userId,now,db))?.kind,'days_review');
   const view=await readDayReview(userId,periodKey,db,now);assert.equal(view.accessOnly,true);assert.equal(view.reviewRequired,true);assert.ok(!view.knownDates.includes(date));
   const r=await submitDayReview(userId,periodKey,[date],db,now);ids.push(r.id);assert.equal(r.accessOnly,true);
   assert.equal((await readPayrollAccess(userId,now,db))?.title,'Выходы на подтверждении');
   await assert.rejects(()=>cancelDayReview(r.id,3,db));
   const review=await readAdminDayReview(r.id,db,now);assert.equal(review.accessOnly,true);assert.equal(review.amount,0);
   await assert.rejects(()=>decideDayReview(r.id,userId,'approved','',review.fingerprint!,db,now));
   await decideDayReview(r.id,admin.id,'approved','',review.fingerprint!,db,now);
   await decideDayReview(r.id,admin.id,'approved','',review.fingerprint!,db,now);
   const approved=await db.payrollDayReview.findUniqueOrThrow({where:{id:r.id}});assert.equal(approved.accessOnly,true);assert.equal(approved.approvedAdditionalDays,0);assert.equal(approved.approvedAmountCents,0);
   await assert.rejects(()=>db.payrollDayReview.update({where:{id:r.id},data:{approvedAmountCents:100}}),'database refuses money on attendance-only approval');
   assert.equal(await readPayrollAccess(userId,now,db),null,'only the missing attendance obligation is cleared');
   assert.equal((await readDayReview(userId,periodKey,db,now)).reviewRequired,false,'request page and salary share the same completed access decision');
   assert.equal(await moneyState(),before,'runs, individual results, drafts, input snapshots, Finbox and QR facts are unchanged');
   const raw=await db.payrollAttendanceSnapshot.findUniqueOrThrow({where:{periodKey}});
   const overlaid=await overlayApprovedDays(db,raw.payload as any,userId);assert.deepEqual(overlaid.approvedDayReviewIds,[]);assert.deepEqual(overlaid.formSummaries,(raw.payload as any).formSummaries);
   // Retain approval purpose after reopening: it must never become a payroll correction.
   if(finalId){await db.payrollRun.delete({where:{id:finalId}});finalId=undefined;}
   await db.payrollPeriod.update({where:{id:period.id},data:{status:'OPEN'}});
   const afterReopen=await overlayApprovedDays(db,raw.payload as any,userId);assert.deepEqual(afterReopen.formSummaries,(raw.payload as any).formSummaries);
   await db.workdayNotification.deleteMany({where:{fingerprint:'payroll-days:'+r.id+':approved'}});
   await db.adminInboxEvent.deleteMany({where:{sourceType:'payroll_day_review',sourceId:r.id}});
   await db.payrollDayReview.delete({where:{id:r.id}});ids.splice(ids.indexOf(r.id),1);
  }
 }finally{
  await db.$transaction(async tx=>{
   if(finalId)await tx.payrollRun.delete({where:{id:finalId}});
   await tx.workdayNotification.deleteMany({where:{userId,fingerprint:{in:ids.map(id=>'payroll-days:'+id+':approved')}}});
   await tx.adminInboxEvent.deleteMany({where:{sourceType:'payroll_day_review',sourceId:{in:ids}}});
   await tx.payrollDayReview.deleteMany({where:{id:{in:ids}}});
   await tx.payrollPeriod.update({where:{id:period.id},data:{status:period.status,updatedAt:period.updatedAt}});
   await tx.workScheduleEntry.deleteMany({where:{userId,date:{in:dates}}});if(plans.length)await tx.workScheduleEntry.createMany({data:plans});
  });await db.$disconnect();
 }
});

test('open month: a day already counted from Google can resolve missing QR without double pay',{skip:!url},async()=>{
 assert.equal(new URL(url!).pathname,'/payroll_day_review_qa_20261031');
 const db=new PrismaClient({datasources:{db:{url}}}),employeeId=8,periodKey='2026-10',date='2026-10-31',now=new Date('2026-11-01T10:00:00+03:00');
 const original=await db.payrollAttendanceSnapshot.findUniqueOrThrow({where:{periodKey}});
 const period=await db.payrollPeriod.findUniqueOrThrow({where:{periodKey}});assert.notEqual(period.status,'CLOSED');
 const admin=await db.user.findFirstOrThrow({where:{role:'ADMIN',isActive:true}});
 const payload=structuredClone(original.payload) as any;const name='Хурзокова Лиана';
 payload.formSummaries=payload.formSummaries.filter((r:any)=>!['Лиана','Ляна',name].includes(r.employee));
 payload.formSummaries.push({employee:name,formRows:1,uniqueFormDates:1,workedDays:1,lateCount:0});
 payload.dayReviewSources=[...(payload.dayReviewSources??[]).filter((r:any)=>r.userId!==employeeId),{userId:employeeId,employee:name,sourceEmployee:name,kind:'form',dates:[date]}];
 let id:string|undefined;
 try{
  await db.payrollAttendanceSnapshot.update({where:{id:original.id},data:{payload}});
  const view=await readDayReview(employeeId,periodKey,db,now);assert.ok(!view.knownDates.includes(date),'financial source is not proof of a QR start');
  const request=await submitDayReview(employeeId,periodKey,[date],db,now);id=request.id;assert.equal(request.accessOnly,false);
  const review=await readAdminDayReview(id,db,now);assert.equal(review.additionalDays,0);assert.equal(review.amount,0);
  await decideDayReview(id,admin.id,'approved','',review.fingerprint!,db,now);
  const result=await overlayApprovedDays(db,payload,employeeId);
  assert.equal(result.formSummaries.find(r=>r.employee===name)?.workedDays,1);
  assert.equal(await db.workDayEntry.count({where:{userId:employeeId,date}}),0,'no fabricated QR fact');
 }finally{
  if(id){await db.workdayNotification.deleteMany({where:{fingerprint:'payroll-days:'+id+':approved'}});await db.adminInboxEvent.deleteMany({where:{sourceType:'payroll_day_review',sourceId:id}});await db.payrollDayReview.delete({where:{id}});}
  await db.payrollAttendanceSnapshot.update({where:{id:original.id},data:{payload:original.payload as any,sourceCheckedAt:original.sourceCheckedAt,updatedAt:original.updatedAt}});await db.$disconnect();
 }
});
