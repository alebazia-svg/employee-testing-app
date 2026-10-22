import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const enabled = process.env.PWA_CASH_INTEGRATION === '1';
test('isolated database: approval, reading, partial posting, outage, reversal and recount evidence', {skip:!enabled}, async()=>{
 const url=new URL(process.env.DATABASE_URL!);
 assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55449');assert.match(url.pathname,/^\/pwa_cash_review_/);
 const {prisma}=await import('../lib/prisma');
 const {syncExpenseRequestAdminAudit}=await import('../lib/expense-request-admin-sync');
 const {loadEmployeeExpenses}=await import('../lib/employee-expense-snapshot');
 const {queueEmployeeExpensePushes}=await import('../lib/employee-expense-notifications');
 const {buildCashRecountComparison,syncCashRecountWorkdayControl}=await import('../lib/cash-recount-control');
 const {pendingCashExpenseEvidence}=await import('../lib/cash-expense-evidence');
 const {reconcileCashExpenseEvidence}=await import('../lib/cash-expense-reconciliation');
 const {EMPLOYEE_EXPENSE_KIND}=await import('../lib/employee-expense-policy');
 const userId=20021,ref=randomUUID(),cashbox={ref:randomUUID(),name:'Integration test cashbox'},now=new Date(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(now);
 await prisma.user.upsert({where:{id:userId},create:{id:userId,login:'isolated.expense.integration',name:'Integration test',passwordHash:'disabled',role:'EMPLOYEE',portalArea:'WORKDAY',department:'wholesale'},update:{isActive:true}});
 await prisma.workdayNotification.updateMany({where:{userId,kind:EMPLOYEE_EXPENSE_KIND},data:{status:'cancelled'}});
 await prisma.userOneCCashboxMapping.upsert({where:{userId},create:{userId,oneCCashboxRef:cashbox.ref,oneCCashboxName:cashbox.name},update:{oneCCashboxRef:cashbox.ref}});
 const shift=await prisma.workDayEntry.upsert({where:{userId_date:{userId,date:day}},create:{userId,date:day,department:'wholesale',shiftCode:'09_19',shiftLabel:'09–19'},update:{}});
 const run=await prisma.shiftControlRun.upsert({where:{workDayEntryId:shift.id},create:{userId,workDayEntryId:shift.id,date:day,department:'wholesale'},update:{}});
 const task=await prisma.shiftControlTask.create({data:{runId:run.id,title:'Integration recount',category:'cash',sortOrder:1}});
 const row=(status:string,remaining:number)=>({ref,number:'INTEGRATION',date:new Date(+now-3600000).toISOString(),amount:3000,posted:true,deletion_mark:false,cashbox,currency:{name:'руб'},payment_form:{cash:true,cashless:false,card:false},status:{key:status},completeness:{complete:true},execution:{complete:true,state:remaining===0?'fully_executed':'not_executed',executed_amount:3000-remaining,remaining_amount:remaining},linked_cash_expense_orders:{complete:true,rows:remaining===3000?[]:[{ref:'integration-rko',date:new Date().toISOString(),posted:true,deletion_mark:false,amount:3000-remaining,executed_amount:3000-remaining,request_amount:3000-remaining,cashbox,source_paths:['payment_line.request']}]}});
 const sync=async(status:string,remaining:number,complete=true)=>{const at=new Date();await syncExpenseRequestAdminAudit({snapshot:{rows:[row(status,remaining)],complete,checkedAt:at.toISOString(),startedAt:at.toISOString(),pageCount:1,errors:[]},from:new Date(+now-86400000),to:new Date(+now+86400000),baseline:true});};
 try{
  await sync('not_approved',3000);
  const pending=await loadEmployeeExpenses(userId);assert.equal(pending.pending.length,1);
  const capturedAt=new Date().toISOString();const comparison=buildCashRecountComparison({actual:17000,expected:20000,capturedAt,cashboxName:cashbox.name});
  comparison.expenseEvidence=pendingCashExpenseEvidence({actual:17000,expected:20000,capturedAt,cashboxRef:cashbox.ref,snapshot:pending});assert.ok(comparison.expenseEvidence);
  await prisma.shiftControlTask.update({where:{id:task.id},data:{status:'done',numericValue:17000,handoverData:JSON.parse(JSON.stringify({cashComparison:comparison}))}});
  await syncCashRecountWorkdayControl(prisma,{userId,taskId:task.id,runId:run.id,date:day,comment:'',comparison,now:new Date()});
  let issue=await prisma.workdayControlIssue.findFirstOrThrow({where:{userId,taskId:task.id}});assert.equal(issue.title,'Ожидает оформления заявок');assert.equal(issue.employeeActionRequired,false);
  await sync('payable',3000);await queueEmployeeExpensePushes(new Date());
  let notice=await prisma.workdayNotification.findFirstOrThrow({where:{userId,kind:EMPLOYEE_EXPENSE_KIND,fingerprint:{contains:ref}}});
  await prisma.workdayNotification.update({where:{id:notice.id},data:{status:'sent',sentAt:new Date(),readAt:new Date()}});
  assert.equal((await loadEmployeeExpenses(userId)).payable.length,1,'reading does not finish the request');
  await sync('payable',1000);assert.equal((await loadEmployeeExpenses(userId)).payable[0].remaining,1000);
  await queueEmployeeExpensePushes(new Date());assert.equal(await prisma.workdayNotification.count({where:{userId,kind:EMPLOYEE_EXPENSE_KIND,fingerprint:{contains:ref}}}),1,'partial payment does not send a new approval');
  await sync('payable',0,false);await queueEmployeeExpensePushes(new Date());assert.equal((await loadEmployeeExpenses(userId)).state,'unavailable');
  assert.notEqual((await prisma.workdayNotification.findUniqueOrThrow({where:{id:notice.id}})).status,'cancelled','outage does not finish the task');
  await sync('payable',0);await queueEmployeeExpensePushes(new Date());assert.equal((await loadEmployeeExpenses(userId)).payable.length,0);
  await reconcileCashExpenseEvidence(new Date());issue=await prisma.workdayControlIssue.findUniqueOrThrow({where:{id:issue.id}});assert.equal(issue.status,'resolved');
  const saved=await prisma.shiftControlTask.findUniqueOrThrow({where:{id:task.id}});assert.equal(saved.numericValue,17000);assert.equal((saved.handoverData as any).cashComparison.expected,20000,'never rewrite the original 1C balance');
  await sync('payable',3000);await queueEmployeeExpensePushes(new Date());assert.equal((await loadEmployeeExpenses(userId)).payable.length,1,'reversed posting reopens work');
  notice=await prisma.workdayNotification.findUniqueOrThrow({where:{id:notice.id}});assert.equal(notice.status,'pending');assert.equal(notice.readAt,null);
  await reconcileCashExpenseEvidence(new Date());assert.equal((await prisma.workdayControlIssue.findUniqueOrThrow({where:{id:issue.id}})).status,'open','reversed RKO reopens the captured explanation');
 } finally {await prisma.user.update({where:{id:userId},data:{isActive:false}});await prisma.$disconnect();}
});
