import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildPaymentPlanCode,
  validatePaymentPlan,
} from "@/lib/procurement-payment-control";
import {
  fetchSupplierOrderFinance,
  ordersForManager,
  ordersRequiringPayment,
} from "@/lib/procurement-payment-source";
import { notifyAdminsAboutProcurementPlans } from "@/lib/procurement-payment-notifications";
import { getLatestProcurementUsdtRate } from "@/lib/procurement-usdt-rate";
import { expenseRequestMoscowCalendarDate } from "@/lib/expense-request-source";

function jsonValue(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (_, item) =>
      typeof item === "bigint" ? String(item) : item,
    ),
  );
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Необходим вход" }, { status: 401 });
  if (user.role !== "EMPLOYEE" || user.portalArea !== "PROCUREMENT")
    return Response.json({ error: "Нет доступа" }, { status: 403 });

  const payload = (await req.json()) as {
    plannedDate?: unknown;
    rows?: Array<Record<string, unknown>>;
  };
  if (!Array.isArray(payload.rows) || !payload.rows.length || payload.rows.length > 100)
    return Response.json({ error: "Выберите от 1 до 100 заказов." }, { status: 400 });

  const managerName = user.oneCManagerName?.trim() || user.name;
  const source = await fetchSupplierOrderFinance();
  const allowed = new Map(
    ordersRequiringPayment(ordersForManager(source.rows, managerName)).map((order) => [order.ref, order]),
  );
  const seen = new Set<string>();
  const checkedRows = payload.rows.map((row) => {
    const ref = typeof row.orderRef === "string" ? row.orderRef.trim() : "";
    const order = allowed.get(ref);
    if (!order || seen.has(ref)) return { error: "В списке есть недоступный или повторяющийся заказ." } as const;
    seen.add(ref);
    const method = typeof row.paymentMethod === "string" ? row.paymentMethod : "";
    const checked = validatePaymentPlan({
      supplierPartner: order.supplierPartner,
      supplierCounterparty: order.supplierCounterparty,
      orderRefs: [order.ref],
      orderNumbers: [order.number],
      plannedDate: payload.plannedDate,
      plannedAmount: row.plannedAmount,
      condition: row.condition,
      paymentMethod: method,
      currency: method === "USDT" ? "USDT" : "RUB",
      foreignAmount: row.foreignAmount,
    });
    return checked.ok ? { order, data: checked.data } as const : { error: `${order.number || order.supplierPartner}: ${checked.errors.join(" ")}` } as const;
  });
  const error = checkedRows.find((row) => "error" in row);
  if (error && "error" in error) return Response.json({ error: error.error }, { status: 400 });
  const needsUsdtRate = checkedRows.some((row) => "data" in row && row.data && !row.data.plannedAmount && row.data.paymentMethod === "USDT" && Boolean(row.data.foreignAmount));
  const rateReference = needsUsdtRate ? await getLatestProcurementUsdtRate(expenseRequestMoscowCalendarDate(new Date())) : null;
  if (needsUsdtRate && !rateReference?.rate) return Response.json({ error: "Курс пока недоступен. Укажите примерную сумму в рублях." }, { status: 400 });

  const plans = await prisma.$transaction(async (tx) => {
    const created = [];
    let notificationKey = "";
    for (const row of checkedRows) {
      if (!("data" in row) || !row.data) continue;
      const data = row.data;
      const plannedAmount = data.plannedAmount || (data.foreignAmount && rateReference?.rate ? data.foreignAmount * rateReference.rate : null);
      if (!plannedAmount) continue;
      const plan = await tx.supplierPaymentPlan.create({
        data: {
          planCode: buildPaymentPlanCode(),
          managerUserId: user.id,
          supplierPartner: data.supplierPartner,
          supplierCounterparty: data.supplierCounterparty,
          orderRefs: data.orderRefs,
          orderNumbers: data.orderNumbers,
          plannedDate: new Date(`${data.plannedDate}T00:00:00.000Z`),
          plannedAmount: new Prisma.Decimal(plannedAmount),
          condition: data.condition,
          paymentMethod: data.paymentMethod,
          currency: data.currency,
          foreignAmount: data.foreignAmount == null ? null : new Prisma.Decimal(data.foreignAmount),
          exchangeRate: null,
          commissionAmount: null,
          exchangerName: "",
          supplierConfirmation: "",
        },
      });
      const planEvent = await tx.supplierPaymentPlanEvent.create({
        data: {
          planId: plan.id,
          actorUserId: user.id,
          action: "SUBMITTED",
          snapshot: jsonValue(plan),
        },
      });
      notificationKey ||= planEvent.id;
      created.push(plan);
    }
    await notifyAdminsAboutProcurementPlans({
      db: tx,
      eventKey: `procurement-payment-batch:${notificationKey}:submitted`,
      action: "SUBMITTED",
      managerName: user.name,
      plans: created,
    });
    return created;
  });
  return Response.json({ plans: jsonValue(plans) }, { status: 201 });
}
