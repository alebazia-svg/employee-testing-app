import 'server-only';
import type {PrismaClient} from '@prisma/client';
import {runTerminalFiscalHistoricalDryRun} from './terminal-fiscal-runner';

/** A failed/incomplete source must never prevent the employee finishing a day. */
export async function refreshHandoverReceipts(db:PrismaClient,input:{userId:number;date:string;department:string|null},run=runTerminalFiscalHistoricalDryRun) {
 if(input.department!=='retail')return;
 const from=new Date(`${input.date}T00:00:00+03:00`),now=new Date();
 const end=new Date(Math.min(+now,+from+86400000));
 if(!Number.isFinite(+from)||+end<=+from)return;
 const mappings=await db.terminalFiscalMapping.findMany({where:{isActive:true,effectiveFrom:{lt:end},OR:[{effectiveTo:null},{effectiveTo:{gt:from}}],workstation:{isActive:true}},select:{id:true}});
 await Promise.allSettled(mappings.map(m=>run({mappingId:m.id,periodFrom:from,periodTo:end,persist:true,syncWorkdayControl:true,syncSourceHealth:true,closingEmployeeId:input.userId})));
}

/** Escalate only unresolved employee work after successful completion, once per day/review. */
export async function escalateHandoverReceipts(db:PrismaClient,input:{userId:number;date:string;workDayId:number},now=new Date()) {
 const from=new Date(`${input.date}T00:00:00+03:00`),to=new Date(+from+86400000);
 const reviews=await db.terminalFiscalEmployeeReview.findMany({where:{status:'open',bankOperationAt:{gte:from,lt:to},OR:[{employeeId:input.userId},{participants:{some:{userId:input.userId}}}]},select:{id:true,amountKopecks:true}});
 if(!reviews.length)return 0;
 const admins=await db.user.findMany({where:{role:'ADMIN',isActive:true},select:{id:true}});
 for(const review of reviews){
  const event=await db.adminInboxEvent.upsert({where:{eventKey:`fiscal-handover:${input.workDayId}:${review.id}`},create:{eventKey:`fiscal-handover:${input.workDayId}:${review.id}`,type:'terminal_fiscal_review.created',title:'После смены осталась проверка чека',body:`Оплата ${(review.amountKopecks/100).toLocaleString('ru-RU')} ₽. Смена завершена, вопрос ещё не решён.`,href:`/admin/workday/payment-checks/${review.id}`,sourceType:'terminal_fiscal_review',sourceId:review.id,occurredAt:now},update:{}});
  await db.adminInboxReceipt.createMany({data:admins.map(a=>({eventId:event.id,userId:a.id})),skipDuplicates:true});
 }
 return reviews.length;
}
