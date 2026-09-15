import { AdminShell } from "@/components/AdminShell";
import { AdminBreadcrumbs } from "@/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { prisma } from "@/lib/prisma";
import { fetchExpenseRequestSnapshot } from "@/lib/expense-request-source";
import { calculateOrderPlanning } from "@/lib/procurement-payment-control";
import { fetchSupplierCurrencyPaymentSnapshot } from "@/lib/procurement-currency-payment-source";
import { matchProcurementPaymentEvidence } from "@/lib/procurement-currency-payment-evidence";
import {
  fetchSupplierOrderFinance,
  normalizeManagerName,
  ordersRequiringPayment,
} from "@/lib/procurement-payment-source";
import AdminProcurementClient from "./AdminProcurementClient";
import { getProcurementBalances } from "@/lib/procurement-currency-balance";
import { expenseRequestMoscowCalendarDate } from "@/lib/expense-request-source";
import { getLatestProcurementUsdtRate } from "@/lib/procurement-usdt-rate";
import { fetchSupplierSettlements, summarizeSupplierSettlements } from "@/lib/procurement-supplier-settlements";
import { procurementOrderCommentText } from "@/lib/procurement-order-comment";
import { loadProcurementForecastHistory } from "@/lib/procurement-forecast-history";
import { loadOwnerCashForecastShadow } from "@/lib/procurement-cash-forecast-loader";
import { fetchPayrollForecastEvidence } from "@/lib/procurement-payroll-one-c";
import { fetchTBankOwnerTransferControl } from "@/lib/tbank-owner-transfer-one-c";
import { fetchProcurementPriorityDebts } from "@/lib/procurement-cash-forecast-settlements";
import { buildSupplierIntelligence } from "@/lib/procurement-supplier-intelligence";
import { buildProcurementDebtAllocation } from "@/lib/procurement-debt-allocation";
import { buildProcurementCashPreparation } from "@/lib/procurement-cash-preparation";

export const dynamic = "force-dynamic";

