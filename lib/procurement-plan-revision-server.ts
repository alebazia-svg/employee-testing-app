import { retainPaymentConfirmations } from '@/lib/procurement-confirmed-payment-server';
import { type PaymentConfirmation } from '@/lib/procurement-confirmed-payment';
import { randomUUID } from 'node:crypto';
import {readFundingBalance,assertFundingBalance} from './procurement-usdt-funding-server';
import { paymentCompletion } from './procurement-payment-completion';
import { preservePaymentReview } from './procurement-buyer-comment';
import { prisma } from './prisma';
import { fetchSupplierCurrencyPaymentSnapshot } from './procurement-currency-payment-source';
import { expenseRequestMoscowDayEnd, fetchExpenseRequestSnapshot } from './expense-request-source';
import { paymentEvidenceFrom } from './procurement-ruble-payment-evidence';
import { matchProcurementPaymentEvidence } from './procurement-currency-payment-evidence';
import { manualPaymentLinks } from './procurement-manual-payment-links';
import { assertRevisionPaymentSafety, readPaymentRevision, revisionChanges, paymentMatchCreatedAt, type RevisionData } from './procurement-plan-revision';
import { notifyAdminsAboutProcurementPlans, notifyProcurementManagerAboutDecision } from './procurement-payment-notifications';
import { readQrFunding } from './procurement-qr-funding-source';
import { moscowDateKey } from './one-c-date';
import { assertUnpaidAction } from './procurement-unpaid-action';
import { paymentTargetChanged } from './procurement-debt-request';
import { planningRequestOverlap } from './procurement-planning-overlap';
import { validateBasisChangeTarget } from './procurement-basis-change-server';

export async function freshEvidence(options: { retain?: boolean; guardPlanId?: string } = {}) {
  const started = new Date();
  const confirmations: PaymentConfirmation[] = [];
  const plans = await prisma.supplierPaymentPlan.findMany({ include: { manager: true } });
  const to = expenseRequestMoscowDayEnd(); const from = paymentEvidenceFrom(plans, new Date(to.getTime() - 31 * 86400000));
  const [source, requests] = await Promise.all([fetchSupplierCurrencyPaymentSnapshot({ from, to, plans }), fetchExpenseRequestSnapshot({ from, to, includeHistory: true, historyConcurrency: 2 })]);
  if (!source.complete || source.rubPaymentsSupported !== true || !requests.complete) throw new Error('Не удалось проверить оплаты в 1С. Повторите изменение после восстановления связи.');
  const evidencePlans = plans.map(p => ({ ...p, hasPendingRevision: Boolean(readPaymentRevision(p.oneCCashEvidence)), completedPaymentRefs: paymentCompletion(p.oneCCashEvidence)?.paymentRefs, orderRefs: Array.isArray(p.orderRefs) ? p.orderRefs.map(String) : [], plannedAmount: Number(p.plannedAmount), foreignAmount: p.foreignAmount == null ? null : Number(p.foreignAmount), plannedDate: p.plannedDate.toISOString(), createdAt: paymentMatchCreatedAt(p), managerName: p.manager.oneCManagerName || p.manager.name, manualRubleLinks: manualPaymentLinks(p.oneCCashEvidence) }));
  const result = matchProcurementPaymentEvidence(evidencePlans, requests.rows, source.payments, source.conversions, { confirmations: options.retain ? confirmations : undefined, allowSmallRemainder: source.rubPaymentsSupported === true });
  if (source.rubPaymentsSupported !== true) for (const row of result.values()) delete row.collection;
  const target = evidencePlans.find(plan => plan.id === options.guardPlanId);
  if (target && (target.status !== 'APPROVED' || target.hasPendingRevision) && result.get(target.id)?.state === 'NO_EVIDENCE') {
    // The ordinary calendar skips some payments on pending requests. A destructive
    // action needs to rule these out too, without changing any other allocation.
    const eligible = evidencePlans.map(plan => plan.id === target.id ? {...plan, status:'APPROVED' as const, hasPendingRevision:false} : plan);
    const potential = matchProcurementPaymentEvidence(eligible, requests.rows, source.payments, source.conversions, {allowSmallRemainder:true}).get(target.id);
    if (potential && potential.state !== 'NO_EVIDENCE') result.set(target.id, potential);
  }
  const guarded = plans.find(p=>p.id===options.guardPlanId && p.paymentMethod==='ACCOUNTABLE_QR');
  if (guarded) {
    // Check transfers even before approval and while reviewing a pending revision.
    const funding = await readQrFunding(plans.map(p=>({...p,plannedAmount:Number(p.plannedAmount),
      createdAt:paymentMatchCreatedAt(p),status:p.id===guarded.id?'APPROVED':p.status,
      hasPendingRevision:p.id!==guarded.id && Boolean(readPaymentRevision(p.oneCCashEvidence))})),moscowDateKey(started),guarded.id);
    const row=result.get(guarded.id);
    if(row)row.qrFunding=funding.get(guarded.id);
  }
  if (options.retain) await retainPaymentConfirmations(plans, confirmations, started);
  return Object.assign(result, {versions:new Map(plans.map(p=>[p.id,p.updatedAt.toISOString()]))});
}
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const object = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};

