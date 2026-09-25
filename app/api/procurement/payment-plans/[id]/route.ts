import { Prisma } from "@prisma/client";
import { preservePaymentReview } from '@/lib/procurement-buyer-comment';
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validatePaymentPlan } from "@/lib/procurement-payment-control";
import {
  ordersForManager,
} from "@/lib/procurement-payment-source";
import { fetchRequestOrderCatalogue as fetchSupplierOrderFinance } from '@/lib/procurement-request-catalogue';
import { notifyAdminsAboutProcurementPlans } from "@/lib/procurement-payment-notifications";
import { getLatestProcurementUsdtRate } from "@/lib/procurement-usdt-rate";
import { expenseRequestMoscowCalendarDate } from "@/lib/expense-request-source";
import { proposeApprovedRevision, freshEvidence } from "@/lib/procurement-plan-revision-server";
import { isSupplierDebtPlan, paymentBasisChanged } from '@/lib/procurement-debt-request';
import { validateBasisChangeTarget } from '@/lib/procurement-basis-change-server';
import { assertRevisionPaymentSafety, revisionChanges } from '@/lib/procurement-plan-revision';
import { planningSubmissionError } from '@/lib/procurement-planning-submit';
import { planningRequestOverlap } from '@/lib/procurement-planning-overlap';
import { ordersForRequest, reviewRequestCondition } from '@/lib/procurement-order-selection';

