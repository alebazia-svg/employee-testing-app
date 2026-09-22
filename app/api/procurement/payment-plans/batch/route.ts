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
import { fetchSupplierSettlements, summarizeSupplierSettlements } from '@/lib/procurement-supplier-settlements';
import { freshEvidence } from '@/lib/procurement-plan-revision-server';
import { debtRequestConflict } from '@/lib/procurement-debt-request';

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

  const payload = (await req.json().catch(() => null)) as {
    plannedDate?: unknown;
    rows?: Array<Record<string, unknown>>;
  } | null;
  if (!payload || !Array.isArray(payload.rows) || !payload.rows.length || payload.rows.length > 100 ||
      payload.rows.some(row => !row || typeof row !== 'object' || Array.isArray(row)))
    return Response.json({ error: "Добавьте от 1 до 100 оплат." }, { status: 400 });

  try {
  const managerName = user.oneCManagerName?.trim() || user.name;
  const source = await fetchSupplierOrderFinance();
  if (!source.complete) return Response.json({ error: 'Данные 1С получены не полностью. Повторите отправку позже.' }, { status: 503 });
  const managerOrders = ordersForManager(source.rows, managerName);
  const hasDebt = payload.rows.some(row => row.basis === 'DEBT');
  const settlements = hasDebt ? await fetchSupplierSettlements() : null;
  const supplierBalances = settlements ? summarizeSupplierSettlements(settlements.rows, managerOrders.map(order => order.supplierPartner)) : null;
  if (hasDebt && (!settlements?.complete || supplierBalances?.unsupportedCurrencyRows)) return Response.json({ error: 'Не удалось подтвердить долг поставщикам. Повторите позже.' }, { status: 503 });
  const allowed = new Map(
    ordersRequiringPayment(ordersForManager(source.rows, managerName)).map((order) => [order.ref, order]),
  );
  const seen = new Set<string>();
  const checkedRows = payload.rows.map((row) => {
    if (row.basis != null && row.basis !== 'ORDER' && row.basis !== 'DEBT') return { error: 'Неизвестное основание оплаты.' } as const;
    const ref = typeof row.orderRef === "string" ? row.orderRef.trim() : "";
    const debt = row.basis === 'DEBT';
    const supplier = typeof row.supplierPartner === 'string' ? row.supplierPartner.trim() : '';
    const order = debt ? managerOrders.find(order => order.supplierPartner === supplier) : allowed.get(ref);
    const rowKey = debt ? `debt:${supplier}` : ref;
    if (!order || seen.has(rowKey)) return { error: "В списке есть недоступная или повторяющаяся оплата." } as const;
    if (debt && (ref || !(Number(supplierBalances?.bySupplier[supplier]?.debt) > 0))) return { error: 'Долг выбранному поставщику не подтверждён в 1С.' } as const;
    seen.add(rowKey);
    const method = typeof row.paymentMethod === "string" ? row.paymentMethod : "";
    const checked = validatePaymentPlan({
      supplierPartner: order.supplierPartner,
      supplierCounterparty: debt ? '' : order.supplierCounterparty,
      orderRefs: debt ? [] : [order.ref],
      orderNumbers: debt ? [] : [order.number],
      plannedDate: payload.plannedDate,
      plannedAmount: row.plannedAmount,
      condition: row.condition,
      paymentMethod: method,
      currency: method === "USDT" ? "USDT" : "RUB",
      foreignAmount: row.foreignAmount,
    }, debt);
    return checked.ok ? { order, data: checked.data } as const : { error: `${order.number || order.supplierPartner}: ${checked.errors.join(" ")}` } as const;
  });
  const error = checkedRows.find((row) => "error" in row);
  if (error && "error" in error) return Response.json({ error: error.error }, { status: 400 });
  const needsUsdtRate = checkedRows.some((row) => "data" in row && row.data && !row.data.plannedAmount && row.data.paymentMethod === "USDT" && Boolean(row.data.foreignAmount));
  const rateReference = needsUsdtRate ? await getLatestProcurementUsdtRate(expenseRequestMoscowCalendarDate(new Date())) : null;
  if (needsUsdtRate && !rateReference?.rate) return Response.json({ error: "Курс пока недоступен. Укажите примерную сумму в рублях." }, { status: 400 });

  // Verify all existing allocations before accepting another debt request.
  const debtEvidence = hasDebt ? await freshEvidence() : new Map<string, { state: string }>();
  const plans = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106241)`;
    if (hasDebt) {
      const existing = await tx.supplierPaymentPlan.findMany({ where: { status: { in: ['SUBMITTED', 'APPROVED', 'NEEDS_CHANGES'] } } });
      const currentEvidence = new Map(debtEvidence);
      if ('versions' in debtEvidence && debtEvidence.versions instanceof Map) {
        for (const plan of existing) {
          if (debtEvidence.versions.get(plan.id) !== plan.updatedAt.toISOString()) currentEvidence.delete(plan.id);
        }
      }
      for (const row of checkedRows) {
        if ('data' in row && row.data && !row.data.orderRefs.length && debtRequestConflict(existing, row.data.supplierPartner, currentEvidence)) {
          throw new Error('DEBT_REQUEST_EXISTS');
        }
      }
    }
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
  }).catch(error => {
    if (error instanceof Error && error.message === 'DEBT_REQUEST_EXISTS') return null;
    throw error;
  });
  if (!plans) return Response.json({ error: 'По этому поставщику уже есть незавершённая заявка в счёт долга. Измените её или дождитесь закрытия.' }, { status: 409 });
  return Response.json({ plans: jsonValue(plans) }, { status: 201 });
  } catch {
    return Response.json({ error: 'Не удалось проверить данные 1С или подтвердить сохранение. Проверьте календарь перед повторной отправкой.' }, { status: 503 });
  }
}
