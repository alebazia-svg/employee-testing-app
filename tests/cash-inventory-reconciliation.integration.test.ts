import test from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {reconcileCashInventoryIssues} from '../lib/cash-inventory-reconciliation';
import type {OneCCashStatementSummaryResult} from '../lib/one-c';
const enabled=process.env.CASH_INVENTORY_INTEGRATION==='1';
const now=new Date('2026-10-26T22:00:00Z');
async function fixture(){
 assert.equal(process.env.DATABASE_URL,'postgresql://postgres@127.0.0.1:55479/kkm_close_test','isolated local database only');
 const db=new PrismaClient(),id=randomUUID();
 const user=await db.user.create({data:{login:'inventory-'+id,name:'Учебный сотрудник',passwordHash:'disabled',role:'EMPLOYEE'}});
 const day=await db.workDayEntry.create({data:{userId:user.id,date:'2026-10-26',department:'wholesale',shiftCode:'full',shiftLabel:'Учебная',status:'completed',endedAt:now}});
 const run=await db.shiftControlRun.create({data:{userId:user.id,workDayEntryId:day.id,date:day.date,department:'wholesale',status:'completed'}});
 const original={oneCAudit:{capturedAt:'2026-10-26T11:12:00Z',personalCash:{status:'captured',balance:3020.25,cashboxRef:'cash'}},cashRecountInputHistory:[{value:3020,kind:'initial',enteredAt:'2026-10-26T11:12:00Z'}],photos:{retained:'unchanged'}};
 const task=await db.shiftControlTask.create({data:{runId:run.id,title:'Пересчитать',category:'cash',sortOrder:1,status:'done',numericValue:3020,handoverData:original}});
 const issue=await db.workdayControlIssue.create({data:{userId:user.id,taskId:task.id,fingerprint:id,ruleKey:'cash_recount_mismatch',severity:'warning',title:'Разница',detail:'0,25',sourceData:{taskId:task.id,actual:3020,expected:3020.25,capturedAt:original.oneCAudit.capturedAt},employeeActionRequired:false}});
 const notification=await db.workdayNotification.create({data:{userId:user.id,issueId:issue.id,taskId:task.id,fingerprint:id,kind:'issue_reminder',title:'Учебное',body:'Учебное',scheduledAt:now}});
 const statement:OneCCashStatementSummaryResult={ok:true,path:'/cash-statement-summary',durationMs:1,checkedAt:now.toISOString(),params:{date:day.date,organizationRef:'org',cashboxRef:'cash'},register:'cash',date:day.date,cashbox:{ref:'cash',name:'Учебная касса',deleted:false},organization:{ref:'org',name:'ОФФОНИКА',deleted:false},openingBalance:5000.25,incomingTotal:100,outgoingTotal:0.25,closingBalance:5100,movementsCount:2,diagnostics:[],movements:[{period:'26.10.2026 14:18:00',incoming:100,outgoing:0,documentType:'Приходный кассовый ордер',document:{ref:'sale',name:'Продажа'}},{period:'26.10.2026 16:48:35',incoming:0,outgoing:0.25,documentType:'Инвентаризация наличных денежных средств',document:{ref:'inventory',name:'Учебная инвентаризация'}}]};
 const sources={dimensions:async()=>({ok:true,path:'/cash-statement-dimensions' as const,durationMs:1,checkedAt:now.toISOString(),organizations:[statement.organization!],cashboxes:[statement.cashbox!],diagnostics:[]}),statement:async()=>statement};
 return{db,user,task,issue,notification,original,statement,sources,cleanup:async()=>{await db.user.delete({where:{id:user.id}});await db.$disconnect();}};
}
test('inventory retires only the derived issue and queued reminder; counted facts remain byte-for-byte unchanged',{skip:!enabled},async()=>{
 const f=await fixture();try{
  const before=await f.db.shiftControlTask.findUniqueOrThrow({where:{id:f.task.id}});
  assert.equal((await reconcileCashInventoryIssues(now,f.db,f.sources)).resolved,1);
  assert.deepEqual(await f.db.shiftControlTask.findUniqueOrThrow({where:{id:f.task.id}}),before);
  const issue=await f.db.workdayControlIssue.findUniqueOrThrow({where:{id:f.issue.id}});
  assert.equal(issue.status,'resolved');assert.equal((issue.sourceData as any).actual,3020);assert.equal((issue.sourceData as any).inventoryResolution.documentRef,'inventory');
  assert.equal((await f.db.workdayNotification.findUniqueOrThrow({where:{id:f.notification.id}})).status,'cancelled');
 }finally{await f.cleanup();}
});
test('a concurrent recount edit or unavailable statement cannot close the old issue',{skip:!enabled},async()=>{
 const f=await fixture();try{
  const unavailable={...f.sources,statement:async()=>({...f.statement,ok:false})};
  assert.equal((await reconcileCashInventoryIssues(now,f.db,unavailable)).resolved,0);
  let edited=false;const race={...f.sources,statement:async()=>{if(!edited){edited=true;await f.db.shiftControlTask.update({where:{id:f.task.id},data:{numericValue:3021}});}return f.statement;}};
  assert.equal((await reconcileCashInventoryIssues(now,f.db,race)).resolved,0);
  assert.equal((await f.db.workdayControlIssue.findUniqueOrThrow({where:{id:f.issue.id}})).status,'open');
  assert.equal((await f.db.shiftControlTask.findUniqueOrThrow({where:{id:f.task.id}})).numericValue,3021);
 }finally{await f.cleanup();}
});

test('slow 1C reads use their actual check time rather than the dispatcher start time',{skip:!enabled},async()=>{
 const f=await fixture(),started=Date.now();try{
  const sources={dimensions:async()=>{await new Promise(resolve=>setTimeout(resolve,30));return f.sources.dimensions();},statement:async()=>({...f.statement,checkedAt:new Date(+now+Date.now()-started).toISOString()})};
  assert.equal((await reconcileCashInventoryIssues(now,f.db,sources)).resolved,1);
 }finally{await f.cleanup();}
});
