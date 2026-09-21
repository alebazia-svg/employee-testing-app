import { getCurrentUser } from "@/lib/auth";
import { usdtReservedByPlans } from "@/lib/procurement-usdt-reserve";
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
import { paymentEvidenceFrom } from "@/lib/procurement-ruble-payment-evidence";
import { manualPaymentLinks } from "@/lib/procurement-manual-payment-links";
import { readPaymentRevision, paymentMatchCreatedAt } from "@/lib/procurement-plan-revision";
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
  // Match globally so an RKO cannot independently close requests in two cabinets.
  // Only the authenticated manager's plans are serialized below.
  const plansQuery = prisma.supplierPaymentPlan.findMany({
    include: { events: { orderBy: { createdAt: "desc" }, take: 20 }, manager: { select: { name: true, oneCManagerName: true } } },
    orderBy: [{ plannedDate: "asc" }, { createdAt: "desc" }],
  });
  const [plansResult, ordersResult, settlementsResult, balancesResult, rateResult, requestsResult, currencyPaymentsResult] = await Promise.allSettled([
    plansQuery,
    fetchSupplierOrderFinance(),
    fetchSupplierSettlements(),
    getProcurementBalances(todayKey),
    getLatestProcurementUsdtRate(todayKey),
    fetchExpenseRequestSnapshot({ from: requestFrom, to: requestTo }),
    plansQuery.then((rows) => fetchSupplierCurrencyPaymentSnapshot({ from: paymentEvidenceFrom(rows, requestFrom), to: requestTo, timeoutMs: 15_000 })),
  ]);
  const allPlans = plansResult.status === "fulfilled" ? plansResult.value : [];
  const plans = allPlans.filter((plan) => plan.managerUserId === user.id);
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
    allPlans.map((plan) => ({
      id: plan.id,
      planCode: plan.planCode,
      supplierPartner: plan.supplierPartner,
      supplierCounterparty: plan.supplierCounterparty,
      orderRefs: Array.isArray(plan.orderRefs) ? plan.orderRefs.map(String) : [],
      plannedAmount: Number(plan.plannedAmount),
      paymentMethod: plan.paymentMethod,
      foreignAmount: plan.foreignAmount == null ? null : Number(plan.foreignAmount),
      managerName: plan.manager.oneCManagerName?.trim() || plan.manager.name,
      plannedDate: plan.plannedDate.toISOString(),
      createdAt: paymentMatchCreatedAt(plan),
      status: plan.status,
      manualRubleLinks: manualPaymentLinks(plan.oneCCashEvidence),
    })),
    requests,
    currencySource?.complete ? currencySource.payments : [],
    currencySource?.conversions || [],
  );
  const serializedPlans = plans.map((plan) => {
    const latestSnapshot = plan.events[0]?.snapshot;
    const snapshot = latestSnapshot && typeof latestSnapshot === "object" && !Array.isArray(latestSnapshot)
      ? latestSnapshot as Record<string, unknown>
      : {};
    return {
      ...JSON.parse(JSON.stringify(plan)),
      revision: readPaymentRevision(plan.oneCCashEvidence),
      correctionReason: typeof snapshot.correctionReason === "string" ? snapshot.correctionReason : "",
      evidence: paymentEvidence.get(plan.id)!,
    };
  });
  // Expose only the aggregate reserve of other managers, never their requests.
  const otherUsdtReserve = plansResult.status !== 'fulfilled' ? null : usdtReservedByPlans(
    allPlans.filter(plan => plan.managerUserId !== user.id).map(plan => ({
      status: plan.status, paymentMethod: plan.paymentMethod,
      plannedAmount: Number(plan.plannedAmount),
      foreignAmount: plan.foreignAmount == null ? null : Number(plan.foreignAmount),
      evidence: paymentEvidence.get(plan.id),
    })), rateResult.status === 'fulfilled' ? rateResult.value.rate : null,
  );
  return (
    <ProcurementPaymentCalendarClient
      initialOrders={orders}
      initialPlans={serializedPlans}
      otherUsdtReserve={otherUsdtReserve}
      checkedAt={source?.checkedAt || ""}
      sourceError={sourceError}
      evidenceSourceError={!currencySource || !currencySource.complete || !currencySource.rubPaymentsSupported}
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
