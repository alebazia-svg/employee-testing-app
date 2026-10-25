import 'server-only';
import { Prisma } from '@prisma/client';
import { expenseRecord as record } from './expense-request-list-view';
import { prisma } from './prisma';
import { handoverCashExpenses } from './handover-cash-expenses';
/** Existing synchronized 1C snapshots only; no writes and no new source calls. */
export async function loadHandoverCashExpenses(userId:number,input:{actual:number;expected:number|null;capturedAt:string},now=new Date()) {
 const mapping=await prisma.userOneCCashboxMapping.findUnique({where:{userId}});
 const cashboxRef=mapping?.isActive?mapping.oneCCashboxRef:'';
 if(!cashboxRef||input.expected===null||input.actual>=input.expected)return null;
 const [owners,run]=await Promise.all([
  prisma.userOneCCashboxMapping.count({where:{isActive:true,oneCCashboxRef:cashboxRef,user:{isActive:true}}}),
  prisma.expenseRequestSyncRun.findFirst({where:{status:{not:'running'}},orderBy:{startedAt:'desc'}}),
 ]);
 if(owners!==1||run?.status!=='completed'||!run.sourceComplete||!run.completedAt||+now-+run.completedAt>360000||+run.completedAt>+now)return undefined;
 const cases=await prisma.expenseRequestAdminCase.findMany({where:{deletionMark:false,currentStatusKey:{in:['payable','approved','not_approved']}}});
 const evaluations=cases.length?await prisma.expenseRequestAdminEvaluation.findMany({where:{OR:cases.map(r=>({caseId:r.id,sourceHash:r.latestSourceHash}))},select:{caseId:true,normalizedSource:true}}):[];
 const sources=new Map(evaluations.map(r=>[r.caseId,r.normalizedSource]));
 if(cases.some(r=>!sources.has(r.id)))return undefined;
 return handoverCashExpenses({...input,cashboxRef,uniqueOwner:true,complete:true,checkedAt:run.completedAt.toISOString(),now:+now,rows:cases.map(r=>({source:sources.get(r.id),seenAt:r.lastSeenAt.toISOString(),cycle:r.notApprovedCycle}))});
}

/** Re-evaluate responsibility after approval/RKO sync without changing the original count. */
export async function refreshHandoverCashExpenseNotices(now=new Date()) {
 const tasks=await prisma.shiftControlTask.findMany({where:{category:'handover',handoverData:{path:['personalCash','discrepancyType'],equals:'shortage'}},include:{run:{select:{userId:true}}}});
 for(const task of tasks){
  const data=record(task.handoverData),cash=record(data.personalCash),audit=record(data.oneCAudit),snapshot=record(audit.personalCash);
  if(typeof cash.cashBalance!=='number'||typeof snapshot.balance!=='number'||typeof audit.capturedAt!=='string')continue;
  const evidence=await loadHandoverCashExpenses(task.run.userId,{actual:cash.cashBalance,expected:snapshot.balance,capturedAt:audit.capturedAt},now);
  // Don't erase a previous explanation during a technical gap; presentation rechecks live evidence.
  if(evidence===undefined)continue;
  const notice=evidence?{...evidence,requestRefs:[],documentRefs:[]}:null;
  const old=record(data.cashExpenseNotice);
  if(!notice&&!data.cashExpenseNotice)continue;
  if(notice&&old.state===notice.state&&old.approvalAmount===notice.approvalAmount&&old.payableAmount===notice.payableAmount&&old.documentedAmount===notice.documentedAmount)continue;
  await prisma.shiftControlTask.updateMany({where:{id:task.id,updatedAt:task.updatedAt},data:{handoverData:{...data,handoverExpenses:evidence??null,cashExpenseNotice:notice} as Prisma.InputJsonValue}});
 }
}
