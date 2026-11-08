import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {prisma} from '../lib/prisma';
import {writeEmployeeActivity} from '../lib/employee-activity';
import {employeeActivityReport} from '../lib/employee-activity-report';
import {managerActivity} from '../lib/employee-activity-presentation';
if(process.env.DATABASE_URL!=='postgresql://activity:local-activity-review-only@127.0.0.1:55508/activity_live_review')throw Error('DISPOSABLE_LOCAL_DATABASE_ONLY');
const users:number[]=[],attestations:number[]=[],plans:string[]=[],reviews:string[]=[];
const now=new Date(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(now);
async function person(){const user=await prisma.user.create({data:{login:'coverage-'+crypto.randomUUID(),name:'ДЕМО · проверка источников',passwordHash:'not-a-login',role:'EMPLOYEE'}});users.push(user.id);const session=await prisma.portalAccessSession.create({data:{userId:user.id,sessionHash:crypto.randomUUID(),device:'Mac',browser:'Chrome',browserInstanceId:crypto.randomUUID(),expiresAt:new Date(+now+86400000)}});return {user,session};}
async function plan(userId:number){const p=await prisma.supplierPaymentPlan.create({data:{managerUserId:userId,planCode:'DEMO-'+crypto.randomUUID(),supplierPartner:'ДЕМО · поставщик',orderRefs:[],orderNumbers:[],plannedDate:now,plannedAmount:100,condition:'test',paymentMethod:'CASH'}});plans.push(p.id);return p;}
async function days(userId:number){const r=await prisma.payrollDayReview.create({data:{employeeId:userId,payrollName:'ДЕМО',periodKey:date.slice(0,7),dates:[],dayRateCents:200000}});reviews.push(r.id);return r;}
test('recipient ownership is enforced before storing cross-resource observations',async()=>{
 const a=await person(),b=await person(),pa=await plan(a.user.id),pb=await plan(b.user.id),da=await days(a.user.id),db=await days(b.user.id);
 const exam=await prisma.attestation.create({data:{title:'ДЕМО · закрытая аттестация',passingScore:80,status:'DRAFT'}});attestations.push(exam.id);await prisma.attemptProgress.create({data:{userId:b.user.id,attestationId:exam.id,questionOrder:'[]'}});
 const send=(action:string,ref:string)=>writeEmployeeActivity(a.user.id,a.session.sessionHash,{key:crypto.randomUUID(),kind:'experience',context:{target:'workflow',action,stage:'opened',attemptId:crypto.randomUUID(),ref}} as any);
 assert.equal(await send('procurement_payment',pb.id),false);assert.equal(await send('procurement_receipt',pb.id),false);assert.equal(await send('salary_review',db.id),false);assert.equal(await send('learning',String(exam.id)),false);
 assert.equal(await send('procurement_payment',pa.id),true);assert.equal(await send('salary_review',da.id),true);
 assert.equal(await prisma.portalActivityEvent.count({where:{userId:a.user.id}}),2);
});
test('real saved learning, payment and review records are read without exposing answers, snapshots or private fields',async()=>{
 const {user,session}=await person(),p=await plan(user.id),r=await days(user.id);
 const exam=await prisma.attestation.create({data:{title:'ДЕМО · точное название обучения',passingScore:80,status:'ACTIVE'}});attestations.push(exam.id);
 const progress=await prisma.attemptProgress.create({data:{userId:user.id,attestationId:exam.id,questionOrder:'[]',answers:'SECRET-ANSWER-MUST-NOT-LEAK'}});
 await prisma.supplierPaymentPlanEvent.create({data:{planId:p.id,actorUserId:user.id,action:'SUBMITTED',snapshot:{private:'SECRET-SNAPSHOT-MUST-NOT-LEAK'}}});
 await writeEmployeeActivity(user.id,session.sessionHash,{key:crypto.randomUUID(),kind:'experience',context:{target:'workflow',action:'learning',stage:'opened',attemptId:crypto.randomUUID(),ref:String(exam.id),operation:'learning_load'}});
 let report=await employeeActivityReport(user.id,date),rows=managerActivity(report).rows;
 assert.equal(rows.find(v=>v.item.id===`workflow:learning:${exam.id}`)?.status,'observed');assert.equal(rows.find(v=>v.item.id===`workflow:payment:${p.id}`)?.status,'question');assert.equal(rows.find(v=>v.item.id===`workflow:day-review:${r.id}`)?.status,'question');
 assert.doesNotMatch(JSON.stringify(report),/SECRET-|passwordHash|sessionHash|questionOrder|correctIndex/);
 await prisma.$transaction([prisma.attemptProgress.delete({where:{id:progress.id}}),prisma.result.create({data:{userId:user.id,attestationId:exam.id,status:'Не сдал',percent:0,correctCount:0,totalQuestions:1,mistakes:1,details:'SECRET-RESULT-MUST-NOT-LEAK'}}),prisma.payrollDayReview.update({where:{id:r.id},data:{status:'cancelled',decidedAt:new Date()}})]);
 report=await employeeActivityReport(user.id,date);rows=managerActivity(report).rows;
 const learned=rows.find(v=>v.item.id===`workflow:learning:${exam.id}`)!;assert.equal(learned.item.title,exam.title);assert.equal(learned.status,'question');assert.match(learned.result,/не сдал/);
 const cancelled=rows.find(v=>v.item.id===`workflow:day-review:${r.id}`)!;assert.equal(cancelled.status,'result');assert.match(cancelled.result,/отменён/);assert.equal(cancelled.history.filter(h=>h.raw.some(s=>s.origin==='system')).length,2);
 assert.doesNotMatch(JSON.stringify(report),/SECRET-/);
});
test('a foreign employee cannot appear in saved facts or names; old result context does not create work today',async()=>{
 const own=await person(),foreign=await person(),p=await plan(foreign.user.id);
 await prisma.supplierPaymentPlanEvent.create({data:{planId:p.id,actorUserId:foreign.user.id,action:'SUBMITTED',snapshot:{}}});
 const exam=await prisma.attestation.create({data:{title:'ДЕМО · результат прошлого дня',passingScore:80,status:'ACTIVE'}});attestations.push(exam.id);
 await prisma.result.create({data:{userId:own.user.id,attestationId:exam.id,date:new Date(+now-86400000),status:'Сдал',percent:100,correctCount:1,totalQuestions:1,mistakes:0,details:'[]'}});
 await writeEmployeeActivity(own.user.id,own.session.sessionHash,{key:crypto.randomUUID(),kind:'experience',context:{target:'workflow',action:'learning',stage:'completed_view',attemptId:crypto.randomUUID(),ref:String(exam.id),operation:'learning_load'}});
 const report=await employeeActivityReport(own.user.id,date),view=managerActivity(report);
 assert.equal(view.counts.result,0);assert.match(view.rows[0].result,/ранее сдана/);assert.equal(report.workflowFacts?.some(f=>f.ref===p.id),false);assert.equal(report.workflowContexts?.some(f=>f.key===`payment:${p.id}`),false);
 const snapshot=JSON.stringify(await prisma.user.findUnique({where:{id:own.user.id}}));await employeeActivityReport(own.user.id,date);assert.equal(JSON.stringify(await prisma.user.findUnique({where:{id:own.user.id}})),snapshot);
});
after(async()=>{await prisma.supplierPaymentReceipt.deleteMany({where:{planId:{in:plans}}});await prisma.supplierPaymentPlan.deleteMany({where:{id:{in:plans}}});await prisma.payrollDayReview.deleteMany({where:{id:{in:reviews}}});await prisma.attestation.deleteMany({where:{id:{in:attestations}}});await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();});
test('a delivery gap is explicit and stored workday outcomes remain separate from merely requesting permission',async()=>{
 const {user,session}=await person();
 await writeEmployeeActivity(user.id,session.sessionHash,{key:crypto.randomUUID(),kind:'experience',context:{target:'workflow',action:'app',stage:'collection_gap',attemptId:crypto.randomUUID()}});
 const day=await prisma.workDayEntry.create({data:{userId:user.id,date,department:'retail',shiftCode:'test',shiftLabel:'ДЕМО',startedAt:new Date()}});
 const exception=await prisma.workdayCloseExceptionRequest.create({data:{workDayEntryId:day.id,employeeId:user.id,reasonCode:'technical',comment:'PRIVATE_COMMENT_NOT_FOR_TELEMETRY',issueIds:[]}});
 const ref=exception.id;
 assert.equal(await writeEmployeeActivity(user.id,session.sessionHash,{key:crypto.randomUUID(),kind:'experience',context:{target:'workflow',action:'close_request',stage:'response_received',attemptId:crypto.randomUUID(),ref,operation:'workday_close_request'}}),true);
 const report=await employeeActivityReport(user.id,date);assert.equal(report.truncated,true);
 const row=managerActivity(report).rows.find(r=>r.item.id===`workflow:close-request:${ref}`)!;assert.equal(row.status,'question');assert.match(row.result,/ожидается решение/);assert.doesNotMatch(JSON.stringify(report),/PRIVATE_COMMENT/);
 assert.equal((await prisma.workDayEntry.findUnique({where:{id:day.id}}))?.endedAt,null);
});
test('real document save and duplicate retry appear as one saved outcome without exposing the file or changing payment figures',async()=>{
 const {saveProcurementReceipt}=await import('../lib/procurement-receipts');
 const {mkdtemp,rm}=await import('node:fs/promises');const os=await import('node:os');const path=await import('node:path');
 const {user}=await person();const actor=await prisma.user.update({where:{id:user.id},data:{portalArea:'PROCUREMENT'}});const original=await plan(user.id);
 const p=await prisma.supplierPaymentPlan.update({where:{id:original.id},data:{status:'APPROVED',paymentMethod:'ACCOUNTABLE_QR'}});
 const root=await mkdtemp(path.join(os.tmpdir(),'activity-coverage-document-'));
 try{
  const file=()=>new File(['%PDF-1.7\nPRIVATE_FILE_CONTENT\n%%EOF'],'PRIVATE_FILENAME_DO_NOT_EXPORT.pdf',{type:'application/pdf'});
  const saved=await saveProcurementReceipt(prisma,actor,p.id,file(),root,{purpose:'QR'});
  assert.equal((await saveProcurementReceipt(prisma,actor,p.id,file(),root,{purpose:'QR'})).duplicate,true);
  const report=await employeeActivityReport(user.id,date),row=managerActivity(report).rows.find(r=>r.item.id===`workflow:payment:${p.id}`)!;
  assert.equal(row.status,'result');assert.match(row.result,/Реквизиты.*сохранены/);assert.equal(row.item.workflowOutcome?.operation,'receipt_upload');
  assert.equal(report.workflowFacts?.filter(f=>f.key===`payment:${p.id}`).length,1);assert.doesNotMatch(JSON.stringify(report),/PRIVATE_FILE|PRIVATE_FILENAME/);
  assert.deepEqual(await prisma.supplierPaymentPlan.findUnique({where:{id:p.id}}),p);
  await prisma.adminInboxEvent.deleteMany({where:{OR:[{sourceId:saved.receipt.id},{eventKey:`procurement-receipt:${saved.receipt.id}`}]}});
 }finally{await rm(root,{recursive:true,force:true});}
});
test('real day-review cancellation is recipient scoped, persisted and visible without changing payroll rules',async()=>{
 const {cancelDayReview}=await import('../lib/payroll-day-review-store');const {user}=await person(),foreign=await person(),r=await days(user.id);
 const key=date.slice(0,7),before=await prisma.payrollPeriod.findUnique({where:{periodKey:key}});
 if(!before)await prisma.payrollPeriod.create({data:{periodKey:key,year:Number(key.slice(0,4)),month:Number(key.slice(5)),status:'OPEN'}});
 const old=process.env.PAYROLL_DAY_REVIEW_ENABLED;process.env.PAYROLL_DAY_REVIEW_ENABLED='1';
 try{
  await assert.rejects(cancelDayReview(r.id,foreign.user.id));const cancelled=await cancelDayReview(r.id,user.id);assert.equal(cancelled.status,'cancelled');
  assert.equal((await cancelDayReview(r.id,user.id)).status,'cancelled');
  const row=managerActivity(await employeeActivityReport(user.id,date)).rows.find(v=>v.item.id===`workflow:day-review:${r.id}`)!;assert.equal(row.status,'result');assert.match(row.result,/отменён/);assert.equal(row.history.length,2);
 }finally{if(old===undefined)delete process.env.PAYROLL_DAY_REVIEW_ENABLED;else process.env.PAYROLL_DAY_REVIEW_ENABLED=old;if(!before)await prisma.payrollPeriod.delete({where:{periodKey:key}});}
});
test('delivery manual requests are attributed only through the unique approved mapping and never imply a cash issue',async()=>{
 const {DELIVERY_PERSON,DELIVERY_SOURCE,DELIVERY_OPEN,DELIVERY_REQUEST_SOURCE,DELIVERY_MANUAL_REQUEST}=await import('../lib/procurement-delivery-policy');
 const a=await person(),b=await person();await prisma.user.update({where:{id:a.user.id},data:{portalArea:'PROCUREMENT',oneCManagerName:DELIVERY_PERSON.name}});
 const reminder=await prisma.adminInboxEvent.create({data:{eventKey:'coverage-delivery-'+crypto.randomUUID(),sourceType:DELIVERY_SOURCE,sourceId:DELIVERY_PERSON.ref,type:DELIVERY_OPEN,title:'ДЕМО',body:'ДЕМО',href:'/admin/expense-requests',occurredAt:new Date()}});
 const manual=await prisma.adminInboxEvent.create({data:{eventKey:`delivery:manual:${reminder.id}`,sourceType:DELIVERY_REQUEST_SOURCE,sourceId:DELIVERY_PERSON.ref,type:DELIVERY_MANUAL_REQUEST,title:'ДЕМО',body:'PRIVATE_DELIVERY_COMMENT',href:'/admin/expense-requests',occurredAt:new Date()}});
 try{
  const send=(u:typeof a)=>writeEmployeeActivity(u.user.id,u.session.sessionHash,{key:crypto.randomUUID(),kind:'experience',context:{target:'workflow',action:'procurement_delivery',stage:'response_received',attemptId:crypto.randomUUID(),ref:reminder.id,operation:'delivery_request'}});
  assert.equal(await send(b),false);assert.equal(await send(a),true);
  const report=await employeeActivityReport(a.user.id,date),row=managerActivity(report).rows.find(r=>r.item.id===`workflow:delivery:${reminder.id}`)!;
  assert.equal(row.status,'question');assert.match(row.result,/Запрос пополнения сохранён.*выдача денег не подтверждена/);assert.doesNotMatch(JSON.stringify(report),/PRIVATE_DELIVERY/);
  assert.equal((await employeeActivityReport(b.user.id,date)).workflowFacts?.some(f=>f.key===`delivery:${reminder.id}`),false);
  await prisma.user.update({where:{id:b.user.id},data:{portalArea:'PROCUREMENT',oneCManagerName:DELIVERY_PERSON.name}});
  assert.equal((await employeeActivityReport(a.user.id,date)).workflowFacts?.some(f=>f.key===`delivery:${reminder.id}`),false);
 }finally{await prisma.adminInboxEvent.deleteMany({where:{id:{in:[reminder.id,manual.id]}}});}
});
