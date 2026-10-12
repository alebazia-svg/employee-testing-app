import { prisma } from './prisma';
import { expenseRequestMoscowCalendarDate } from './expense-request-source';
import { freshEvidence } from './procurement-plan-revision-server';
import { assertRevisionPaymentSafety,readPaymentRevision,revisionChanges } from './procurement-plan-revision';
import { approvedEditData } from './procurement-approved-edit';
import { manualPaymentLinks } from './procurement-manual-payment-links';
import { notifyProcurementManagerAboutDecision } from './procurement-payment-notifications';

export async function editApprovedPlan(id:string,actorId:number,body:unknown) {
  const candidate=await prisma.supplierPaymentPlan.findUnique({where:{id}});
  if(!candidate||candidate.status!=='APPROVED')throw Error('Изменение доступно для согласованной незавершённой заявки.');
  const {data,reason}=approvedEditData(candidate,body,expenseRequestMoscowCalendarDate(new Date()));
  if(readPaymentRevision(candidate.oneCCashEvidence))throw Error('Сначала рассмотрите изменения, отправленные Астемиром.');
  const changes=revisionChanges(candidate,data);
  if(!changes.length)throw Error('Данные заявки не изменились.');
  const evidence=await freshEvidence();
  return prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106241)`;
    const before=await tx.supplierPaymentPlan.findUniqueOrThrow({where:{id}});
    if(before.status!=='APPROVED'||before.updatedAt.toISOString()!==candidate.updatedAt.toISOString()
      ||evidence.versions.get(id)!==before.updatedAt.toISOString()||readPaymentRevision(before.oneCCashEvidence))throw Error('Заявка изменилась. Обновите страницу.');
    const paid=evidence.get(id);if(!paid)throw Error('Не удалось проверить оплату заявки. Повторите позже.');
    assertRevisionPaymentSafety(before,data,paid);
    if(paid.paymentAmountNeedsConfirmation)throw Error('Сначала подтвердите сумму найденной оплаты.');
    const termsChanged=changes.some(c=>c.key!=='condition');
    if(paid.collection&&termsChanged)throw Error('Выдача уже назначена в 1С. Сначала измените или отмените её там, чтобы условия не расходились.');
    const identityChanged=changes.some(c=>['paymentMethod','currency'].includes(c.key));
    if(identityChanged&&manualPaymentLinks(before.oneCCashEvidence).length)throw Error('У заявки есть ручная привязка оплаты. Способ оплаты менять нельзя.');
    const previous=before.oneCCashEvidence&&typeof before.oneCCashEvidence==='object'&&!Array.isArray(before.oneCCashEvidence)?before.oneCCashEvidence:{};
    const changed=await tx.supplierPaymentPlan.updateMany({where:{id,status:'APPROVED',updatedAt:before.updatedAt},data:{
      plannedDate:new Date(`${data.plannedDate}T00:00:00Z`),plannedAmount:data.plannedAmount!,condition:data.condition,
      paymentMethod:data.paymentMethod,currency:data.currency,foreignAmount:data.foreignAmount,exchangeRate:data.exchangeRate,fundingSource:data.fundingSource,
      ...(identityChanged?{oneCCashEvidence:{...previous,paymentMatchFrom:new Date().toISOString()}}:{}),
    }});
    if(changed.count!==1)throw Error('Заявка изменилась. Обновите страницу.');
    const updated=await tx.supplierPaymentPlan.findUniqueOrThrow({where:{id}});
    const event=await tx.supplierPaymentPlanEvent.create({data:{planId:id,actorUserId:actorId,action:'UPDATED',snapshot:JSON.parse(JSON.stringify({before,after:updated,revision:{reason,changes}}))}});
    await notifyProcurementManagerAboutDecision({db:tx,plan:updated,decision:'APPROVED',revisionDecision:true,rescheduled:changes.every(c=>['plannedDate','condition'].includes(c.key))&&changes.some(c=>c.key==='plannedDate'),eventKey:event.id});
    return JSON.parse(JSON.stringify(updated));
  });
}
