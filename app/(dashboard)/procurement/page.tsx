import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  fetchSupplierOrderFinance,
  ordersForManager,
  ordersRequiringPayment,
} from "@/lib/procurement-payment-source";
import ProcurementPaymentCalendarClient from "./ProcurementPaymentCalendarClient";
import { getProcurementBalances } from "@/lib/procurement-currency-balance";
import { expenseRequestMoscowCalendarDate, fetchExpenseRequestSnapshot } from "@/lib/expense-request-source";
import { getLatestProcurementUsdtRate } from "@/lib/procurement-usdt-rate";
import { fetchSupplierCurrencyPaymentSnapshot } from "@/lib/procurement-currency-payment-source";
import { matchProcurementPaymentEvidence } from "@/lib/procurement-currency-payment-evidence";
import { fetchSupplierSettlements, summarizeSupplierSettlements } from "@/lib/procurement-supplier-settlements";

export const dynamic = "force-dynamic";

export default async function ProcurementPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const todayKey = expenseRequestMoscowCalendarDate(new Date());
  const requestTo = new Date();
  requestTo.setDate(requestTo.getDate() + 1);
  const requestFrom = new Date(requestTo);
  requestFrom.setDate(requestFrom.getDate() - 31);
  const [plansResult, ordersResult, settlementsResult, balancesResult, rateResult, requestsResult, currencyPaymentsResult] = await Promise.allSettled([
    prisma.supplierPaymentPlan.findMany({
      where: { managerUserId: user.id },
      include: { events: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: [{ plannedDate: "asc" }, { createdAt: "desc" }],
    }),
    fetchSupplierOrderFinance(),
    fetchSupplierSettlements(),
    getProcurementBalances(todayKey),
    getLatestProcurementUsdtRate(todayKey),
    fetchExpenseRequestSnapshot({ from: requestFrom, to: requestTo }),
    fetchSupplierCurrencyPaymentSnapshot({ from: requestFrom, to: requestTo, timeoutMs: 6_000 }),
  ]);
  const plans = plansResult.status === "fulfilled" ? plansResult.value : [];
  const source =
    ordersResult.status === "fulfilled" ? ordersResult.value : null;
  const managerName = user.oneCManagerName?.trim() || user.name;
  const managerOrders = source ? ordersForManager(source.rows, managerName) : [];
  const orders = ordersRequiringPayment(managerOrders);
  const supplierNames = managerOrders.map((order) => order.supplierPartner || order.supplierCounterparty).filter(Boolean);
  const settlementSummary = settlementsResult.status === "fulfilled"
    ? summarizeSupplierSettlements(settlementsResult.value.rows, supplierNames)
    : null;
  const managerMappingError = Boolean(
    source?.rows.length && managerOrders.length === 0,
  );
  const sourceError =
    ordersResult.status === "rejected"
      ? ordersResult.reason instanceof Error
        ? ordersResult.reason.message
        : "SOURCE_FAILED"
      : "";
  const usdtBalance =
    balancesResult.status === "fulfilled"
      ? balancesResult.value.usdt
      : {
          balance: null,
          checkedAt: "",
          sourceLabel: "1С · Касса USDT",
          error: "USDT_BALANCE_UNAVAILABLE",
      };
  const accountableBalance =
    balancesResult.status === "fulfilled"
      ? balancesResult.value.accountable
      : { balance: null, checkedAt: "", sourceLabel: "1С · Касса Подотчетника", error: "ACCOUNTABLE_BALANCE_UNAVAILABLE" };
  const requests = requestsResult.status === "fulfilled" ? requestsResult.value.rows : [];
  const currencySource = currencyPaymentsResult.status === "fulfilled" ? currencyPaymentsResult.value : null;
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
      managerName: managerName,
      plannedDate: plan.plannedDate.toISOString(),
      createdAt: plan.createdAt.toISOString(),
      status: plan.status,
    })),
    requests,
    currencySource?.payments || [],
    currencySource?.conversions || [],
  );
  const serializedPlans = plans.map((plan) => {
    const latestSnapshot = plan.events[0]?.snapshot;
    const snapshot = latestSnapshot && typeof latestSnapshot === "object" && !Array.isArray(latestSnapshot)
      ? latestSnapshot as Record<string, unknown>
      : {};
    return {
      ...JSON.parse(JSON.stringify(plan)),
      correctionReason: typeof snapshot.correctionReason === "string" ? snapshot.correctionReason : "",
      evidence: paymentEvidence.get(plan.id)!,
    };
  });
  return (
    <ProcurementPaymentCalendarClient
      initialOrders={orders}
      initialPlans={serializedPlans}
      checkedAt={source?.checkedAt || ""}
      sourceError={sourceError}
      evidenceSourceError={!currencySource || !currencySource.complete}
      managerMappingError={managerMappingError}
      supplierBalances={settlementSummary?.bySupplier || {}}
      supplierDebtTotal={settlementSummary?.debtTotal ?? null}
      supplierDebtError={settlementsResult.status === "rejected" || settlementsResult.value.complete === false || Boolean(settlementSummary?.unsupportedCurrencyRows)}
      usdtBalance={usdtBalance}
      accountableBalance={accountableBalance}
      usdtRateReference={rateResult.status === "fulfilled" ? rateResult.value : undefined}
      todayKey={todayKey}
    />
  );
}
