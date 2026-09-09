import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  fetchSupplierOrderFinance,
  ordersForManager,
  ordersRequiringPayment,
} from "@/lib/procurement-payment-source";
import ProcurementPaymentCalendarClient from "./ProcurementPaymentCalendarClient";
import { getProcurementBalances } from "@/lib/procurement-currency-balance";
import { expenseRequestMoscowCalendarDate } from "@/lib/expense-request-source";
import { getLatestProcurementUsdtRate } from "@/lib/procurement-usdt-rate";

export const dynamic = "force-dynamic";

export default async function ProcurementPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const todayKey = expenseRequestMoscowCalendarDate(new Date());
  const [plansResult, ordersResult, balancesResult, rateResult] = await Promise.allSettled([
    prisma.supplierPaymentPlan.findMany({
      where: { managerUserId: user.id },
      orderBy: [{ plannedDate: "asc" }, { createdAt: "desc" }],
    }),
    fetchSupplierOrderFinance(),
    getProcurementBalances(todayKey),
    getLatestProcurementUsdtRate(todayKey),
  ]);
  const plans = plansResult.status === "fulfilled" ? plansResult.value : [];
  const source =
    ordersResult.status === "fulfilled" ? ordersResult.value : null;
  const managerName = user.oneCManagerName?.trim() || user.name;
  const managerOrders = source ? ordersForManager(source.rows, managerName) : [];
  const orders = ordersRequiringPayment(managerOrders);
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
  return (
    <ProcurementPaymentCalendarClient
      initialOrders={orders}
      initialPlans={JSON.parse(JSON.stringify(plans))}
      checkedAt={source?.checkedAt || ""}
      sourceError={sourceError}
      managerMappingError={managerMappingError}
      usdtBalance={usdtBalance}
      accountableBalance={accountableBalance}
      usdtRateReference={rateResult.status === "fulfilled" ? rateResult.value : undefined}
      todayKey={todayKey}
    />
  );
}
