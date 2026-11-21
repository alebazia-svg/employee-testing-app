import { assertUnpaidAction } from './procurement-unpaid-action';
import { paymentTargetChanged } from './procurement-debt-request';
import { planningRequestOverlap } from './procurement-planning-overlap';
import { validateBasisChangeTarget } from './procurement-basis-change-server';
import { prisma } from './prisma';
import { expenseRequestMoscowCalendarDate } from './expense-request-source';
import { freshEvidence } from './procurement-plan-revision-server';
import { assertRevisionPaymentSafety,readPaymentRevision,revisionChanges } from './procurement-plan-revision';
import { approvedEditData } from './procurement-approved-edit';
import { manualPaymentLinks } from './procurement-manual-payment-links';
import { notifyProcurementManagerAboutDecision, notifyProcurementManagerAboutPendingEdit } from './procurement-payment-notifications';

export async function editApprovedPlan(id:string,actorId:number,body:unknown) {
  const candidate=await prisma.supplierPaymentPlan.findUnique({where:{id},include:{manager:true}});
  if(!candidate||!['SUBMITTED','APPROVED'].includes(candidate.status))throw Error('Изменение доступно для заявки на согласовании или согласованной незавершённой заявки.');
  const {data:draft,reason}=approvedEditData(candidate,body,expenseRequestMoscowCalendarDate(new Date()));
  if(readPaymentRevision(candidate.oneCCashEvidence))throw Error('Сначала рассмотрите изменения, отправленные Астемиром.');
  const basisChanged=paymentTargetChanged(candidate,draft);
  const data=basisChanged?await validateBasisChangeTarget(candidate,draft,candidate.manager.oneCManagerName?.trim()||candidate.manager.name):draft;
  const changes=revisionChanges(candidate,data);
  if(!changes.length)throw Error('Данные заявки не изменились.');
  const evidence=await freshEvidence({guardPlanId: basisChanged || candidate.paymentMethod !== data.paymentMethod ? id : undefined});
  return prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106241)`;
    const before=await tx.supplierPaymentPlan.findUniqueOrThrow({where:{id}});
    if(before.status!==candidate.status||before.updatedAt.toISOString()!==candidate.updatedAt.toISOString()
      ||evidence.versions.get(id)!==before.updatedAt.toISOString()||readPaymentRevision(before.oneCCashEvidence))throw Error('Заявка изменилась. Обновите страницу.');
    const paid=evidence.get(id);if(!paid||paid.state==='SOURCE_UNAVAILABLE')throw Error('Не удалось проверить оплату заявки. Повторите позже.');
    assertRevisionPaymentSafety(before,data,paid);
    if(paid.paymentAmountNeedsConfirmation)throw Error('Сначала подтвердите сумму найденной оплаты.');
    const termsChanged=changes.some(c=>c.key!=='condition');
    if(paid.collection&&termsChanged)throw Error('Выдача уже назначена в 1С. Сначала измените или отмените её там, чтобы условия не расходились.');
    if(basisChanged || before.paymentMethod!==data.paymentMethod)await assertUnpaidAction(tx,before,paid);
    if(basisChanged){
      const others=await tx.supplierPaymentPlan.findMany({where:{id:{not:id},status:{in:['SUBMITTED','APPROVED','NEEDS_CHANGES']}}});
      if(planningRequestOverlap([data],others,evidence))throw Error('Эта оплата уже включена в другую незавершённую заявку.');
    }
    const identityChanged=basisChanged||changes.some(c=>['paymentMethod','currency'].includes(c.key));
    if(identityChanged&&manualPaymentLinks(before.oneCCashEvidence).length)throw Error('У заявки есть ручная привязка оплаты. Способ оплаты менять нельзя.');
    const previous=before.oneCCashEvidence&&typeof before.oneCCashEvidence==='object'&&!Array.isArray(before.oneCCashEvidence)?before.oneCCashEvidence:{};
    const changed=await tx.supplierPaymentPlan.updateMany({where:{id,status:before.status,updatedAt:before.updatedAt},data:{
      ...(basisChanged?{orderRefs:data.orderRefs,orderNumbers:data.orderNumbers,paymentPurpose:data.paymentPurpose,supplierCounterparty:data.supplierCounterparty}:{}),
      plannedDate:new Date(`${data.plannedDate}T00:00:00Z`),plannedAmount:data.plannedAmount!,condition:data.condition,
      paymentMethod:data.paymentMethod,currency:data.currency,foreignAmount:data.foreignAmount,exchangeRate:data.exchangeRate,fundingSource:data.fundingSource,
      ...(identityChanged?{oneCCashEvidence:{...previous,paymentMatchFrom:new Date().toISOString()}}:{}),
    }});
    if(changed.count!==1)throw Error('Заявка изменилась. Обновите страницу.');
    const updated=await tx.supplierPaymentPlan.findUniqueOrThrow({where:{id}});
    const event=await tx.supplierPaymentPlanEvent.create({data:{planId:id,actorUserId:actorId,action:'UPDATED',snapshot:JSON.parse(JSON.stringify({before,after:updated,revision:{reason,changes}}))}});
    if(before.status==='SUBMITTED')await notifyProcurementManagerAboutPendingEdit({db:tx,plan:updated,eventKey:event.id});
    else await notifyProcurementManagerAboutDecision({db:tx,plan:updated,decision:'APPROVED',revisionDecision:true,rescheduled:changes.every(c=>['plannedDate','condition'].includes(c.key))&&changes.some(c=>c.key==='plannedDate'),eventKey:event.id});
    return JSON.parse(JSON.stringify(updated));
  });
}
