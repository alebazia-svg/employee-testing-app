import 'server-only';
import {extraReceiptTransaction} from './terminal-extra-receipt-transaction';
import {createHash} from 'node:crypto';
import type {PrismaClient,Prisma} from '@prisma/client';
import {detectPossibleExtraReceipts,extraReceiptSnapshotComplete,netConfirmedReceiptReversals,EXTRA_RECEIPT_RULE,type ExtraReceiptSnapshot} from './terminal-extra-receipts';
const obj=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function syncExtraReceiptIssues(db:PrismaClient,snapshot:ExtraReceiptSnapshot,confirmedRefs:Set<string>,notifyEmployees=false){
 if(!extraReceiptSnapshotComplete(snapshot))return {opened:0,resolved:0};
 const cases=detectPossibleExtraReceipts(snapshot),reversals=netConfirmedReceiptReversals(snapshot);
 return extraReceiptTransaction(db,async tx=>{
  let opened=0,resolved=0;
  for(const c of cases){
   const mapping=await tx.userOneCCashboxMapping.findFirst({where:{oneCCashierRef:c.cashierRef,isActive:true,user:{isActive:true,role:'EMPLOYEE',department:'retail'}},select:{userId:true}});
   if(!mapping)continue;
   const fingerprint=`extra-receipt:${hash(c.key)}`,existing=await tx.workdayControlIssue.findUnique({where:{fingerprint}});
   const sourceData={...obj(existing?.sourceData),...c,ruleVersion:1,checkedAt:snapshot.now};
   const issue=await tx.workdayControlIssue.upsert({where:{fingerprint},create:{fingerprint,userId:mapping.userId,ruleKey:EXTRA_RECEIPT_RULE,severity:'warning',title:'Возможный лишний чек в 1С',detail:'На одну оплату найдены два чека.',sourceData:sourceData as Prisma.InputJsonValue,employeeActionRequired:notifyEmployees,originDate:new Date(Date.parse(c.bankAt)+10800000).toISOString().slice(0,10)},update:{sourceData:sourceData as Prisma.InputJsonValue,lastDetectedAt:new Date(snapshot.now)}});
   if(!existing)opened++;
   // A previously adjudicated or reassigned case cannot be silently reopened/rerouted.
   if(notifyEmployees&&issue.status==='open'&&issue.userId===mapping.userId){
    if(!issue.employeeActionRequired)await tx.workdayControlIssue.update({where:{id:issue.id},data:{employeeActionRequired:true}});
    await tx.workdayNotification.upsert({where:{fingerprint:`${fingerprint}:detected`},update:{},create:{fingerprint:`${fingerprint}:detected`,userId:issue.userId,issueId:issue.id,kind:'terminal_extra_receipt',title:issue.title,body:issue.detail,scheduledAt:new Date(snapshot.now)}});
   }
  }
  const active=await tx.workdayControlIssue.findMany({where:{ruleKey:EXTRA_RECEIPT_RULE,status:'open'}});
  for(const issue of active){
   const s=obj(issue.sourceData);if(s.mappingId!==snapshot.mapping.id||!Array.isArray(s.checkRefs)||!s.checkRefs.every(x=>typeof x==='string'))continue;
   const refs=s.checkRefs as string[];
   // Never resolve from a manager's answer, missing source row or balanced grand total.
   // Every original check must either remain uniquely matched or have an exact,
   // OFD-confirmed referenced reversal; at least one live matched sale must remain.
   const remaining=refs.filter(ref=>!reversals.pairs.some(p=>p.originalRef===ref));
   if(!remaining.length||!remaining.every(ref=>confirmedRefs.has(ref))||!refs.every(ref=>confirmedRefs.has(ref)||reversals.pairs.some(p=>p.originalRef===ref)))continue;
   await tx.workdayControlIssue.update({where:{id:issue.id},data:{status:'resolved',resolvedAt:new Date(snapshot.now),employeeActionRequired:false,nextReminderAt:null,sourceData:{...s,resolution:'confirmed_fiscal_chain',resolvedAt:snapshot.now} as Prisma.InputJsonValue}});
   await tx.workdayNotification.updateMany({where:{issueId:issue.id,status:'pending'},data:{status:'cancelled',pushStatus:'cancelled',nextPushAttemptAt:null}});resolved++;
  }
  return {opened,resolved};
 });
}