function plusDays(value: string, count: number) {
  const result = new Date(`${value}T12:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + count);
  return result.toISOString().slice(0, 10);
}

function nextMonthDay(value: string, day: number) {
  const current = new Date(`${value}T12:00:00.000Z`);
  const result = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), day, 12));
  if (result.toISOString().slice(0, 10) <= value) result.setUTCMonth(result.getUTCMonth() + 1);
  return result.toISOString().slice(0, 10);
}

function ownerBalance(source: Awaited<ReturnType<typeof loadOwnerCashForecastShadow>>["money"], name: string) {
  const index = source?.accountNames.indexOf(name) ?? -1;
  return index < 0 ? null : source?.positions[index]?.balanceMinor ?? null;
}

export default async function AdminProcurementPage() {
  const todayKey = expenseRequestMoscowCalendarDate(new Date());
  const to = new Date();
  to.setDate(to.getDate() + 1);
  const from = new Date(to);
  from.setDate(from.getDate() - 31);
  const [plansResult, managersResult, ordersResult, settlementsResult, requestsResult, balancesResult, rateResult, currencyPaymentsResult, forecastHistoryResult, ownerForecastResult, payrollResult, tbankResult, priorityDebtsResult] =
    await Promise.allSettled([
      prisma.supplierPaymentPlan.findMany({
        include: { manager: { select: { name: true, oneCManagerName: true } } },
        orderBy: [{ plannedDate: "asc" }, { createdAt: "desc" }],
      }),
      prisma.user.findMany({
        where: { portalArea: "PROCUREMENT" },
        select: { name: true, oneCManagerName: true },
      }),
      fetchSupplierOrderFinance(),
      fetchSupplierSettlements(),
      fetchExpenseRequestSnapshot({ from, to }),
      getProcurementBalances(todayKey),
      getLatestProcurementUsdtRate(todayKey),
      fetchSupplierCurrencyPaymentSnapshot({ from, to, timeoutMs: 6_000 }),
      loadProcurementForecastHistory(),
      loadOwnerCashForecastShadow(todayKey),
      fetchPayrollForecastEvidence(todayKey),
      fetchTBankOwnerTransferControl(todayKey),
      fetchProcurementPriorityDebts(todayKey),
    ]);
  const plans = plansResult.status === "fulfilled" ? plansResult.value : [];
  const procurementManagers =
    managersResult.status === "fulfilled" ? managersResult.value : [];
  const warnings: string[] = [];
  if (plansResult.status === "rejected") warnings.push("сохранённые планы");
  const ordersSource =
    ordersResult.status === "fulfilled" ? ordersResult.value : null;
  if (!ordersSource) warnings.push("заказы поставщикам");
  else if (!ordersSource.complete) warnings.push("неполная выгрузка заказов");
  const requestSource =
    requestsResult.status === "fulfilled" ? requestsResult.value : null;
  if (!requestSource) warnings.push("расходные кассовые ордера");
  else if (!requestSource.complete) warnings.push("неполная выгрузка РКО");
  const requests = requestSource?.rows || [];
  const currencySource = currencyPaymentsResult.status === "fulfilled" ? currencyPaymentsResult.value : null;
  if (!currencySource) warnings.push("валютные оплаты поставщикам");
  else if (!currencySource.complete) warnings.push("неполная выгрузка валютных оплат");
  const paymentEvidence = matchProcurementPaymentEvidence(
    plans.map((plan) => ({
      id: plan.id,
      planCode: plan.planCode,
      supplierPartner: plan.supplierPartner,
      supplierCounterparty: plan.supplierCounterparty,
      orderRefs: Array.isArray(plan.orderRefs) ? plan.orderRefs.map(String) : [],
      plannedAmount: Number(plan.plannedAmount),
      paymentMethod: plan.paymentMethod,
      foreignAmount: plan.foreignAmount == null ? null : Number(plan.foreignAmount),
      managerName: plan.manager.oneCManagerName || plan.manager.name,
      plannedDate: plan.plannedDate.toISOString(),
      createdAt: plan.createdAt.toISOString(),
      status: plan.status,
    })),
    requests,
    currencySource?.payments || [],
    currencySource?.conversions || [],
  );
  const serialized = plans.map((plan) => ({
    ...JSON.parse(JSON.stringify(plan)),
    evidence: paymentEvidence.get(plan.id)!,
  }));
  const matchedRefs = new Set(
    serialized
      .flatMap((plan) =>
        plan.evidence.cashOrders.map((order: { ref: string }) => order.ref),
      )
      .filter(Boolean),
  );
  const managerNames = new Set(
    procurementManagers.map((manager) =>
      normalizeManagerName(manager.oneCManagerName || manager.name),
    ),
  );
  const scopedOrders = ordersSource
    ? ordersRequiringPayment(ordersSource.rows).filter((order) => managerNames.has(normalizeManagerName(order.manager)))
    : [];
  const managerOrders = ordersSource
    ? ordersSource.rows.filter((order) => managerNames.has(normalizeManagerName(order.manager)))
    : [];
  const managerOrderByRef = new Map(managerOrders.map((order) => [order.ref, order]));
  const plansWithOrderContext = serialized.map((plan) => ({
    ...plan,
    orderContext: (plan.orderRefs as string[]).flatMap((ref) => {
      const order = managerOrderByRef.get(ref);
      const comment = procurementOrderCommentText(order?.orderComment || "");
      return order && comment
        ? [{ number: order.number || "без номера", text: comment }]
        : [];
    }),
  }));
  const settlementSummary = settlementsResult.status === "fulfilled"
    ? summarizeSupplierSettlements(
        settlementsResult.value.rows,
        managerOrders.map((order) => order.supplierPartner || order.supplierCounterparty).filter(Boolean),
      )
    : null;
  if (settlementsResult.status === "rejected") warnings.push("взаиморасчёты с поставщиками");
  else if (!settlementsResult.value.complete || settlementSummary?.unsupportedCurrencyRows) warnings.push("неполные взаиморасчёты с поставщиками");
  const planEvidenceById = new Map(serialized.map((plan) => [plan.id, plan.evidence]));
  const planningRows = calculateOrderPlanning(scopedOrders, plans.map((plan) => ({
    orderRefs: plan.orderRefs as string[],
    plannedAmount: Number(plan.plannedAmount),
    status: plan.status,
    issuedAmount: planEvidenceById.get(plan.id)?.state === "MISMATCH" ? 0 : Number(planEvidenceById.get(plan.id)?.issuedAmount || 0) + Number(planEvidenceById.get(plan.id)?.paidAmount || 0),
  })));
  const unplannedOrderCount = ordersSource ? planningRows.filter((order) => order.unplannedAmount > 0.009).length : null;
  const orderPaymentGapTotal = ordersSource ? scopedOrders.reduce((sum, order) => sum + Number(order.orderPaymentGap || 0), 0) : null;
  const supplierDebtTotal = settlementSummary?.debtTotal ?? null;
  const unplannedCashCount = requestSource
    ? requests
        .filter((request) =>
          managerNames.has(
            normalizeManagerName(request.requested_by?.name || ""),
          ),
        )
        .flatMap((request) => request.linked_cash_expense_orders?.rows || [])
        .filter(
          (order) =>
            order.posted === true &&
            order.deletion_mark !== true &&
            order.ref &&
            !matchedRefs.has(order.ref),
        ).length
    : null;
  const usdtBalance =
    balancesResult.status === "fulfilled"
      ? balancesResult.value.usdt
      : {
          balance: null,
          checkedAt: "",
          sourceLabel: "1С · Касса USDT",
          error: "USDT_BALANCE_UNAVAILABLE",
        };
  if (usdtBalance.error) warnings.push("остаток кассы USDT");
  const accountableBalance =
    balancesResult.status === "fulfilled"
      ? balancesResult.value.accountable
      : { balance: null, checkedAt: "", sourceLabel: "1С · Касса Подотчетника", error: "ACCOUNTABLE_BALANCE_UNAVAILABLE" };
  if (accountableBalance.error) warnings.push("остаток кассы подотчётника");
  const usdtRateReference = rateResult.status === "fulfilled" ? rateResult.value : undefined;
  if (!usdtRateReference?.rate) warnings.push("курс последней конвертации USDT");
  const ownerForecast = ownerForecastResult.status === "fulfilled" ? ownerForecastResult.value : null;
  const ownerMoney = ownerForecast?.money?.complete ? ownerForecast.money : null;
  const safeMinor = ownerBalance(ownerMoney, "Сейф Депозитный");
  const alfaCardMinor = ownerBalance(ownerMoney, "Банк Альфа КБР");
  const vtbCardMinor = ownerBalance(ownerMoney, "Банк ВТБ КБР");
  const tbankCardMinor = ownerBalance(ownerMoney, "Банк ТБанк КБР");
  const cardParts = [alfaCardMinor, vtbCardMinor, tbankCardMinor];
  const cardsMinor = cardParts.every((value) => value !== null)
    ? cardParts.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;
  const tbankAccountMinor = ownerBalance(ownerMoney, "Т-Банк КБР");
  const vtbAccountMinor = ownerBalance(ownerMoney, "ВТБ КБР");
  const bankParts = [tbankAccountMinor, vtbAccountMinor];
  const bankAccountsMinor = bankParts.every((value) => value !== null)
    ? bankParts.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;
  const payroll = payrollResult.status === "fulfilled" ? payrollResult.value : null;
  const salaryMinor = payroll?.sourceComplete ? payroll.payableMinor : null;
  const salaryDate = nextMonthDay(todayKey, 16);
  const rentDate = nextMonthDay(todayKey, 20);
  const firstDay = nextMonthDay(todayKey, 1);
  const horizonEnd = plusDays(todayKey, 30);
  const forecastPlans = plansWithOrderContext
    .filter((plan) => plan.status === "SUBMITTED" || plan.status === "APPROVED")
    .filter((plan) => plan.evidence.state !== "PAID_BY_ONE_C" && plan.evidence.state !== "ISSUED_BY_ONE_C")
    .map((plan) => {
      const reflected = plan.evidence.state === "MISMATCH"
        ? 0
        : Number(plan.evidence.issuedAmount || 0) + Number(plan.evidence.paidAmount || 0);
      return {
        id: plan.id,
        supplier: plan.supplierPartner,
        paymentMethod: plan.paymentMethod,
        status: plan.status,
        plannedDate: plan.plannedDate.slice(0, 10),
        requestedRub: Math.max(0, Number(plan.plannedAmount) - reflected).toFixed(2),
        issuedRub: "0",
      };
    });
  const datedRows = new Map<string, {
    date: string;
    items: { id: string; title: string; amountMinor: number | null; source: string; certainty: "fact" | "estimate" | "unknown" }[];
    safeOutMinor: number;
    cardsOutMinor: number;
  }>();
  const addForecastItem = (date: string, item: { id: string; title: string; amountMinor: number | null; source: string; certainty: "fact" | "estimate" | "unknown" }, bucket?: "safe" | "cards") => {
    if (date > horizonEnd) return;
    const row = datedRows.get(date) ?? { date, items: [], safeOutMinor: 0, cardsOutMinor: 0 };
    row.items.push(item);
    if (item.amountMinor !== null && bucket === "safe") row.safeOutMinor += item.amountMinor;
    if (item.amountMinor !== null && bucket === "cards") row.cardsOutMinor += item.amountMinor;
    datedRows.set(date, row);
  };
  addForecastItem(salaryDate, {
    id: "salary", title: "Зарплата", amountMinor: salaryMinor,
    source: salaryMinor === null ? "Сумма требует сверки с ОСВ" : "Остаток к выплате по 1С",
    certainty: salaryMinor === null ? "unknown" : "estimate",
  }, "safe");
  addForecastItem(rentDate, {
    id: "rent", title: "ООО «Заря» · аренда и коммунальные", amountMinor: 23_500_000,
    source: "Обычный ежемесячный ориентир: 215 000 ₽ + около 20 000 ₽",
    certainty: "estimate",
  }, "cards");
  addForecastItem(firstDay, {
    id: "salary-first", title: "Первая выплата зарплаты", amountMinor: null,
    source: "Сумма появится после расчёта нового периода", certainty: "unknown",
  });
  let unallocatedPlanCount = 0;
  for (const plan of forecastPlans) {
    if (plan.plannedDate <= todayKey || plan.plannedDate > horizonEnd) continue;
    const requestedMinor = Math.round(Number(plan.requestedRub) * 100);
    const issuedMinor = Math.round(Number(plan.issuedRub ?? "0") * 100);
    const remainingMinor = Math.max(0, requestedMinor - issuedMinor);
    if (!remainingMinor) continue;
    const bucket = plan.paymentMethod === "CASH" ? "safe" : undefined;
    if (!bucket) unallocatedPlanCount += 1;
    addForecastItem(plan.plannedDate, {
      id: `plan:${plan.id}`,
      title: `Заявка Астемира · ${plan.supplier}`,
      amountMinor: remainingMinor,
      source: plan.status === "SUBMITTED" ? "Ждёт вашего решения" : "Согласована",
      certainty: "fact",
    }, bucket);
  }
  let runningSafe = safeMinor;
  let runningCards = cardsMinor;
  const forecastRows = [...datedRows.values()].sort((left, right) => left.date.localeCompare(right.date)).map((row) => {
    const safeBeforeMinor = runningSafe;
    const cardsBeforeMinor = runningCards;
    if (runningSafe !== null) runningSafe -= row.safeOutMinor;
    if (runningCards !== null) runningCards -= row.cardsOutMinor;
    return {
      ...row,
      safeBeforeMinor,
      cardsBeforeMinor,
      safeAfterMinor: runningSafe,
      cardsAfterMinor: runningCards,
      gapMinor: Math.max(0, -(runningSafe ?? 0)) + Math.max(0, -(runningCards ?? 0)),
    };
  });
  const firstGap = forecastRows.find((row) => row.gapMinor > 0) ?? null;
  const tbank = tbankResult.status === "fulfilled" ? tbankResult.value : null;
  const cashPreparation = buildProcurementCashPreparation({
    asOf: todayKey,
    dueOn: salaryDate,
    requiredMinor: salaryMinor,
    safeMinor,
    vtbCardMinor,
    vtbAccountMinor,
    tbankCardMinor,
    tbankAccountMinor,
    tbankTransferStatus: tbank?.status ?? "unavailable",
    tbankCurrentRateBps: tbank?.currentRateBps ?? null,
    tbankCurrentTierRemainingMinor: tbank?.currentRateBps === 0
      ? tbank?.freeRemainingMinor ?? null
      : tbank?.currentRateBps === 100
        ? tbank?.tierOneRemainingMinor ?? null
        : tbank?.currentRateBps === 500
          ? tbank?.tierFiveRemainingMinor ?? null
          : tbank?.currentRateBps === 1500 ? tbankAccountMinor : null,
  });
  const priorityDebts = priorityDebtsResult.status === "fulfilled" ? priorityDebtsResult.value : null;
  const scopedSupplierNames = new Set([
    ...managerOrders.map((order) => normalizeManagerName(order.supplierPartner || order.supplierCounterparty)),
    ...forecastPlans.map((plan) => normalizeManagerName(plan.supplier)),
  ]);
  const astemirSupplierWarnings = buildSupplierIntelligence({
    orders: scopedOrders.map((order) => ({
      supplier: order.supplierPartner || order.supplierCounterparty,
      orderPaymentGapMinor: Math.round(Number(order.orderPaymentGap || 0) * 100),
    })),
    debts: (priorityDebts?.supplierDebts ?? [])
      .filter((debt) => scopedSupplierNames.has(normalizeManagerName(debt.name)))
      .map((debt) => ({
        supplier: debt.name,
        debtMinor: Math.round(debt.amountRub * 100),
        verified: !priorityDebts?.sourceDraft,
      })),
  });
  const warningKeys = new Set(astemirSupplierWarnings.map((item) => normalizeManagerName(item.supplier)));
  const supplierWarnings = astemirSupplierWarnings.map((item) => ({
    supplier: item.supplier,
    level: item.level,
    amountMinor: item.primaryAmountMinor,
    metric: item.primaryMetric === "debt" ? "Долг по 1С" : "Осталось по активным заказам",
    reason: item.reason,
    action: item.action,
    confidence: item.confidence,
  }));
  for (const debt of [
    { supplier: "95‑RU", amountRub: priorityDebts?.ninetyFiveRu ?? null, attention: 1_000_000, urgent: 2_000_000 },
    { supplier: "Зелим Чечня", amountRub: priorityDebts?.zelimChechnya ?? null, attention: 300_000, urgent: 1_000_000 },
  ]) {
    if (debt.amountRub === null || debt.amountRub < debt.attention || warningKeys.has(normalizeManagerName(debt.supplier))) continue;
    supplierWarnings.push({
      supplier: debt.supplier,
      level: debt.amountRub >= debt.urgent ? "urgent" : "attention",
      amountMinor: Math.round(debt.amountRub * 100),
      metric: "Долг по 1С",
      reason: "Сальдо превысило установленный порог внимания.",
      action: debt.amountRub >= debt.urgent
        ? "Определить сумму ближайшей частичной оплаты после обязательных выплат."
        : "Проверить договорённость и решить, нужен ли частичный платёж.",
      confidence: priorityDebts?.sourceDraft ? "needs_review" : "current_snapshot",
    });
  }
  supplierWarnings.sort((left, right) => (left.level === right.level ? right.amountMinor - left.amountMinor : left.level === "urgent" ? -1 : 1));
  const warningPriority = new Map(supplierWarnings.map((warning) => [
    normalizeManagerName(warning.supplier).replace(/[‐‑–—]/g, "-"),
    warning.level === "urgent" ? 1 : 2,
  ]));
  const approvedPlanReserveMinor = forecastPlans
    .filter((plan) => plan.status === "APPROVED")
    .reduce((sum, plan) => sum + Math.round(Number(plan.requestedRub) * 100), 0);
  const mandatoryReserveMinor = salaryMinor === null || plansResult.status !== "fulfilled"
    ? null
    : salaryMinor + 23_500_000 + approvedPlanReserveMinor;
  const resourcesMinor = safeMinor === null || cardsMinor === null || bankAccountsMinor === null
    ? null
    : safeMinor + cardsMinor + bankAccountsMinor;
  const debtAllocation = buildProcurementDebtAllocation({
    resourcesMinor,
    mandatoryReserveMinor,
    resourcesComplete: ownerMoney !== null,
    debtsComplete: Boolean(priorityDebts && !priorityDebts.sourceDraft),
    debts: (priorityDebts?.supplierDebts ?? []).map((debt) => {
      const key = normalizeManagerName(debt.name).replace(/[‐‑–—]/g, "-");
      const isNinetyFive = /^95[\s-]*ru$/.test(key);
      const isZelim = key === "зелим чечня";
      return {
        supplier: debt.name,
        debtMinor: Math.round(debt.amountRub * 100),
        priority: isNinetyFive ? 0 : isZelim ? 1 : (warningPriority.get(key) ?? 3) + 1,
        verified: !priorityDebts?.sourceDraft,
      };
    }),
  });
  const forecast30Days = {
    asOf: todayKey,
    horizonEnd,
    checkedAt: new Date().toISOString(),
    rows: forecastRows,
    firstGap: firstGap ? { date: firstGap.date, amountMinor: firstGap.gapMinor } : null,
    safeMinor,
    cardsMinor,
    coverageReady: safeMinor !== null && cardsMinor !== null,
    allocatedOutMinor: forecastRows.reduce((sum, row) => sum + row.safeOutMinor + row.cardsOutMinor, 0),
    scheduledOutMinor: forecastRows.reduce((sum, row) => sum + row.items.reduce((itemSum, item) => itemSum + (item.amountMinor ?? 0), 0), 0),
    unallocatedPlanCount,
    tbank: tbank ? {
      status: tbank.status,
      renewsOn: tbank.renewsOn,
      freeRemainingMinor: tbank.freeRemainingMinor,
      tierOneRemainingMinor: tbank.tierOneRemainingMinor,
      currentRateBps: tbank.currentRateBps,
    } : null,
    limitations: [
      "Будущие поступления пока не подтверждены и в расчёт не включены.",
      "Переводы между расчётными счетами, картами и сейфом не предполагаются автоматически.",
      ...(unallocatedPlanCount ? [`${unallocatedPlanCount} заявок без подтверждённого источника денег показаны по датам, но не уменьшают сейф или карты.`] : []),
    ],
  };
  return (
    <AdminShell>
      <AdminBreadcrumbs current="Закупки" />
      <AdminPageHeader
        eyebrow="Закупки"
        title="Платёжный календарь"
        description="Когда подготовить деньги, какие оплаты согласовать и что уже подтверждено в 1С."
      />
      <div className="mt-5">
        <AdminProcurementClient
          initialPlans={plansWithOrderContext}
          sourceCheckedAt={ordersSource?.checkedAt || ""}
          sourceWarnings={warnings}
          unplannedOrderCount={unplannedOrderCount}
          openOrderCount={ordersSource ? scopedOrders.length : null}
          orderPaymentGapTotal={orderPaymentGapTotal}
          unplannedCashCount={unplannedCashCount}
          supplierDebtTotal={supplierDebtTotal}
          usdtBalance={usdtBalance}
          accountableBalance={accountableBalance}
          usdtRateReference={usdtRateReference}
          todayKey={todayKey}
          forecastHistory={forecastHistoryResult.status === "fulfilled" ? forecastHistoryResult.value : {
            state: "unavailable",
            checkedAt: "",
            previousChangedAt: "",
            currentChangedAt: "",
            change: null,
          }}
          forecast30Days={forecast30Days}
          supplierWarnings={supplierWarnings}
          supplierWarningsReady={Boolean(priorityDebts && ordersSource?.complete)}
          debtAllocation={debtAllocation}
          cashPreparation={cashPreparation}
          debtReserveBreakdown={{
            salaryMinor,
            rentMinor: 23_500_000,
            approvedPlansMinor: approvedPlanReserveMinor,
          }}
        />
      </div>
    </AdminShell>
  );
}
