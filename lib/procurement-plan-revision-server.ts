import { randomUUID } from 'node:crypto';
import { preservePaymentReview } from './procurement-buyer-comment';
import { prisma } from './prisma';
import { fetchSupplierCurrencyPaymentSnapshot } from './procurement-currency-payment-source';
import { fetchExpenseRequestSnapshot } from './expense-request-source';
import { paymentEvidenceFrom } from './procurement-ruble-payment-evidence';
import { matchProcurementPaymentEvidence } from './procurement-currency-payment-evidence';
import { manualPaymentLinks } from './procurement-manual-payment-links';
import { assertRevisionPaymentSafety, readPaymentRevision, revisionChanges, paymentMatchCreatedAt, type RevisionData } from './procurement-plan-revision';
import { notifyAdminsAboutProcurementPlans, notifyProcurementManagerAboutDecision } from './procurement-payment-notifications';
import { paymentBasisChanged } from './procurement-debt-request';
import { planningRequestOverlap } from './procurement-planning-overlap';
import { validateBasisChangeTarget } from './procurement-basis-change-server';

export async function freshEvidence() {
  const plans = await prisma.supplierPaymentPlan.findMany({ include: { manager: true } });
  const to = new Date(); const from = paymentEvidenceFrom(plans, new Date(to.getTime() - 31 * 86400000));
  const [source, requests] = await Promise.all([fetchSupplierCurrencyPaymentSnapshot({ from, to }), fetchExpenseRequestSnapshot({ from, to })]);
  if (!source.complete || !requests.complete) throw new Error('Не удалось проверить оплаты в 1С. Повторите изменение после восстановления связи.');
  const result = matchProcurementPaymentEvidence(plans.map(p => ({ ...p, orderRefs: Array.isArray(p.orderRefs) ? p.orderRefs.map(String) : [], plannedAmount: Number(p.plannedAmount), foreignAmount: p.foreignAmount == null ? null : Number(p.foreignAmount), plannedDate: p.plannedDate.toISOString(), createdAt: paymentMatchCreatedAt(p), managerName: p.manager.oneCManagerName || p.manager.name, manualRubleLinks: manualPaymentLinks(p.oneCCashEvidence) })), requests.rows, source.payments, source.conversions);
  return Object.assign(result, {versions:new Map(plans.map(p=>[p.id,p.updatedAt.toISOString()]))});
}
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const object = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};

