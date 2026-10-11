import { AdminShell } from "@/components/AdminShell";
import { preservePaymentEvidenceViews } from '@/lib/procurement-evidence-continuity';
import { AdminBreadcrumbs } from "@/components/AdminBreadcrumbs";
import { prisma } from "@/lib/prisma";
import { expenseRequestMoscowDayEnd, fetchExpenseRequestSnapshot } from "@/lib/expense-request-source";
import { calculateOrderPlanning } from "@/lib/procurement-payment-control";
import { fetchSupplierCurrencyPaymentSnapshot } from "@/lib/procurement-currency-payment-source";
import { matchProcurementPaymentEvidence } from "@/lib/procurement-currency-payment-evidence";
import { paymentEvidenceFrom, paymentTimestamp, uniqueSupplierPayments } from "@/lib/procurement-ruble-payment-evidence";
import { manualPaymentLinks, samePaymentSupplier } from "@/lib/procurement-manual-payment-links";
import { paymentCompletion, COMPLETED_WITHOUT_TOPUP } from '@/lib/procurement-payment-completion';
import { ProcurementUnlinkedPayments } from "@/components/ProcurementUnlinkedPayments";
import {attachRequestOrderLinks} from '@/lib/procurement-request-payment-link';
import { readPaymentRevision, paymentMatchCreatedAt } from "@/lib/procurement-plan-revision";
import { isFinishedPaymentState } from '@/lib/procurement-small-remainder';
import { ProcurementRevisionReview } from "@/components/ProcurementRevisionReview";
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

import { buildAdminProcurementForecast, type AdminForecastInput } from '@/lib/procurement-admin-forecast';

export const dynamic = "force-dynamic";

