import 'server-only';
import { createHash } from 'node:crypto';
import { prisma } from './prisma';
import { freshEvidence } from './procurement-plan-revision-server';
import { readPaymentRevision } from './procurement-plan-revision';
import { COMPLETED_WITHOUT_TOPUP, completionRemainder, paymentCompletion } from './procurement-payment-completion';
import { planningRequestOverlap } from './procurement-planning-overlap';

export async function previewPaymentCompletion(id: string, action: 'COMPLETE' | 'REOPEN') {
  const plan = await prisma.supplierPaymentPlan.findUniqueOrThrow({where:{id}});
  if(plan.status !== (action === 'COMPLETE' ? 'APPROVED' : COMPLETED_WITHOUT_TOPUP)) throw Error('Статус заявки изменился. Обновите страницу.');
  if(readPaymentRevision(plan.oneCCashEvidence)) throw Error('Сначала рассмотрите изменения заявки.');
  const evidence = await freshEvidence();
  if(evidence.versions.get(id)!==plan.updatedAt.toISOString()) throw Error('Заявка изменилась. Повторите проверку.');
  const paid=evidence.get(id);
  if(!paid)throw Error('Не удалось проверить оплату заявки.');
  const completion=paymentCompletion(plan.oneCCashEvidence);
  if(action==='REOPEN'&&!completion)throw Error('Не найдена история завершения.');
  const remaining=action==='COMPLETE'?completionRemainder(plan,paid):{
    remainingAmount:completion!.remainingAmount,remainingForeignAmount:completion!.remainingForeignAmount,
  };
  const paymentRefs=[...new Set([...paid.cashOrders,...paid.currencyPayments].map(row=>row.ref))].sort();
  if(action==='COMPLETE' && (!paymentRefs.length||paymentRefs.some(ref=>!ref)))throw Error('Не удалось подтвердить расходники.');
  const quote=createHash('sha256').update(JSON.stringify({id,action,version:plan.updatedAt.toISOString(),remaining,paid})).digest('hex');
  return {plan,evidence,paid,paymentRefs,quote,...remaining};
}

export async function decidePaymentCompletion(id:string, actorId:number, input:{action:'COMPLETE'|'REOPEN';quote:string;reason:string}) {
  const reason=input.reason.trim();
  if(reason.length<3||reason.length>500)throw Error('Укажите причину: от 3 до 500 символов.');
  const preview=await previewPaymentCompletion(id,input.action);
  if(preview.quote!==input.quote)throw Error('Оплаты или заявка изменились. Закройте окно и проверьте заново.');
  return prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106241)`;
    const plans=await tx.supplierPaymentPlan.findMany();
    // Matching depends on all requests, not only the request being completed.
    if(plans.length!==preview.evidence.versions.size || plans.some(p=>preview.evidence.versions.get(p.id)!==p.updatedAt.toISOString()))throw Error('Заявки изменились во время проверки. Повторите действие.');
    const before=plans.find(p=>p.id===id)!;
    if(input.action==='REOPEN' && planningRequestOverlap([{supplierPartner:before.supplierPartner,orderRefs:Array.isArray(before.orderRefs)?before.orderRefs.map(String):[]}],plans.filter(p=>p.id!==id),preview.evidence))throw Error('Уже есть другая незавершённая заявка на эту оплату.');
    const previous=before.oneCCashEvidence&&typeof before.oneCCashEvidence==='object'&&!Array.isArray(before.oneCCashEvidence)?before.oneCCashEvidence:{};
    const completion=input.action==='COMPLETE'?{
      at:new Date().toISOString(),actorId,reason,remainingAmount:preview.remainingAmount,remainingForeignAmount:preview.remainingForeignAmount,
      paidAmount:preview.paid.issuedAmount+preview.paid.paidAmount,paidForeignAmount:preview.paid.paidForeignAmount,paymentRefs:preview.paymentRefs,
    }:null;
    const updated=await tx.supplierPaymentPlan.updateMany({where:{id,updatedAt:before.updatedAt,status:before.status},data:{
      status:input.action==='COMPLETE'?COMPLETED_WITHOUT_TOPUP:'APPROVED',oneCCashEvidence:{...previous,completion},
    }});
    if(updated.count!==1)throw Error('Заявка изменилась. Повторите действие.');
    await tx.supplierPaymentPlanEvent.create({data:{planId:id,actorUserId:actorId,action:input.action==='COMPLETE'?'COMPLETED_WITHOUT_TOPUP':'REOPENED',
      snapshot:JSON.parse(JSON.stringify({reason,before,completion,source:'portal_only_no_one_c_write'}))}});
    return {ok:true};
  });
}
