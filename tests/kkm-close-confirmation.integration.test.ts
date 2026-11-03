import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import { createKkmCloseConfirmation } from '../lib/kkm-close-confirmation';

test('a later OFD report resolves the existing attention workflow with an open 1C document and preserves cash history', {skip:process.env.KKM_CONFIRMATION_INTEGRATION!=='1'},async()=>{
 assert.equal(process.env.DATABASE_URL,'postgresql://postgres@127.0.0.1:55479/kkm_close_empty_20261101');
 const {prisma:db}=await import('../lib/prisma');const {verifyEmployeeKkmShiftClose:verify,syncKkmShiftCloseIssue:sync}=await import('../lib/kkm-shift-close-control');
 const {adminInboxSourceState}=await import('../lib/admin-operations-view');
 const key=String(Date.now()),start=new Date('2026-11-01T17:03:17Z');
 const user=await db.user.create({data:{login:'propagation-'+key,name:'Учебный сотрудник',passwordHash:'disabled',role:'EMPLOYEE',department:'retail'}});
 const day=await db.workDayEntry.create({data:{userId:user.id,date:'2026-11-01',department:'retail',shiftCode:'09_18',shiftLabel:'09–18',status:'active',startedAt:new Date('2026-11-01T05:57:00Z')}});
 const run=await db.shiftControlRun.create({data:{userId:user.id,workDayEntryId:day.id,date:day.date,department:'retail'}});
 const task=await db.shiftControlTask.create({data:{runId:run.id,title:'Сдать смену',category:'handover',sortOrder:1}});
 const original={personalCash:{cashBalance:750},reserveCash:{cashBalance:60000},photos:{zReport:null},cashRecountInputHistory:[{kind:'initial',value:750,enteredAt:start.toISOString()}]};
 await db.userOneCCashboxMapping.create({data:{userId:user.id,oneCCashboxRef:'cash',oneCCashboxName:'Учебная касса',oneCCashierRef:'cashier'}});
 const check={cashier:{ref:'cashier'},cashRegisterRef:'kkm',kktRegistrationNumber:'kkt',dateTime:'2026-11-01T16:55:15Z',fiscalDateTime:'2026-11-01T16:47:00Z',fiscalDriveNumber:'fn',fiscalDocumentNumber:'3306',fiscalSign:'20'};
 let reports:any[]=[];
 const sources:any={loadOneCKkmChecks:async()=>({complete:true,data:[check]}),getCashShifts:async()=>({ok:true,shifts:[{cashRegister:{ref:'kkm',name:'Учебная касса'},posted:true,number:'1093',fiscalShiftNumber:'348',status:'Открыта',openedAt:'2026-11-01T05:59:04Z',closedAt:'',datetime:'2026-11-01T05:59:04Z'}]}),loadPlatformaOfdZReports:async()=>({complete:true,data:reports})};
 try{
  const first=await verify({db,userId:user.id,date:day.date},sources);
  await db.shiftControlTask.update({where:{id:task.id},data:{handoverData:{...original,kkmCloseCheck:{status:first.status,startedAt:start.toISOString(),evidence:first}}}});
  const input={userId:user.id,taskId:task.id,workDayEntryId:day.id,date:day.date,evidence:first,now:start};
  const issue=await sync(db,input);assert.equal(issue?.employeeActionRequired,true);
  assert.equal(adminInboxSourceState({sourceType:'workday_control_issue',businessStatus:issue?.status,employeeActionRequired:issue?.employeeActionRequired,adminVerificationRequired:(issue?.sourceData as any)?.ownerVerificationRequired}).active,true);
  assert.equal(await db.workdayNotification.count({where:{issueId:issue!.id,status:'pending'}}),0);
  reports=[{kktRegistrationNumber:'kkt',fiscalDriveNumber:'fn',shiftNumber:'348',openedAt:'2026-11-01T05:50:00Z',closedAt:'2026-11-01T16:55:00Z',documentLink:'report'}];
  const confirmed=await verify({db,userId:user.id,date:day.date},sources);assert.equal(confirmed.status,'confirmed');assert.equal(confirmed.oneCClosedAt,'');
  await sync(db,{...input,evidence:confirmed,now:new Date(+start+25_000)});
  const saved=(await db.shiftControlTask.findUniqueOrThrow({where:{id:task.id}})).handoverData as any;
  for(const field of Object.keys(original))assert.deepEqual(saved[field],original[field as keyof typeof original]);
  assert.equal(saved.kkmCloseCheck.status,'confirmed');assert.deepEqual(saved.kkmCloseCheck.firstEvidence,first);
  assert.equal((await db.workdayControlIssue.findUniqueOrThrow({where:{id:issue!.id}})).status,'resolved');
  assert.equal(await db.workdayNotification.count({where:{issueId:issue!.id,status:'pending'}}),0);
 }finally{const issues=await db.workdayControlIssue.findMany({where:{userId:user.id},select:{id:true}});await db.adminInboxEvent.deleteMany({where:{sourceType:'workday_control_issue',sourceId:{in:issues.map(i=>String(i.id))}}});await db.user.delete({where:{id:user.id}});await db.$disconnect();}
});