export default async function AdminProcurementPage() {
  const evidenceReadStartedAt = new Date();
  const todayKey = expenseRequestMoscowCalendarDate(new Date());
  const to = expenseRequestMoscowDayEnd();
  const from = new Date(to);
  from.setDate(from.getDate() - 31);
  const plansQuery = prisma.supplierPaymentPlan.findMany({
    include: { events: {orderBy:{createdAt:"desc"},take:20}, manager: { select: { name: true, oneCManagerName: true } } },
    orderBy: [{ plannedDate: "asc" }, { createdAt: "desc" }],
  }).then(rows => rows); // Execute once; all evidence readers share the same plans.
  const [plansResult, managersResult, ordersResult, settlementsResult, requestsResult, balancesResult, rateResult, currencyPaymentsResult] =
    await Promise.allSettled([
      plansQuery,
      prisma.user.findMany({
        where: { portalArea: "PROCUREMENT" },
        select: { name: true, oneCManagerName: true },
      }),
      fetchSupplierOrderFinance(),
      fetchSupplierSettlements(),
      plansQuery.then(rows => fetchExpenseRequestSnapshot({ from: paymentEvidenceFrom(rows, from), to, includeHistory: true, historyConcurrency: 2 })),
      getProcurementBalances(todayKey),
      getLatestProcurementUsdtRate(todayKey),
      plansQuery.then((rows) => fetchSupplierCurrencyPaymentSnapshot({ from: paymentEvidenceFrom(rows, from), to, timeoutMs: 15_000, plans: rows })),
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
  if (!currencySource) warnings.push("оплаты поставщикам");
  else if (!currencySource.complete) warnings.push("неполная выгрузка оплат поставщикам");
  else if (!currencySource.rubPaymentsSupported) warnings.push("для сверки рублёвых оплат требуется обновление API 1С");
  const paymentEvidence = matchProcurementPaymentEvidence(
    plans.map((plan) => ({
      id: plan.id,
      planCode: plan.planCode,
      supplierPartner: plan.supplierPartner,
      supplierCounterparty: plan.supplierCounterparty,
      orderRefs: Array.isArray(plan.orderRefs) ? plan.orderRefs.map(String) : [],
      plannedAmount: Number(plan.plannedAmount),
      paymentMethod: plan.paymentMethod,
      paymentPurpose: plan.paymentPurpose,
      foreignAmount: plan.foreignAmount == null ? null : Number(plan.foreignAmount),
      managerName: plan.manager.oneCManagerName || plan.manager.name,
      plannedDate: plan.plannedDate.toISOString(),
      createdAt: paymentMatchCreatedAt(plan),
      status: plan.status,
      currency: plan.currency,
      hasPendingRevision: Boolean(readPaymentRevision(plan.oneCCashEvidence)),
      manualRubleLinks: manualPaymentLinks(plan.oneCCashEvidence),
      completedPaymentRefs: paymentCompletion(plan.oneCCashEvidence)?.paymentRefs,
    })),
    requests,
    currencySource?.complete ? currencySource.payments : [],
    currencySource?.conversions || [],
    { allowSmallRemainder: plansResult.status === 'fulfilled' && requestSource?.complete === true && currencySource?.complete === true && currencySource.rubPaymentsSupported === true },
  );
  const evidenceComplete = plansResult.status === 'fulfilled' && requestSource?.complete === true &&
    currencySource?.complete === true && currencySource.rubPaymentsSupported === true;
  const displayEvidence = await preservePaymentEvidenceViews(plans, paymentEvidence, evidenceComplete,
    evidenceReadStartedAt, prisma.supplierPaymentPlan);
  const serialized = plans.map((plan) => ({
    ...JSON.parse(JSON.stringify(plan)),
    evidence: paymentEvidence.get(plan.id)!,
  }));
  if (!requestSource?.complete || !currencySource?.complete || currencySource.rubPaymentsSupported !== true) {
    for (const row of paymentEvidence.values()) delete row.collection;
  }
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
  const forecastInput: AdminForecastInput = {
    todayKey, plansComplete: plansResult.status === 'fulfilled', ordersComplete: ordersSource?.complete === true,
    plansWithOrderContext: plansWithOrderContext.map(({id,status,supplierPartner,paymentMethod,plannedDate,plannedAmount,foreignAmount,evidence}) => ({id,status,supplierPartner,paymentMethod,plannedDate,plannedAmount,foreignAmount,evidence:{state:evidence.state,issuedAmount:evidence.issuedAmount,paidAmount:evidence.paidAmount,remainingForeignAmount:evidence.remainingForeignAmount}})),
    scopedOrders: scopedOrders.map(({supplierPartner,supplierCounterparty,orderPaymentGap})=>({supplierPartner,supplierCounterparty,orderPaymentGap})),
    managerOrders: managerOrders.map(({supplierPartner,supplierCounterparty})=>({supplierPartner,supplierCounterparty})),
    usdtBalance:{balance:usdtBalance.balance}, accountableBalance:{balance:accountableBalance.balance}, usdtRateReference,
  };
  const manualLinksForDisplay = plans.filter(plan => plan.status !== COMPLETED_WITHOUT_TOPUP).flatMap((plan) =>
    manualPaymentLinks(plan.oneCCashEvidence).map((link) => {
      const payment = [...(paymentEvidence.get(plan.id)?.cashOrders || []), ...(paymentEvidence.get(plan.id)?.currencyPayments || [])]
        .find(order => order.ref === link.ref);
      return {
        planId: plan.id, ref: link.ref,
        label: `${plan.supplierPartner} · ${plan.planCode}${payment ? ` · РКО ${payment.number}` : ''}`,
        confirmed: Boolean(payment),
      };
    }));
  return (
    <AdminShell>
      <AdminBreadcrumbs current="Закупки" />
      <div className="space-y-3">
        <AdminProcurementClient
          revisionCount={plans.filter(plan=>readPaymentRevision(plan.oneCCashEvidence)).length}
          revisionReview={<ProcurementRevisionReview items={plans.flatMap(plan => {const revision=readPaymentRevision(plan.oneCCashEvidence);return revision ? [{id:plan.id,supplierPartner:plan.supplierPartner,revision}] : [];})} />}
          paymentLinks={evidenceComplete ? <ProcurementUnlinkedPayments
          payments={uniqueSupplierPayments(attachRequestOrderLinks(currencySource?.complete ? currencySource.payments : [], requestsResult.status === 'fulfilled' ? requestsResult.value.rows : []))
            .filter((payment) => ['РУБ', 'USDT'].includes(payment.documentCurrency) && payment.posted && !payment.deleted && payment.documentAmount > 0 &&
              plans.some((plan) => plan.status === 'APPROVED' && samePaymentSupplier(plan, payment) && plan.createdAt.getTime() <= paymentTimestamp(payment.date) &&
                !isFinishedPaymentState(paymentEvidence.get(plan.id)?.state)) &&
              ![...paymentEvidence.values()].some((item) => [...item.cashOrders, ...item.currencyPayments].some((order) => order.ref === payment.ref)) &&
              !plans.some((plan) => manualPaymentLinks(plan.oneCCashEvidence).some((link) => link.ref === payment.ref)))
            .slice().reverse()}
          plans={plans.map((plan) => ({ id: plan.id, supplierPartner: plan.supplierPartner,
            supplierCounterparty: plan.supplierCounterparty, orderRefs: Array.isArray(plan.orderRefs) ? plan.orderRefs.map(String) : [], orderNumbers: Array.isArray(plan.orderNumbers) ? plan.orderNumbers.map(String) : [],
            remaining: paymentEvidence.get(plan.id)?.remainingAmount || 0, remainingForeign: paymentEvidence.get(plan.id)?.remainingForeignAmount ?? null, status: plan.status, paymentMethod: plan.paymentMethod }))}
          linked={manualLinksForDisplay}
        /> : null}
          paymentLinkHistory={evidenceComplete ? <ProcurementUnlinkedPayments view="history" payments={[]} plans={[]} linked={manualLinksForDisplay} /> : null}
          initialPlans={plansWithOrderContext.map(plan => ({ ...plan, evidence: displayEvidence.get(plan.id)! }))}
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
          forecastInput={forecastInput}
          {...buildAdminProcurementForecast(forecastInput, null)}
        />
      </div>
    </AdminShell>
  );
}
