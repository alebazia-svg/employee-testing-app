import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validatePaymentPlan } from "@/lib/procurement-payment-control";
import {
  fetchSupplierOrderFinance,
  ordersForManager,
  ordersRequiringPayment,
} from "@/lib/procurement-payment-source";
import { notifyAdminsAboutProcurementPlans } from "@/lib/procurement-payment-notifications";
import { getLatestProcurementUsdtRate } from "@/lib/procurement-usdt-rate";
import { expenseRequestMoscowCalendarDate } from "@/lib/expense-request-source";

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
  if (existing.status !== "SUBMITTED")
    return Response.json(
      { error: "Изменить можно только заявку, которая ещё ожидает согласования." },
      { status: 409 },
    );
  const checked = validatePaymentPlan(await req.json());
  if (!checked.ok)
    return Response.json({ error: checked.errors.join(" ") }, { status: 400 });
  let plannedAmount = checked.data.plannedAmount;
  if (!plannedAmount && checked.data.paymentMethod === "USDT" && checked.data.foreignAmount) {
    const rate = await getLatestProcurementUsdtRate(expenseRequestMoscowCalendarDate(new Date()));
    if (!rate.rate) return Response.json({ error: "Курс пока недоступен. Укажите примерную сумму в рублях." }, { status: 400 });
    plannedAmount = checked.data.foreignAmount * rate.rate;
  }
  if (!plannedAmount) return Response.json({ error: "Укажите сумму оплаты." }, { status: 400 });
  const source = await fetchSupplierOrderFinance();
  const managerName = user.oneCManagerName?.trim() || user.name;
  const allowed = new Map(
    ordersRequiringPayment(ordersForManager(source.rows, managerName)).map((order) => [
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
  if (partners.size !== 1 || !partners.has(checked.data.supplierPartner))
    return Response.json(
      { error: "Заказы должны относиться к выбранному поставщику." },
      { status: 400 },
    );
  const plan = await prisma
    .$transaction(async (tx) => {
      const changed = await tx.supplierPaymentPlan.updateMany({
        where: { id, managerUserId: user.id, status: "SUBMITTED" },
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
          snapshot: jsonPlan(updated),
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
      if (error instanceof Error && error.message === "PLAN_STATUS_CHANGED")
        return null;
      throw error;
    });
  if (!plan)
    return Response.json(
      { error: "План уже рассмотрен и больше не может быть изменён." },
      { status: 409 },
    );
  return Response.json(jsonPlan(plan));
}
