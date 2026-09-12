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

export const dynamic = "force-dynamic";

export default async function AdminProcurementPage() {
  const todayKey = expenseRequestMoscowCalendarDate(new Date());
  const to = new Date();
  to.setDate(to.getDate() + 1);
  const from = new Date(to);
  from.setDate(from.getDate() - 31);
  const [plansResult, managersResult, ordersResult, settlementsResult, requestsResult, balancesResult, rateResult, currencyPaymentsResult] =
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
        />
      </div>
    </AdminShell>
  );
}
