import assert from 'node:assert/strict';
import test from 'node:test';
import {PrismaClient} from '@prisma/client';
import {submitDayReview,readDayReview,readAdminDayReview,decideDayReview,cancelDayReview} from '../lib/payroll-day-review-store';
import {readStoredPersonalCurrentPayroll} from '../lib/payroll-current-store';
import {applyApprovedPayrollDays} from '../lib/payroll-day-review';
const url=process.env.PAYROLL_DAY_REVIEW_TEST_DATABASE_URL;
test('isolated PostgreSQL: request, decision, accounting, source refresh and competing actions',{skip:!url},async()=>{
 assert.equal(new URL(url!).hostname,'127.0.0.1');assert.equal(new URL(url!).pathname,'/payroll_day_review_qa_20261031');assert.equal(process.env.PAYROLL_DAY_REVIEW_ENABLED,'1');
 const db=new PrismaClient({datasources:{db:{url}}});const id=6,period='2026-10';const created:string[]=[];
 const snap=await db.payrollAttendanceSnapshot.findUniqueOrThrow({where:{periodKey:period}});
 const currentPeriod=await db.payrollPeriod.findUniqueOrThrow({where:{periodKey:period}});
 const draft=await db.payrollDraftRevision.findFirstOrThrow({where:{periodKey:period},orderBy:{revision:'desc'}});
 const admin=await db.user.findFirstOrThrow({where:{role:'ADMIN',isActive:true}});
 const reload=()=>readStoredPersonalCurrentPayroll(period,id,db,async()=>null);
 try {
  const profile=await db.user.findUniqueOrThrow({where:{id}});assert.equal(profile.payrollName,'Кумахова Диана');
  // Rehearse the new dated source format on the disposable clone only.
  const fixture=structuredClone(snap.payload) as any;
  fixture.scheduleSummaries=fixture.scheduleSummaries.filter((r:any)=>!['Диана','Кумахова Диана'].includes(r.employee));
  fixture.scheduleSummaries.push({employee:'Кумахова Диана',scheduleDays:0});
  fixture.dayReviewSources=[{userId:id,employee:'Кумахова Диана',sourceEmployee:'Кумахова Диана',kind:'schedule',dates:[]}];
  await db.payrollAttendanceSnapshot.update({where:{id:snap.id},data:{payload:fixture}});
  const before=await reload();assert.ok(before);assert.equal(before.dayPay,0);
  const otherIds=[3,4,5,7,8];const others=await Promise.all(otherIds.map(i=>readStoredPersonalCurrentPayroll(period,i,db,async()=>null)));
  for(const dates of [[],['2026-10-31'],['2026-11-01'],['2026-09-01'],['2026-10-20','2026-10-20']])await assert.rejects(()=>submitDayReview(id,period,dates,db));
  const r=await submitDayReview(id,period,['2026-10-20','2026-10-21'],db);created.push(r.id);
  assert.equal((await submitDayReview(id,period,['2026-10-21','2026-10-20'],db)).id,r.id);
  assert.equal(await db.adminInboxEvent.count({where:{eventKey:'payroll-days:'+r.id}}),1);
  assert.equal((await reload())?.dayPay,0,'pending does not change salary');
  await assert.rejects(()=>readDayReview(3,period,db)); // No dated provenance for that captured profile; no foreign request is exposed.
  const read=await readAdminDayReview(r.id,db);assert.equal(read.additionalDays,2);assert.equal(read.amount,1200);
  await assert.rejects(()=>decideDayReview(r.id,id,'approved','',read.fingerprint!,db));
  await assert.rejects(()=>decideDayReview(r.id,admin.id,'approved','','stale',db));
  const oldFacts=await db.workDayEntry.count({where:{userId:id}});
  await decideDayReview(r.id,admin.id,'approved','',read.fingerprint!,db);
  await decideDayReview(r.id,admin.id,'approved','',read.fingerprint!,db);
  assert.equal((await reload())?.dayPay,1200);
  const enabled=process.env.PAYROLL_DAY_REVIEW_ENABLED,accounting=process.env.PAYROLL_DAY_REVIEW_ACCOUNTING_ENABLED;
  try {
   process.env.PAYROLL_DAY_REVIEW_ENABLED='0';process.env.PAYROLL_DAY_REVIEW_ACCOUNTING_ENABLED='1';
   assert.equal((await reload())?.dayPay,1200,'emergency UI disable retains approved accounting');
   await assert.rejects(()=>submitDayReview(id,period,['2026-10-29'],db));
  }finally{
   process.env.PAYROLL_DAY_REVIEW_ENABLED=enabled;
   if(accounting===undefined)delete process.env.PAYROLL_DAY_REVIEW_ACCOUNTING_ENABLED;else process.env.PAYROLL_DAY_REVIEW_ACCOUNTING_ENABLED=accounting;
  }
  assert.equal(await db.workdayNotification.count({where:{fingerprint:`payroll-days:${r.id}:approved`}}),1);
  assert.equal(await db.workDayEntry.count({where:{userId:id}}),oldFacts,'approval does not fabricate QR facts');
  await assert.rejects(()=>submitDayReview(id,period,['2026-10-20'],db));
  // A raw refresh must preserve approvals; a source later reporting an approved date counts it once.
  const raw=structuredClone(fixture) as any;
  const row=raw.scheduleSummaries.find((v:any)=>['Кумахова Диана','Диана'].includes(v.employee));assert.ok(row);row.scheduleDays=1;
  raw.dayReviewSources=[{userId:id,employee:'Кумахова Диана',sourceEmployee:row.employee,kind:'schedule',dates:['2026-10-20']}];
  await db.payrollAttendanceSnapshot.update({where:{id:snap.id},data:{payload:raw}});
  assert.equal((await reload())?.dayPay,1200,'Google/QR overlap never adds a third day');
  const all=await db.payrollDayReview.findMany({where:{id:r.id}});
  assert.equal(applyApprovedPayrollDays(raw,all).scheduleSummaries.find(v=>v.employee===row.employee)?.scheduleDays,2);
  const afterOthers=await Promise.all(otherIds.map(i=>readStoredPersonalCurrentPayroll(period,i,db,async()=>null)));assert.deepEqual(afterOthers,others);
  const r2=await submitDayReview(id,period,['2026-10-22'],db);created.push(r2.id);
  const d2=await readAdminDayReview(r2.id,db);
  await assert.rejects(()=>decideDayReview(r2.id,admin.id,'rejected','',d2.rejectionFingerprint!,db));
  await db.payrollAttendanceSnapshot.update({where:{id:snap.id},data:{sourceCheckedAt:new Date()}});
  await assert.rejects(()=>decideDayReview(r2.id,admin.id,'approved','',d2.fingerprint!,db),'changed source blocks stale approval');
  const fresh=await readAdminDayReview(r2.id,db);
  await decideDayReview(r2.id,admin.id,'rejected','Уточните дату выхода.',fresh.rejectionFingerprint!,db);
  assert.equal((await readDayReview(id,period,db)).requests[0].decisionComment,'Уточните дату выхода.');assert.equal((await reload())?.dayPay,1200);
  const r3=await submitDayReview(id,period,['2026-10-23'],db);created.push(r3.id);
  await assert.rejects(()=>cancelDayReview(r3.id,3,db));await cancelDayReview(r3.id,id,db);assert.equal((await reload())?.dayPay,1200);
  const r4=await submitDayReview(id,period,['2026-10-24'],db);created.push(r4.id);const d4=await readAdminDayReview(r4.id,db);
  await db.payrollPeriod.update({where:{id:currentPeriod.id},data:{status:'CLOSED'}});
  await assert.rejects(()=>decideDayReview(r4.id,admin.id,'approved','',d4.fingerprint!,db));
  assert.equal((await db.payrollDayReview.findUniqueOrThrow({where:{id:r4.id}})).status,'pending');
  const closedRead=await readAdminDayReview(r4.id,db);assert.equal(closedRead.accessOnly,true);
  const closedApproval=await decideDayReview(r4.id,admin.id,'approved','',closedRead.fingerprint!,db);
  assert.equal(closedApproval.accessOnly,true);assert.equal(closedApproval.approvedAmountCents,0);
  await db.payrollPeriod.update({where:{id:currentPeriod.id},data:{status:currentPeriod.status}});
  assert.equal((await reload())?.dayPay,1200,'closed approval cannot add money after reopen');
  const staleRequest=await submitDayReview(id,period,['2026-10-26'],db);created.push(staleRequest.id);
  const goodSource=await db.payrollAttendanceSnapshot.findUniqueOrThrow({where:{id:snap.id}});
  const unavailable=structuredClone(goodSource.payload) as any;delete unavailable.dayReviewSources;
  unavailable.scheduleSummaries=unavailable.scheduleSummaries.filter((r:any)=>!['Диана','Кумахова Диана'].includes(r.employee));
  await db.payrollAttendanceSnapshot.update({where:{id:snap.id},data:{payload:unavailable}});
  const blocked=await readAdminDayReview(staleRequest.id,db);assert.ok(blocked.approvalBlocked);assert.equal(blocked.fingerprint,null);
  await decideDayReview(staleRequest.id,admin.id,'rejected','Обновите данные и отправьте дни заново.',blocked.rejectionFingerprint!,db);
  await db.payrollAttendanceSnapshot.update({where:{id:snap.id},data:{payload:goodSource.payload as any}});
  const race=await Promise.allSettled([submitDayReview(id,period,['2026-10-25'],db),submitDayReview(id,period,['2026-10-25'],db)]);
  const pendingRace=await db.payrollDayReview.findMany({where:{employeeId:id,periodKey:period,status:'pending'}});assert.equal(pendingRace.length,1);created.push(pendingRace[0].id);
  assert.ok(race.some(r=>r.status==='fulfilled'));
  const r5=pendingRace[0],d5=await readAdminDayReview(r5.id,db);
  const brokenDb={$transaction:(callback:any,options:any)=>db.$transaction(tx=>callback(new Proxy(tx,{get(target,key){if(key==='workdayNotification')return {create:async()=>{throw Error('Simulated notification persistence failure');}};return Reflect.get(target,key);}})),options)} as any;
  await assert.rejects(()=>decideDayReview(r5.id,admin.id,'approved','',d5.fingerprint!,brokenDb));
  assert.equal((await db.payrollDayReview.findUniqueOrThrow({where:{id:r5.id}})).status,'pending','failed notification rolls back the decision');assert.equal((await reload())?.dayPay,1200);
  const approvalRace=await Promise.allSettled([decideDayReview(r5.id,admin.id,'approved','',d5.fingerprint!,db),decideDayReview(r5.id,admin.id,'approved','',d5.fingerprint!,db)]);
  assert.ok(approvalRace.some(r=>r.status==='fulfilled'));assert.equal((await reload())?.dayPay,1800);assert.equal(await db.workdayNotification.count({where:{fingerprint:`payroll-days:${r5.id}:approved`}}),1);
  console.log('VERIFIED: independent requests, one event, pending/rejected unchanged, approval +1200, duplicate/overlap safe, source refresh retained, five other employees identical, CLOSED protected, zero QR writes');
 }finally{
  await db.payrollPeriod.update({where:{id:currentPeriod.id},data:{status:currentPeriod.status}});
  await db.payrollAttendanceSnapshot.update({where:{id:snap.id},data:{payload:snap.payload as any,sourceCheckedAt:snap.sourceCheckedAt,updatedAt:snap.updatedAt}});
  await db.workdayNotification.deleteMany({where:{fingerprint:{in:created.flatMap(id=>[`payroll-days:${id}:approved`,`payroll-days:${id}:rejected`])}}});
  await db.adminInboxEvent.deleteMany({where:{eventKey:{in:created.map(id=>'payroll-days:'+id)}}});
  await db.payrollDayReview.deleteMany({where:{id:{in:created}}});
  assert.deepEqual((await db.payrollDraftRevision.findUniqueOrThrow({where:{id:draft.id}})).payload,draft.payload);
  await db.$disconnect();
 }
});
