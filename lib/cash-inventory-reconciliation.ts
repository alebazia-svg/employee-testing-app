import 'server-only';
import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from './prisma';
import { getCashStatementDimensions, getCashStatementSummary } from './one-c';
import { createCashInventoryLookup } from './cash-inventory-lookup';
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
/** Retire only the exact stale control issue; cash tasks and original facts remain untouched. */
export async function reconcileCashInventoryIssues(now=new Date(),db:PrismaClient=prisma,sources={dimensions:getCashStatementDimensions,statement:getCashStatementSummary}) {
 const started=Date.now(),clock=()=>new Date(+now+Date.now()-started);
 const issues=await db.workdayControlIssue.findMany({where:{status:'open',ruleKey:'cash_recount_mismatch'},include:{task:{include:{run:true,manualReviews:{orderBy:[{reviewedAt:'desc'},{id:'desc'}],take:1}}}}});
 if(!issues.length)return {checked:0,resolved:0};
 const dimensions=await sources.dimensions();
 const organization=dimensions.ok?(dimensions.organizations.find(o=>o.name.toLowerCase().includes('оффоника'))??dimensions.organizations[0]):null;
 if(!organization)return {checked:0,resolved:0};
 const lookup=createCashInventoryLookup({organizationRef:organization.ref,now:clock(),db,load:sources.statement});let resolved=0;
 for(const issue of issues){
  const task=issue.task;if(!task||task.category!=='cash'||task.status!=='done'||task.run.userId!==issue.userId||task.manualReviews[0]?.decision==='confirmed_issue')continue;
  const data=record(task.handoverData),audit=record(data.oneCAudit),cash=record(audit.personalCash),source=record(issue.sourceData);
  if(typeof task.numericValue!=='number'||cash.status!=='captured'||typeof cash.balance!=='number'||typeof cash.cashboxRef!=='string'||typeof audit.capturedAt!=='string'||source.taskId!==task.id||source.capturedAt!==audit.capturedAt||source.actual!==task.numericValue||source.expected!==cash.balance)continue;
  const statement=await sources.statement({date:task.run.date,organizationRef:organization.ref,cashboxRef:cash.cashboxRef});
  const resolution=await lookup({actual:task.numericValue,expected:cash.balance,capturedAt:audit.capturedAt,cashboxRef:cash.cashboxRef,statement});
  if(!resolution)continue;
  const changed=await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "WorkdayControlIssue" WHERE id = ${issue.id} FOR UPDATE`;
   await tx.$queryRaw`SELECT id FROM "ShiftControlTask" WHERE id = ${task.id} FOR UPDATE`;
   const current=await tx.shiftControlTask.findUnique({where:{id:task.id},select:{updatedAt:true,handoverData:true,numericValue:true,status:true,manualReviews:{orderBy:[{reviewedAt:'desc'},{id:'desc'}],take:1}}});
   if(!current||current.status!=='done'||current.numericValue!==task.numericValue||current.manualReviews[0]?.decision==='confirmed_issue'||+current.updatedAt!==+task.updatedAt||JSON.stringify(current.handoverData)!==JSON.stringify(task.handoverData))return false;
   const update=await tx.workdayControlIssue.updateMany({where:{id:issue.id,status:'open',updatedAt:issue.updatedAt},data:{status:'resolved',resolvedAt:clock(),nextReminderAt:null,employeeActionRequired:false,title:'Расхождение оформлено инвентаризацией',sourceData:{...source,inventoryResolution:resolution} as Prisma.InputJsonValue}});
   if(!update.count)return false;
   await tx.workdayNotification.updateMany({where:{issueId:issue.id,status:'pending'},data:{status:'cancelled',pushStatus:'cancelled',nextPushAttemptAt:null}});
   return true;
  });
  if(changed)resolved++;
 }
 return {checked:issues.length,resolved};
}