test('prefetched OFD closes a completed empty shift without touching cash, photo, history or its original end time', {skip:process.env.KKM_CONFIRMATION_INTEGRATION!=='1'},async()=>{
 assert.equal(process.env.DATABASE_URL,'postgresql://postgres@127.0.0.1:55479/kkm_close_empty_20261101','dedicated isolated test database only');
 const {prisma:db}=await import('../lib/prisma'),{recheckOpenKkmShiftCloseIssues:recheck}=await import('../lib/kkm-shift-close-control');
 const {createKkmCloseReportCache,createKkmCloseReportLoader}=await import('../lib/kkm-close-report-cache');
 const {prefetchKkmCloseReports}=await import('../lib/kkm-close-prefetch');
 const now=new Date('2026-11-01T08:01:00Z'),ended=new Date('2026-11-01T08:00:56Z'),key=String(Date.now());
 const user=await db.user.create({data:{login:'kkm-empty-'+key,name:'Учебный сотрудник',passwordHash:'disabled',role:'EMPLOYEE',department:'retail'}});
 const day=await db.workDayEntry.create({data:{userId:user.id,date:'2026-11-01',department:'retail',shiftCode:'11_20',shiftLabel:'11–20',status:'completed',startedAt:new Date('2026-11-01T07:21:17Z'),endedAt:ended}});
 const run=await db.shiftControlRun.create({data:{userId:user.id,workDayEntryId:day.id,date:day.date,department:'retail',status:'completed',completedAt:ended}});
 const task=await db.shiftControlTask.create({data:{runId:run.id,title:'Сдать смену',category:'handover',sortOrder:1,status:'done',completedAt:ended}});
 const mapping=await db.terminalFiscalMapping.create({data:{terminalKey:'empty-'+key,oneCAcquiringTerminalRef:'terminal-'+key,oneCCashRegisterRef:'kkm-'+key,kktRegistrationNumber:'0010475338013250',effectiveFrom:new Date('2026-10-01')}});
 await db.userOneCCashboxMapping.create({data:{userId:user.id,oneCCashboxRef:'cash',oneCCashboxName:'Учебная касса',oneCCashierRef:'cashier-'+key,oneCCashRegisterRef:mapping.oneCCashRegisterRef}});
 const original={personalCash:{cashBalance:750},reserveCash:{cashBalance:0},oneCAudit:{capturedAt:ended.toISOString(),personalCash:{status:'captured',balance:750}},photos:{zReport:{storagePath:`uploads/shift-control/${run.id}/${task.id}/z-report-demo.jpg`,mimeType:'image/jpeg',sizeBytes:100}},cashRecountInputHistory:[{kind:'initial',value:750,enteredAt:ended.toISOString()}]};
 const confirmation=createKkmCloseConfirmation(original,user.id,run.id,task.id,ended)!;
 const failure={status:'unavailable',checkedAt:ended.toISOString(),sourceError:'Первоначальная причина сбоя'};
 await db.shiftControlTask.update({where:{id:task.id},data:{handoverData:{...original,kkmCloseConfirmation:confirmation,kkmCloseCheck:{status:'unavailable',evidence:failure}}}});
 const issue=await db.workdayControlIssue.create({data:{userId:user.id,taskId:task.id,fingerprint:`kkm-shift-close:${day.id}`,ruleKey:'kkm_shift_not_closed',severity:'warning',status:'open',title:'Сверяем ОФД',detail:'Учебный случай',employeeActionRequired:false,originDate:day.date}});
 const dir=await mkdtemp(path.join(tmpdir(),'kkm-empty-integration-'));
 let reads=0;const loader=createKkmCloseReportLoader({cache:createKkmCloseReportCache(dir,()=>+now),now:()=>+now,load:async()=>{reads++;return{complete:true,checkedAt:now.toISOString(),data:[{kktRegistrationNumber:mapping.kktRegistrationNumber,fiscalDriveNumber:'fn',shiftNumber:'82',openedAt:'2026-11-01T07:12:00Z',closedAt:'2026-11-01T07:47:00Z',documentLink:'report-82'}]};}});
 try{
  const before=await db.shiftControlTask.findUniqueOrThrow({where:{id:task.id}});
  await prefetchKkmCloseReports(now,db,loader);
  assert.deepEqual(await db.shiftControlTask.findUniqueOrThrow({where:{id:task.id}}),before,'warming sources must not change tasks or request a photo');
  const sources:any={loadOneCKkmChecks:async()=>({complete:true,data:[]}),getCashShifts:async()=>({ok:true,shifts:[{cashRegister:{ref:mapping.oneCCashRegisterRef,name:'Учебная ККТ'},posted:true,number:'1094',fiscalShiftNumber:'82',status:'Закрыта',openedAt:'2026-11-01T07:24:11Z',closedAt:'2026-11-01T07:59:33Z',datetime:'2026-11-01T07:24:11Z'}]}),loadPlatformaOfdZReports:loader};
  assert.equal((await recheck(now,sources)).resolved,1);assert.equal(reads,1,'the employee check must reuse the report fetched in advance');
  const saved=await db.shiftControlTask.findUniqueOrThrow({where:{id:task.id}}),data=saved.handoverData as any;
  for(const key of Object.keys(original))assert.deepEqual(data[key],original[key as keyof typeof original]);
  assert.deepEqual(data.kkmCloseConfirmation,confirmation);assert.deepEqual(data.kkmCloseCheck.firstEvidence,failure);assert.equal(data.kkmCloseCheck.status,'confirmed');assert.equal(data.kkmCloseCheck.evidence.workplaceBasis,'explicit_home_kkm');
  assert.equal((await db.workdayControlIssue.findUniqueOrThrow({where:{id:issue.id}})).status,'resolved');assert.equal((await db.workDayEntry.findUniqueOrThrow({where:{id:day.id}})).endedAt?.toISOString(),ended.toISOString());
 }finally{await db.adminInboxEvent.deleteMany({where:{sourceType:'workday_control_issue',sourceId:String(issue.id)}});await db.user.delete({where:{id:user.id}});await db.terminalFiscalMapping.delete({where:{id:mapping.id}});await rm(dir,{recursive:true,force:true});await db.$disconnect();}
});

test('the reopened credit scenario retires its owner question automatically and preserves counted cash, reserve, photo and history', {skip:process.env.KKM_CONFIRMATION_INTEGRATION!=='1'},async()=>{
 assert.equal(['postgresql://postgres@127.0.0.1:55479/kkm_close_test','postgresql://postgres@127.0.0.1:55479/kkm_close_empty_20261101'].includes(process.env.DATABASE_URL||''),true,'isolated test database only');
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
 assert.equal(['postgresql://postgres@127.0.0.1:55479/kkm_close_test','postgresql://postgres@127.0.0.1:55479/kkm_close_empty_20261101'].includes(process.env.DATABASE_URL||''),true,'isolated test database only');
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
 assert.equal(['postgresql://postgres@127.0.0.1:55479/kkm_close_test','postgresql://postgres@127.0.0.1:55479/kkm_close_empty_20261101'].includes(process.env.DATABASE_URL||''),true);
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
