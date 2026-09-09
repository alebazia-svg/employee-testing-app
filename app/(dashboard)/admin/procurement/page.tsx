import { AdminShell } from "@/components/AdminShell";
import { AdminBreadcrumbs } from "@/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { prisma } from "@/lib/prisma";
import { fetchExpenseRequestSnapshot } from "@/lib/expense-request-source";
import { matchCashEvidence } from "@/lib/procurement-payment-control";
import {
  fetchSupplierOrderFinance,
  normalizeManagerName,
  ordersRequiringPayment,
} from "@/lib/procurement-payment-source";
import AdminProcurementClient from "./AdminProcurementClient";
import { getProcurementBalances } from "@/lib/procurement-currency-balance";
import { expenseRequestMoscowCalendarDate } from "@/lib/expense-request-source";

export const dynamic = "force-dynamic";

export default async function AdminProcurementPage() {
  const todayKey = expenseRequestMoscowCalendarDate(new Date());
  const to = new Date();
  to.setDate(to.getDate() + 1);
  const from = new Date(to);
  from.setDate(from.getDate() - 31);
  const [plansResult, managersResult, ordersResult, requestsResult, balancesResult] =
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
      fetchExpenseRequestSnapshot({ from, to }),
      getProcurementBalances(todayKey),
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
  const serialized = plans.map((plan) => ({
    ...JSON.parse(JSON.stringify(plan)),
    evidence: matchCashEvidence(
      {
        planCode: plan.planCode,
        supplierPartner: plan.supplierPartner,
        supplierCounterparty: plan.supplierCounterparty,
        plannedAmount: Number(plan.plannedAmount),
        managerName: plan.manager.oneCManagerName || plan.manager.name,
        plannedDate: plan.plannedDate.toISOString(),
      },
      requests,
    ),
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
  const plannedOrderRefs = new Set(
    plans
      .filter((plan) => plan.status !== "CANCELLED")
      .flatMap((plan) => plan.orderRefs as string[]),
  );
  const unplannedOrderCount = ordersSource
    ? ordersRequiringPayment(ordersSource.rows).filter(
        (order) =>
          managerNames.has(normalizeManagerName(order.manager)) &&
          !plannedOrderRefs.has(order.ref),
      ).length
    : null;
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
          initialPlans={serialized}
          sourceCheckedAt={ordersSource?.checkedAt || ""}
          sourceWarnings={warnings}
          unplannedOrderCount={unplannedOrderCount}
          unplannedCashCount={unplannedCashCount}
          usdtBalance={usdtBalance}
          accountableBalance={accountableBalance}
          todayKey={todayKey}
        />
      </div>
    </AdminShell>
  );
}
