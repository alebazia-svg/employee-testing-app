import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createKkmCloseConfirmation } from '../lib/kkm-close-confirmation';

test('the reopened credit scenario retires its owner question automatically and preserves counted cash, reserve, photo and history', {skip:process.env.KKM_CONFIRMATION_INTEGRATION!=='1'},async()=>{
 assert.equal(process.env.DATABASE_URL,'postgresql://postgres@127.0.0.1:55479/kkm_close_test','isolated test database only');
 const {prisma:db}=await import('../lib/prisma'),{recheckOpenKkmShiftCloseIssues:recheck}=await import('../lib/kkm-shift-close-control');
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/kkm-reopened-credit-close.normalized.json',import.meta.url),'utf8'));
 const now=new Date('2026-10-27T17:17:00Z'),endedAt=new Date('2026-10-27T17:12:48Z');
 const user=await db.user.create({data:{login:`kkm-reopened-credit-${Date.now()}`,name:'Учебный сотрудник',passwordHash:'disabled',role:'EMPLOYEE',department:'retail'}});
 const day=await db.workDayEntry.create({data:{userId:user.id,date:fixture.date,department:'retail',shiftCode:'11_20',shiftLabel:'11–20',status:'completed',endedAt}});
 const run=await db.shiftControlRun.create({data:{userId:user.id,workDayEntryId:day.id,date:day.date,department:'retail',status:'completed',completedAt:endedAt}});
 const task=await db.shiftControlTask.create({data:{runId:run.id,title:'Сдать смену',category:'handover',sortOrder:3,status:'done',completedAt:endedAt}});
 await db.userOneCCashboxMapping.create({data:{userId:user.id,oneCCashboxRef:'cash',oneCCashboxName:'Учебная касса',oneCCashierRef:fixture.cashierRef}});
 const original={personalCash:{cashBalance:750},reserveCash:{cashBalance:60000},oneCAudit:{capturedAt:'2026-10-27T17:09:38Z',personalCash:{status:'captured',balance:750},reserveCash:{status:'captured',balance:35000}},photos:{zReport:{storagePath:`uploads/shift-control/${run.id}/${task.id}/z-report-demo.jpg`,mimeType:'image/jpeg',sizeBytes:100}},cashRecountInputHistory:[{kind:'initial',value:750,enteredAt:'2026-10-27T17:09:38Z'}]};
 const confirmation=createKkmCloseConfirmation(original,user.id,run.id,task.id,endedAt)!;
 await db.shiftControlTask.update({where:{id:task.id},data:{handoverData:{...original,kkmCloseConfirmation:confirmation,kkmCloseCheck:{status:'unavailable'}}}});
 const issue=await db.workdayControlIssue.create({data:{userId:user.id,taskId:task.id,fingerprint:`kkm-shift-close:${day.id}`,ruleKey:'kkm_shift_not_closed',status:'open',severity:'warning',title:'Сверяем ОФД',detail:'Учебный сценарий',employeeActionRequired:false,originDate:day.date}});
 await db.workdayNotification.create({data:{userId:user.id,taskId:task.id,issueId:issue.id,fingerprint:`kkm-reopened-credit:${task.id}`,kind:'issue_reminder',title:'Учебное напоминание',body:'Учебный сценарий',scheduledAt:now}});
 let reports=fixture.reports.slice(0,1);
 const sources:any={loadOneCKkmChecks:async()=>({complete:true,data:fixture.checks}),getCashShifts:async()=>({ok:true,shifts:fixture.shifts}),loadPlatformaOfdZReports:async()=>({complete:true,data:reports})};
 try{
  assert.equal((await recheck(now,sources)).resolved,0,'an old closing report cannot clear the later credit receipt');
  reports=fixture.reports;
  assert.equal((await recheck(now,sources)).resolved,1);
  assert.equal((await recheck(now,sources)).resolved,0,'the completed incident must not be reopened or duplicated');
  const saved=await db.shiftControlTask.findUniqueOrThrow({where:{id:task.id}}),data=saved.handoverData as any;
  for(const key of Object.keys(original))assert.deepEqual(data[key],original[key as keyof typeof original]);
  assert.deepEqual(data.kkmCloseConfirmation,confirmation);
  assert.equal(data.kkmCloseCheck.status,'confirmed');assert.equal(data.kkmCloseCheck.evidence.fiscalShiftNumber,'343');
  assert.deepEqual(data.kkmCloseCheck.evidence.ofdClosures.map((row:any)=>row.shiftNumber),['342','343']);
  assert.equal((await db.workdayControlIssue.findUniqueOrThrow({where:{id:issue.id}})).status,'resolved');
  assert.equal(await db.workdayNotification.count({where:{issueId:issue.id,status:'pending'}}),0);
  assert.equal((await db.workDayEntry.findUniqueOrThrow({where:{id:day.id}})).endedAt?.toISOString(),endedAt.toISOString());
 }finally{await db.adminInboxEvent.deleteMany({where:{sourceType:'workday_control_issue',sourceId:String(issue.id)}});await db.user.delete({where:{id:user.id}});await db.$disconnect();}
});
test('saved employee confirmations stay ADMIN-only through outages and resolve automatically without rewriting cash', {skip:process.env.KKM_CONFIRMATION_INTEGRATION!=='1'},async()=>{
 assert.equal(process.env.DATABASE_URL,'postgresql://postgres@127.0.0.1:55479/kkm_close_test','isolated test database only');
 const {prisma:db}=await import('../lib/prisma');const {recheckOpenKkmShiftCloseIssues:recheck}=await import('../lib/kkm-shift-close-control');
 const now=new Date('2026-10-26T18:30:00Z');
 try {for(const method of ['photo','not_printed'] as const){
  const user=await db.user.create({data:{login:`kkm-confirm-${method}-${Date.now()}`,name:'Учебный сотрудник',passwordHash:'disabled',role:'EMPLOYEE',department:'retail'}});
  const day=await db.workDayEntry.create({data:{userId:user.id,date:'2026-10-26',department:'retail',shiftCode:'11_20',shiftLabel:'11–20',status:'completed',endedAt:now}});
  const run=await db.shiftControlRun.create({data:{userId:user.id,workDayEntryId:day.id,date:day.date,department:'retail',status:'completed',completedAt:now}});
  const task=await db.shiftControlTask.create({data:{runId:run.id,title:'Сдать смену',category:'handover',sortOrder:3,status:'done',completedAt:now}});
  await db.userOneCCashboxMapping.create({data:{userId:user.id,oneCCashboxRef:'cash',oneCCashboxName:'Учебная касса',oneCCashierRef:`cashier-${user.id}`}});
  const original={personalCash:{cashBalance:17702},oneCAudit:{capturedAt:'2026-10-26T18:11:07Z',personalCash:{status:'captured',balance:17702}},cashRecountInputHistory:[{kind:'initial',value:17702,enteredAt:'2026-10-26T18:11:07Z'}],photos:{zReport:method==='photo'?{storagePath:`uploads/shift-control/${run.id}/${task.id}/z-report-demo.jpg`,sizeBytes:100,mimeType:'image/jpeg'}:null}};
  const confirmation=createKkmCloseConfirmation(original,user.id,run.id,task.id,now,method)!;
  await db.shiftControlTask.update({where:{id:task.id},data:{handoverData:{...original,kkmCloseConfirmation:confirmation}}});
  const issue=await db.workdayControlIssue.create({data:{userId:user.id,taskId:task.id,fingerprint:`kkm-shift-close:${day.id}`,ruleKey:'kkm_shift_not_closed',severity:'warning',status:'open',title:'Проверка кассы',detail:'Учебная проверка',employeeActionRequired:false,originDate:day.date}});
  let reports:any[]=[],race=false;
  const check={cashier:{ref:`cashier-${user.id}`},cashRegisterRef:'kkm',kktRegistrationNumber:'kkt',dateTime:'2026-10-26T18:05:00Z',fiscalDateTime:'2026-10-26T18:05:00Z',fiscalDriveNumber:'fn',fiscalDocumentNumber:'123',fiscalSign:'456'};
  const shift={cashRegister:{ref:'kkm',name:'Учебная касса'},posted:true,deletionMark:false,number:'1080',fiscalShiftNumber:'76',openedAt:'2026-10-26T07:56:00Z',closedAt:'2026-10-26T18:17:29Z',datetime:'2026-10-26T07:56:00Z',status:'Закрыта'};
  const sources:any={loadOneCKkmChecks:async()=>({complete:true,data:[check]}),getCashShifts:async()=>{if(race){race=false;await db.shiftControlTask.update({where:{id:task.id},data:{comment:'Сохранён параллельный комментарий'}});}return{ok:true,shifts:[shift]};},loadPlatformaOfdZReports:async()=>({complete:true,data:reports})};
  try {
   await recheck(now,sources);await recheck(now,sources);
   const pending=await db.workdayControlIssue.findUniqueOrThrow({where:{id:issue.id}});assert.equal(pending.status,'open');assert.equal(pending.employeeActionRequired,false);assert.equal(pending.nextReminderAt,null);
   assert.equal(await db.adminInboxEvent.count({where:{sourceType:'workday_control_issue',sourceId:String(issue.id)}}),1,'repeated checks do not duplicate the owner event');
   reports=[{kktRegistrationNumber:'kkt',fiscalDriveNumber:'fn',shiftNumber:'76',openedAt:'2026-10-26T07:45:00Z',closedAt:'2026-10-26T18:06:00Z',documentLink:'demo-report'}];race=true;
   assert.equal((await recheck(now,sources)).resolved,0,'a concurrent task update must be retried before resolving its issue');
   assert.equal((await recheck(now,sources)).resolved,1);
   const saved=await db.shiftControlTask.findUniqueOrThrow({where:{id:task.id}}),data=saved.handoverData as any;
   for(const key of Object.keys(original))assert.deepEqual(data[key],original[key as keyof typeof original]);
   assert.equal(data.kkmCloseConfirmation.method,method);assert.equal(data.kkmCloseCheck.status,'confirmed');assert.equal(saved.comment,'Сохранён параллельный комментарий');
   assert.equal((await db.workdayControlIssue.findUniqueOrThrow({where:{id:issue.id}})).status,'resolved');assert.equal((await db.workDayEntry.findUniqueOrThrow({where:{id:day.id}})).status,'completed');
  } finally {await db.adminInboxEvent.deleteMany({where:{sourceType:'workday_control_issue',sourceId:String(issue.id)}});await db.user.delete({where:{id:user.id}});}
 }}finally{await db.$disconnect();}
});