export async function proposeApprovedRevision(id: string, user: {id: number; name: string}, data: RevisionData, reason: string, version: string) {
  if (reason.trim().length < 3) throw new Error('Укажите причину изменения (не менее 3 символов).');
  if (!data.plannedAmount) throw new Error('Укажите общую сумму заявки в рублях.');
  const evidence = await freshEvidence();
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106241)`;
    const before = await tx.supplierPaymentPlan.findFirst({ where: {id, managerUserId: user.id, status: 'APPROVED'} });
    if (!before || before.updatedAt.toISOString() !== version) throw new Error('Заявка изменилась. Обновите страницу и повторите.');
    if(evidence.versions.get(id)!==before.updatedAt.toISOString()) throw new Error('Данные оплаты изменились. Обновите страницу.');
    if (readPaymentRevision(before.oneCCashEvidence)) throw new Error('Изменения уже на согласовании.');
    const paid = evidence.get(id); if (!paid) throw new Error('Не удалось проверить оплату заявки.');
    const basisChanged = paymentBasisChanged(before, data);
    if (!basisChanged) data = { ...data, condition: preservePaymentReview(before.condition, data.condition) };
    assertRevisionPaymentSafety(before, data, paid);
    if (basisChanged) {
      const others = await tx.supplierPaymentPlan.findMany({where:{id:{not:id},status:{in:['SUBMITTED','APPROVED','NEEDS_CHANGES']}}});
      if (planningRequestOverlap([data], others, evidence)) throw new Error('Эта оплата уже включена в другую незавершённую заявку.');
    }
    const changes = revisionChanges(before, data);
    if (!changes.length) throw new Error('Данные заявки не изменились.');
    const commentOnly = changes.every(c => c.key === 'condition');
    const revision = { id: randomUUID(), reason: reason.trim().slice(0, 500), submittedAt: new Date().toISOString(), data, changes };
    const result = await tx.supplierPaymentPlan.updateMany({ where: {id, updatedAt: before.updatedAt, status: 'APPROVED'}, data: commentOnly ? { condition: data.condition } : { oneCCashEvidence: json({...object(before.oneCCashEvidence), pendingRevision: revision}) } });
    if (result.count !== 1) throw new Error('Заявка изменилась. Обновите страницу.');
    const updated = await tx.supplierPaymentPlan.findUniqueOrThrow({where:{id}});
    const event = await tx.supplierPaymentPlanEvent.create({data:{planId:id,actorUserId:user.id,action:commentOnly ? 'COMMENT_UPDATED' : 'REVISION_REQUESTED',snapshot:json({before, revision, after:updated})}});
    await notifyAdminsAboutProcurementPlans({db:tx,eventKey:`procurement-revision:${event.id}`,action:'UPDATED',revisionProposal:!commentOnly,managerName:user.name,plans:[{...updated, plannedAmount: data.plannedAmount!, plannedDate:new Date(data.plannedDate), condition:`${commentOnly ? 'Комментарий изменён' : 'Изменения на согласование'}: ${revision.reason}`} ]});
    return {...json(updated), revision:commentOnly ? null : revision};
  });
}

export async function decideApprovedRevision(id: string, actorId: number, revisionId: string, approve: boolean, reason: string) {
  if (!approve && reason.trim().length < 3) throw new Error('Укажите причину отказа в изменении.');
  let verifiedBasis: RevisionData | null = null;
  let verifiedVersion = '';
  if (approve) {
    const candidate = await prisma.supplierPaymentPlan.findUniqueOrThrow({where:{id},include:{manager:true}});
    const revision = readPaymentRevision(candidate.oneCCashEvidence);
    if (!revision || revision.id !== revisionId) throw new Error('Эти изменения уже рассмотрены. Обновите страницу.');
    if (paymentBasisChanged(candidate, revision.data)) {
      verifiedBasis = await validateBasisChangeTarget(candidate, revision.data, candidate.manager.oneCManagerName?.trim() || candidate.manager.name);
      verifiedVersion = candidate.updatedAt.toISOString();
    }
  }
  const evidence = approve ? await freshEvidence() : null;
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106241)`;
    const before = await tx.supplierPaymentPlan.findUniqueOrThrow({where:{id}});
    const revision = readPaymentRevision(before.oneCCashEvidence);
    if (before.status !== 'APPROVED' || !revision || revision.id !== revisionId) throw new Error('Эти изменения уже рассмотрены. Обновите страницу.');
    if (verifiedBasis && verifiedVersion !== before.updatedAt.toISOString()) throw new Error('Заявка изменилась. Обновите страницу.');
    if(approve && evidence?.versions.get(id)!==before.updatedAt.toISOString()) throw new Error('Данные оплаты изменились. Обновите страницу.');
    const change = verifiedBasis || revision.data;
    if (approve) {
      const paid = evidence?.get(id); if (!paid) throw new Error('Не удалось проверить оплату заявки.');
      assertRevisionPaymentSafety(before, change, paid);
      if (paymentBasisChanged(before, change)) {
        const others = await tx.supplierPaymentPlan.findMany({where:{id:{not:id},status:{in:['SUBMITTED','APPROVED','NEEDS_CHANGES']}}});
        if (planningRequestOverlap([change], others, evidence!)) throw new Error('Эта оплата уже включена в другую незавершённую заявку.');
      }
    }
    const identityChanged=revisionChanges(before,change).some(c=>['supplierPartner','supplierCounterparty','orderRefs','paymentMethod','currency'].includes(c.key));
    const updated = await tx.supplierPaymentPlan.update({where:{id},data:{
      ...(approve ? {...change, plannedAmount:change.plannedAmount!, plannedDate:new Date(`${change.plannedDate}T00:00:00Z`), approvedAt:new Date(), approvedById:actorId} : {}),
      oneCCashEvidence:json({...object(before.oneCCashEvidence),pendingRevision:null,...(approve && identityChanged ? {paymentMatchFrom:paymentBasisChanged(before,change) ? new Date().toISOString() : revision.submittedAt}: {})}),
    }});
    const event = await tx.supplierPaymentPlanEvent.create({data:{planId:id,actorUserId:actorId,action:approve?'REVISION_APPROVED':'REVISION_REJECTED',snapshot:json({before,revision,after:updated,reason})}});
    await notifyProcurementManagerAboutDecision({db:tx,plan:updated,revisionDecision:true,decision:approve?'APPROVED':'NEEDS_CHANGES',reason:`Изменения не приняты: ${reason}. Действуют прежние условия.`,eventKey:event.id});
    return {...json(updated),revision:null};
  });
}