export async function proposeApprovedRevision(id: string, user: {id: number; name: string}, data: RevisionData, reason: string, version: string) {
  if (reason.trim().length < 3) throw new Error('Укажите причину изменения (не менее 3 символов).');
  if (!data.plannedAmount) throw new Error('Укажите общую сумму заявки в рублях.');
  const [evidence, fundingBalance] = await Promise.all([
    freshEvidence({guardPlanId:id}), readFundingBalance([data]),
  ]);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106241)`;
    await assertFundingBalance(tx,[data],fundingBalance,evidence,id);
    const before = await tx.supplierPaymentPlan.findFirst({ where: {id, managerUserId: user.id, status: 'APPROVED'} });
    if (!before || before.updatedAt.toISOString() !== version) throw new Error('Заявка изменилась. Обновите страницу и повторите.');
    if(evidence.versions.get(id)!==before.updatedAt.toISOString()) throw new Error('Данные оплаты изменились. Обновите страницу.');
    if (readPaymentRevision(before.oneCCashEvidence)) throw new Error('Изменения уже на согласовании.');
    const paid = evidence.get(id); if (!paid) throw new Error('Не удалось проверить оплату заявки.');
    const basisChanged = paymentTargetChanged(before, data);
    if (!basisChanged) data = { ...data, condition: preservePaymentReview(before.condition, data.condition) };
    assertRevisionPaymentSafety(before, data, paid);
    if (paid.collection && revisionChanges(before,data).some(c=>c.key==='plannedDate')) throw new Error('Выдача уже назначена в 1С. Сначала измените или отмените её там, чтобы даты не расходились.');
    if(basisChanged || before.paymentMethod!==data.paymentMethod)await assertUnpaidAction(tx,before,paid);
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
  let evidence: Awaited<ReturnType<typeof freshEvidence>> | null = null;
  let fundingBalance: Awaited<ReturnType<typeof readFundingBalance>> = null;
  if (approve) {
    const candidate = await prisma.supplierPaymentPlan.findUniqueOrThrow({where:{id},include:{manager:true}});
    const revision = readPaymentRevision(candidate.oneCCashEvidence);
    if (candidate.status !== 'APPROVED' || !revision || revision.id !== revisionId) throw new Error('Эти изменения уже рассмотрены. Обновите страницу.');
    verifiedVersion = candidate.updatedAt.toISOString();
    // Independent reads share one immutable revision. Every check must succeed
    // before entering the transaction; its version is checked again under lock.
    [verifiedBasis, evidence, fundingBalance] = await Promise.all([
      paymentTargetChanged(candidate, revision.data)
        ? validateBasisChangeTarget(candidate, revision.data, candidate.manager.oneCManagerName?.trim() || candidate.manager.name)
        : Promise.resolve(null),
      freshEvidence({guardPlanId: paymentTargetChanged(candidate, revision.data) || candidate.paymentMethod !== revision.data.paymentMethod ? id : undefined}),
      readFundingBalance([revision.data]),
    ]);
  }
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106241)`;
    const before = await tx.supplierPaymentPlan.findUniqueOrThrow({where:{id}});
    const revision = readPaymentRevision(before.oneCCashEvidence);
    if (before.status !== 'APPROVED' || !revision || revision.id !== revisionId) throw new Error('Эти изменения уже рассмотрены. Обновите страницу.');
    if (approve && verifiedVersion !== before.updatedAt.toISOString()) throw new Error('Заявка изменилась. Обновите страницу.');
    if(approve && evidence?.versions.get(id)!==before.updatedAt.toISOString()) throw new Error('Данные оплаты изменились. Обновите страницу.');
    const change = verifiedBasis || revision.data;
    if(approve&&evidence)await assertFundingBalance(tx,[change],fundingBalance,evidence,id);
    if (approve) {
      const paid = evidence?.get(id); if (!paid) throw new Error('Не удалось проверить оплату заявки.');
      assertRevisionPaymentSafety(before, change, paid);
      if (paid.collection && revisionChanges(before,change).some(c=>c.key==='plannedDate')) throw new Error('Выдача уже назначена в 1С. Сначала измените или отмените её там, чтобы даты не расходились.');
      if(paymentTargetChanged(before,change) || before.paymentMethod!==change.paymentMethod)await assertUnpaidAction(tx,before,paid);
      if (paymentTargetChanged(before, change)) {
        const others = await tx.supplierPaymentPlan.findMany({where:{id:{not:id},status:{in:['SUBMITTED','APPROVED','NEEDS_CHANGES']}}});
        if (planningRequestOverlap([change], others, evidence!)) throw new Error('Эта оплата уже включена в другую незавершённую заявку.');
      }
    }
    const identityChanged=revisionChanges(before,change).some(c=>['supplierPartner','supplierCounterparty','orderRefs','paymentPurpose','paymentMethod','currency'].includes(c.key));
    const updated = await tx.supplierPaymentPlan.update({where:{id},data:{
      ...(approve ? {...change, plannedAmount:change.plannedAmount!, plannedDate:new Date(`${change.plannedDate}T00:00:00Z`), approvedAt:new Date(), approvedById:actorId} : {}),
      oneCCashEvidence:json({...object(before.oneCCashEvidence),pendingRevision:null,...(approve && identityChanged ? {paymentMatchFrom:paymentTargetChanged(before,change) ? new Date().toISOString() : revision.submittedAt}: {})}),
    }});
    const event = await tx.supplierPaymentPlanEvent.create({data:{planId:id,actorUserId:actorId,action:approve?'REVISION_APPROVED':'REVISION_REJECTED',snapshot:json({before,revision,after:updated,reason})}});
    await notifyProcurementManagerAboutDecision({db:tx,plan:updated,revisionDecision:true,rescheduled:approve&&revisionChanges(before,change).some(c=>c.key==='plannedDate'),decision:approve?'APPROVED':'NEEDS_CHANGES',reason:`Изменения не приняты: ${reason}. Действуют прежние условия.`,eventKey:event.id});
    return {...json(updated),revision:null};
  });
}