test('an old failed check cannot restore a blocker after the employee responds and finishes', {skip:process.env.KKM_CONFIRMATION_INTEGRATION!=='1'},async()=>{
 assert.equal(process.env.DATABASE_URL,'postgresql://postgres@127.0.0.1:55479/kkm_close_test');
 const {prisma:db}=await import('../lib/prisma');const {recheckOpenKkmShiftCloseIssues:recheck,syncKkmShiftCloseIssue:sync}=await import('../lib/kkm-shift-close-control');
 const {updateActiveHandoverTask}=await import('../lib/workday-close-decision');
 const now=new Date('2026-10-26T18:30:00Z');
 const u=await db.user.create({data:{login:`kkm-stale-${Date.now()}`,name:'Учебный сотрудник',passwordHash:'disabled',role:'EMPLOYEE'}});
 const d=await db.workDayEntry.create({data:{userId:u.id,date:'2026-10-26',department:'retail',shiftCode:'11_20',shiftLabel:'11–20'}});
 const run=await db.shiftControlRun.create({data:{userId:u.id,workDayEntryId:d.id,date:d.date,department:'retail'}});
 const original={personalCash:{cashBalance:17702},photos:{zReport:null}};
 const task=await db.shiftControlTask.create({data:{runId:run.id,title:'Сдать смену',category:'handover',sortOrder:1,handoverData:original}});
 const issue=await db.workdayControlIssue.create({data:{userId:u.id,taskId:task.id,fingerprint:`kkm-shift-close:${d.id}`,ruleKey:'kkm_shift_not_closed',severity:'warning',title:'Подтвердите закрытие',detail:'Учебная проверка',employeeActionRequired:true,originDate:d.date}});
 await db.userOneCCashboxMapping.create({data:{userId:u.id,oneCCashboxRef:'cash',oneCCashboxName:'Учебная касса',oneCCashierRef:'cashier'}});
 let answered=false;
 const evidence:any={status:'unavailable',checkedAt:now.toISOString(),cashierRef:'cashier',cashRegisterRef:'kkm',cashRegisterName:'Учебная касса',kktRegistrationNumber:'kkt',oneCShiftNumber:'',fiscalShiftNumber:'',oneCOpenedAt:'',oneCClosedAt:'',ofdOpenedAt:'',ofdClosedAt:'',ofdDocumentLink:'',sourceError:'Источники ещё не ответили'};
 const sources:any={loadOneCKkmChecks:async()=>({complete:true,data:[{cashier:{ref:'cashier'},cashRegisterRef:'kkm',kktRegistrationNumber:'kkt',dateTime:'2026-10-26T18:05:00Z'}]}),getCashShifts:async()=>{
  if(!answered){answered=true;const confirmation=createKkmCloseConfirmation(original,u.id,run.id,task.id,now,'not_printed')!;await updateActiveHandoverTask(db,{taskId:task.id,workDayEntryId:d.id,data:{handoverData:{...original,kkmCloseConfirmation:confirmation}}});await sync(db,{userId:u.id,taskId:task.id,workDayEntryId:d.id,date:d.date,evidence,now,confirmationMethod:'not_printed'});await db.workDayEntry.update({where:{id:d.id},data:{endedAt:now,status:'completed'}});}
  return{ok:false,shifts:[]};},loadPlatformaOfdZReports:async()=>({complete:false,data:[]})};
 try{
  await recheck(now,sources);
  const latest=await db.workdayControlIssue.findUniqueOrThrow({where:{id:issue.id}});assert.equal(latest.employeeActionRequired,false,'late source result must not erase the employee response');assert.equal(latest.nextReminderAt,null);
  const saved=await db.shiftControlTask.findUniqueOrThrow({where:{id:task.id}});assert.equal((saved.handoverData as any).kkmCloseConfirmation.method,'not_printed');assert.equal((saved.handoverData as any).personalCash.cashBalance,17702);
  // The same guard also rejects a late draft/audit while the day is still active.
  await db.workDayEntry.update({where:{id:d.id},data:{endedAt:null,status:'active'}});
  const late=await updateActiveHandoverTask(db,{taskId:task.id,workDayEntryId:d.id,expectedUpdatedAt:task.updatedAt,data:{handoverData:original}} as any);
  assert.equal(late,null,'a stale draft must not overwrite the saved response');
 }finally{await db.adminInboxEvent.deleteMany({where:{sourceType:'workday_control_issue',sourceId:String(issue.id)}});await db.user.delete({where:{id:u.id}});await db.$disconnect();}
});
