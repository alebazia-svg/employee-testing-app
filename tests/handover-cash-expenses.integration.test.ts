import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { refreshHandoverCashExpenseNotices } from '../lib/handover-cash-expense-snapshot';
const enabled=process.env.HANDOVER_CASH_INTEGRATION==='1'&&process.env.DATABASE_URL==='postgresql://preview:handover-local-only@127.0.0.1:55471/handover_preview';
test('isolated persisted handover: approval, payable, posted and reversed documents preserve original cash', {skip:!enabled},async()=>{
 const item=await prisma.expenseRequestAdminCase.findUniqueOrThrow({where:{oneCRequestRef:'local-request-1141'}});
 const task=await prisma.shiftControlTask.findFirstOrThrow({where:{category:'handover'}});
 const original=task.handoverData as any;
 const evalRow=await prisma.expenseRequestAdminEvaluation.findFirstOrThrow({where:{caseId:item.id,sourceHash:item.latestSourceHash}});
 const base=evalRow.normalizedSource as any;
 async function set(stage:string){
  const now=new Date(),s=structuredClone(base),paid=stage==='documented';
  s.status.key=stage==='not_approved'?'not_approved':'payable';
  s.execution={...s.execution,state:paid?'fully_executed':'not_executed',executed_amount:paid?16000:0,remaining_amount:paid?0:16000};
  s.linkedCashExpenseOrders.rows=paid?[{ref:'test-rko',date:new Date(Date.parse(original.oneCAudit.capturedAt)+1000).toISOString(),posted:true,deletion_mark:false,amount:16000,request_amount:16000,executed_amount:16000,cashbox:{ref:s.cashbox.ref},source_paths:['payment_line.request']}]:[];
  const hash='lifecycle-'+stage+Date.now();
  await prisma.expenseRequestAdminCase.update({where:{id:item.id},data:{latestSourceHash:hash,lastSeenAt:now,currentStatusKey:s.status.key}});
  const {id:_id,createdAt:_createdAt,evaluatedAt:_evaluatedAt,...e}=evalRow;
  await prisma.expenseRequestAdminEvaluation.create({data:{...e,categoryCandidates:e.categoryCandidates??[],reasonCodes:e.reasonCodes??[],missingInformation:e.missingInformation??[],decisionSources:e.decisionSources??[],sourceHash:hash,normalizedSource:s}});
  await prisma.expenseRequestSyncRun.update({where:{id:evalRow.syncRunId},data:{completedAt:now,startedAt:now}});
  await refreshHandoverCashExpenseNotices(now);
  const current=await prisma.shiftControlTask.findUniqueOrThrow({where:{id:task.id}}),d=current.handoverData as any;
  assert.deepEqual(d.oneCAudit,original.oneCAudit);assert.deepEqual(d.personalCash,original.personalCash);assert.deepEqual(d.cashRecountInputHistory,original.cashRecountInputHistory);
  return d.cashExpenseNotice;
 }
 try {
  assert.equal((await set('not_approved')).state,'awaiting_approval');
  assert.equal((await set('payable')).state,'awaiting_documents');
  assert.equal((await set('documented')).state,'documented');
  assert.equal((await set('payable')).state,'awaiting_documents','reversal must restore employee action');
 } finally {await prisma.$disconnect();}
});