const jsonPlan = (plan: unknown) => JSON.parse(JSON.stringify(plan));

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Необходим вход" }, { status: 401 });
  if (user.role !== "EMPLOYEE" || user.portalArea !== "PROCUREMENT")
    return Response.json({ error: "Нет доступа" }, { status: 403 });
  const { id } = await props.params;
  const existing = await prisma.supplierPaymentPlan.findFirst({
    where: { id, managerUserId: user.id },
  });
  if (!existing)
    return Response.json({ error: "План не найден." }, { status: 404 });
  if (!["SUBMITTED", "NEEDS_CHANGES", "APPROVED"].includes(existing.status))
    return Response.json(
      { error: "Эту заявку уже нельзя изменить." },
      { status: 409 },
    );
  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return Response.json({error:'Проверьте данные заявки.'}, {status:400});
  if (payload.basis != null && !['ORDER', 'DEBT'].includes(payload.basis)) return Response.json({error:'Неизвестное основание оплаты.'}, {status:400});
  const wasDebt = isSupplierDebtPlan(existing);
  const debt = payload.basis === 'DEBT' || (payload.basis == null && wasDebt);
  const checked = validatePaymentPlan(payload, debt);
  if (debt && checked.data.orderRefs.length) return Response.json({error:'Для оплаты долга уберите выбранные заказы.'}, {status:400});
  const basisChanged = paymentBasisChanged(existing, checked.data);
  if ((wasDebt || basisChanged) && checked.data.supplierPartner !== existing.supplierPartner)
    return Response.json({ error: 'При смене основания оставьте того же поставщика.' }, { status: 400 });
  if (basisChanged && payload.basis == null) return Response.json({error:'Выберите основание оплаты.'}, {status:400});
  if ((basisChanged || payload.version != null) && payload.version !== existing.updatedAt.toISOString()) return Response.json({error:'Заявка изменилась. Обновите страницу.'}, {status:409});
  if (debt) {
    checked.data.supplierCounterparty = existing.supplierCounterparty;
    checked.data.orderNumbers = [];
  }
  if (!checked.ok)
    return Response.json({ error: checked.errors.join(" ") }, { status: 400 });
  let plannedAmount = checked.data.plannedAmount;
  if (!plannedAmount && checked.data.paymentMethod === "USDT" && checked.data.foreignAmount) {
    const rate = await getLatestProcurementUsdtRate(expenseRequestMoscowCalendarDate(new Date()));
    if (!rate.rate) return Response.json({ error: "Курс пока недоступен. Укажите примерную сумму в рублях." }, { status: 400 });
    plannedAmount = checked.data.foreignAmount * rate.rate;
  }
  if (!plannedAmount) return Response.json({ error: "Укажите сумму оплаты." }, { status: 400 });
  if (basisChanged) {
    try {
      checked.data = await validateBasisChangeTarget(existing, {...checked.data, plannedAmount}, user.oneCManagerName?.trim() || user.name);
    } catch (error) {
      return Response.json({error:error instanceof Error && /^[А-ЯЁ]/.test(error.message) ? error.message : 'Не удалось проверить новое основание оплаты. Повторите позже.'}, {status:409});
    }
  }
  if (existing.status === 'APPROVED') {
    try {
      const unchangedOrders = JSON.stringify([...checked.data.orderRefs].sort()) === JSON.stringify((Array.isArray(existing.orderRefs) ? existing.orderRefs.map(String) : []).sort()) && checked.data.supplierPartner === existing.supplierPartner;
      if (!unchangedOrders && !basisChanged) {
        const source = await fetchSupplierOrderFinance();
        if (!source.complete) throw new Error('Заказы 1С получены не полностью. Повторите изменение позже.');
        const allowed = ordersForManager(ordersForRequest(source.rows), user.oneCManagerName?.trim() || user.name);
        if (!checked.data.orderRefs.every(ref => allowed.some(o => o.ref === ref && o.supplierPartner === checked.data.supplierPartner))) throw new Error('Выберите заказы вашего поставщика из 1С.');
        checked.data.orderNumbers = checked.data.orderRefs.map(ref => allowed.find(o => o.ref === ref)!.number);
        const planningError = await planningSubmissionError(allowed.filter(o => checked.data.orderRefs.includes(o.ref)), [{ refs: checked.data.orderRefs, amount: plannedAmount, condition: checked.data.condition }], rows => { checked.data.condition = reviewRequestCondition(rows, checked.data.condition); });
        if (planningError) throw new Error(planningError);
      } else if (!basisChanged) checked.data.orderNumbers = Array.isArray(existing.orderNumbers) ? existing.orderNumbers.map(String) : [];
      return Response.json(await proposeApprovedRevision(id, user, {...checked.data, plannedAmount}, String(payload.changeReason || ''), String(payload.version || '')));
    } catch (error) { return Response.json({ error: error instanceof Error && /^[А-ЯЁ]/.test(error.message) ? error.message : 'Не удалось проверить изменение. Повторите позже.' }, {status:409}); }
  }
  if (!debt && !basisChanged) {
  const source = await fetchSupplierOrderFinance();
  if (!source.complete) return Response.json({ error: 'Проверка заказов не завершена. Повторите позже.' }, { status: 503 });
  const managerName = user.oneCManagerName?.trim() || user.name;
  const allowed = new Map(
    ordersForRequest(ordersForManager(source.rows, managerName)).map((order) => [
      order.ref,
      order,
    ]),
  );
  if (!checked.data.orderRefs.every((ref) => allowed.has(ref)))
    return Response.json(
      { error: "Один из заказов не относится к вашему менеджеру в 1С." },
      { status: 400 },
    );
  const partners = new Set(
    checked.data.orderRefs.map((ref) => allowed.get(ref)?.supplierPartner),
  );
  checked.data.orderNumbers = checked.data.orderRefs.map(ref => allowed.get(ref)!.number);
  const planningError = await planningSubmissionError(checked.data.orderRefs.map(ref => allowed.get(ref)!), [{ refs: checked.data.orderRefs, amount: plannedAmount, condition: checked.data.condition }], rows => { checked.data.condition = reviewRequestCondition(rows, checked.data.condition); });
  if (planningError) return Response.json({ error: planningError }, { status: 409 });
  if (partners.size !== 1 || !partners.has(checked.data.supplierPartner))
    return Response.json(
      { error: "Заказы должны относиться к выбранному поставщику." },
      { status: 400 },
    );
  }
  const overlapEvidence = await freshEvidence().catch(() => null);
  if (!basisChanged) checked.data.condition = preservePaymentReview(existing.condition, checked.data.condition);
  if (!overlapEvidence) return Response.json({ error: 'Не удалось сверить уже созданные оплаты. Изменения не сохранены; повторите позже.' }, { status: 503 });
  let overlap = false;
  let editError = '';
  const plan = await prisma
    .$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106241)`;
      if (basisChanged) {
        const current = await tx.supplierPaymentPlan.findFirst({where:{id,managerUserId:user.id,status:{in:['SUBMITTED','NEEDS_CHANGES']}}});
        if (!current || current.updatedAt.toISOString() !== existing.updatedAt.toISOString()
          || overlapEvidence.versions.get(id) !== current.updatedAt.toISOString()) throw new Error('Заявка изменилась. Обновите страницу.');
        const paid = overlapEvidence.get(id);
        if (!paid) throw new Error('Не удалось проверить оплату заявки. Повторите позже.');
        assertRevisionPaymentSafety(current, {...checked.data, plannedAmount}, paid);
      }
      const otherPlans = await tx.supplierPaymentPlan.findMany({ where: { id: { not: id }, status: { in: ['SUBMITTED', 'APPROVED', 'NEEDS_CHANGES'] } } });
      if (planningRequestOverlap([checked.data], otherPlans, overlapEvidence)) throw new Error('PLAN_OVERLAP');
      const changed = await tx.supplierPaymentPlan.updateMany({
        where: { id, managerUserId: user.id, updatedAt: existing.updatedAt, status: { in: ["SUBMITTED", "NEEDS_CHANGES"] } },
        data: {
          supplierPartner: checked.data.supplierPartner,
          supplierCounterparty: checked.data.supplierCounterparty,
          orderRefs: checked.data.orderRefs,
          orderNumbers: checked.data.orderNumbers,
          plannedDate: new Date(`${checked.data.plannedDate}T00:00:00.000Z`),
          plannedAmount: new Prisma.Decimal(plannedAmount),
          condition: checked.data.condition,
          paymentMethod: checked.data.paymentMethod,
          currency: checked.data.currency,
          foreignAmount:
            checked.data.foreignAmount == null
              ? null
              : new Prisma.Decimal(checked.data.foreignAmount),
          exchangeRate:
            checked.data.exchangeRate == null
              ? null
              : new Prisma.Decimal(checked.data.exchangeRate),
          commissionAmount:
            checked.data.commissionAmount == null
              ? null
              : new Prisma.Decimal(checked.data.commissionAmount),
          exchangerName: checked.data.exchangerName,
          supplierConfirmation: checked.data.supplierConfirmation,
          status: "SUBMITTED",
          approvedAt: null,
          approvedById: null,
          ...(basisChanged ? {oneCCashEvidence:jsonPlan({
            ...(existing.oneCCashEvidence && typeof existing.oneCCashEvidence === 'object' && !Array.isArray(existing.oneCCashEvidence) ? existing.oneCCashEvidence : {}),
            paymentMatchFrom:new Date().toISOString(),
          })} : {}),
        },
      });
      if (changed.count !== 1) throw new Error("PLAN_STATUS_CHANGED");
      const updated = await tx.supplierPaymentPlan.findUniqueOrThrow({
        where: { id },
      });
      const planEvent = await tx.supplierPaymentPlanEvent.create({
        data: {
          planId: id,
          actorUserId: user.id,
          action: "UPDATED",
          snapshot: jsonPlan(basisChanged ? {before:existing,after:updated,revision:{reason:'Изменено основание оплаты',changes:revisionChanges(existing,{...checked.data,plannedAmount})}} : updated),
        },
      });
      await notifyAdminsAboutProcurementPlans({
        db: tx,
        eventKey: `procurement-payment:${planEvent.id}:updated`,
        action: "UPDATED",
        managerName: user.name,
        plans: [updated],
      });
      return updated;
    })
    .catch((error) => {
      if (error instanceof Error && /^[А-ЯЁ]/.test(error.message)) { editError = error.message; return null; }
      if (error instanceof Error && error.message === 'PLAN_OVERLAP') { overlap = true; return null; }
      if (error instanceof Error && error.message === "PLAN_STATUS_CHANGED")
        return null;
      throw error;
    });
  if (!plan)
    return Response.json(
      { error: editError || (overlap ? 'Эта оплата уже включена в другую незавершённую заявку.' : "План уже рассмотрен и больше не может быть изменён.") },
      { status: 409 },
    );
  return Response.json({ ...jsonPlan(plan), correctionReason: "" });
}
