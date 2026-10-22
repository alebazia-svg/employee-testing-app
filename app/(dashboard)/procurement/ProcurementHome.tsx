import {Suspense} from 'react';
import {randomUUID} from 'node:crypto';
import {readAdminPlans,sameAdminPlanVersions,type AdminPlans} from '@/lib/procurement-admin-plans';
import {buyerInitialView} from '@/lib/procurement-buyer-initial-view';
import {ProcurementCalendarStream,ProcurementCalendarUpdate} from './ProcurementCalendarStream';
import { preservePaymentEvidenceViews } from '@/lib/procurement-evidence-continuity';
import { ProcurementDeliveryPanel } from '@/components/ProcurementDeliveryPanel';
import { deliveryMappedUser, loadDeliveryView } from '@/lib/procurement-delivery-reminders';
import { deliveryUserAllowed } from '@/lib/procurement-delivery-policy';
import { procurementSourceHealth } from '@/lib/procurement-source-health';
import { usdtReservedByPlans } from "@/lib/procurement-usdt-reserve";
import { prisma } from "@/lib/prisma";
import { getProcurementCnyRate } from '@/lib/procurement-cny-rate';
import {
  ordersForManager,
} from "@/lib/procurement-payment-source";
import { fetchRequestOrderCatalogue } from '@/lib/procurement-request-catalogue';
import { fetchManagerSupplierNames } from '@/lib/procurement-supplier-roster';
import {cargoManagerAllowed} from '@/lib/procurement-cargo';
import { getProcurementBalances } from "@/lib/procurement-currency-balance";
import { expenseRequestMoscowCalendarDate, expenseRequestMoscowDayEnd, fetchExpenseRequestSnapshot } from "@/lib/expense-request-source";
import { getLatestProcurementUsdtRate } from "@/lib/procurement-usdt-rate";
import { fetchSupplierCurrencyPaymentSnapshot } from "@/lib/procurement-currency-payment-source";
import { matchProcurementPaymentEvidence } from "@/lib/procurement-currency-payment-evidence";
import {readQrFunding,attachQrFunding} from '@/lib/procurement-qr-funding-source';
import { paymentEvidenceFrom } from "@/lib/procurement-ruble-payment-evidence";
import { manualPaymentLinks } from "@/lib/procurement-manual-payment-links";
import { paymentCompletion } from '@/lib/procurement-payment-completion';
import { readPaymentRevision, paymentMatchCreatedAt } from "@/lib/procurement-plan-revision";
import { fetchSupplierSettlements, summarizeSupplierSettlements } from "@/lib/procurement-supplier-settlements";

type ProcurementUser = { id: number; name: string; role: string; portalArea: string; isActive: boolean; oneCManagerName: string | null };

export async function ProcurementHome({user, readOnly = false}: {user: ProcurementUser; readOnly?: boolean}) {
  const plans=await readAdminPlans();
  const generation=randomUUID();
  const initial=buyerInitialView(plans,user.id,expenseRequestMoscowCalendarDate(new Date()),cargoManagerAllowed(user.oneCManagerName?.trim()||user.name));
  // Keep the global matching input inside the server closure. Passing it as
  // component props also exposes it through development RSC debug payloads.
  async function Live() {
    try { return await readLive({ user, readOnly, initialPlans: plans, generation }); }
    catch { return <ProcurementCalendarUpdate generation={generation} data={null}/>; }
  }
  return <ProcurementCalendarStream initial={initial} generation={generation}>
    <Suspense fallback={null}><Live/></Suspense>
  </ProcurementCalendarStream>;
}

async function readLive({user,initialPlans,generation,readOnly}:{user:ProcurementUser;readOnly:boolean;initialPlans:AdminPlans;generation:string}) {
  const evidenceReadStartedAt = new Date();
  const deliveryPromise = deliveryUserAllowed(user)
    ? deliveryMappedUser().then(mapped => mapped.id === user.id ? loadDeliveryView() : null).catch(() => null)
    : Promise.resolve(null);
  const todayKey = expenseRequestMoscowCalendarDate(new Date());
  const requestTo = expenseRequestMoscowDayEnd();
  const requestFrom = new Date(requestTo);
  requestFrom.setDate(requestFrom.getDate() - 31);
  // Match globally so an RKO cannot independently close requests in two cabinets.
  // Only the authenticated manager's plans are serialized below.
  const plansQuery = Promise.resolve(initialPlans);
  const qrFundingPromise=readQrFunding(initialPlans.map(p=>({...p,plannedAmount:Number(p.plannedAmount),createdAt:paymentMatchCreatedAt(p),hasPendingRevision:!!readPaymentRevision(p.oneCCashEvidence)})),todayKey);
  const cnyRatePromise = plansQuery.then(rows => getProcurementCnyRate(rows
    .filter(plan => plan.managerUserId === user.id && plan.status !== 'CANCELLED' && plan.paymentMethod !== 'USDT')
    .map(plan => ({comment:plan.condition, date:plan.createdAt, knownCny:plan.paymentMethod==='CNY', sourceLabel:'Комментарий заявки', documentNumber:plan.planCode})))).catch(() => undefined);
  const [plansResult, ordersResult, settlementsResult, balancesResult, rateResult, requestsResult, currencyPaymentsResult, rosterResult] = await Promise.allSettled([
    plansQuery,
    fetchRequestOrderCatalogue(),
    fetchSupplierSettlements(),
    getProcurementBalances(todayKey),
    getLatestProcurementUsdtRate(todayKey),
    plansQuery.then(rows => fetchExpenseRequestSnapshot({ from: paymentEvidenceFrom(rows, requestFrom), to: requestTo, includeHistory: true, historyConcurrency: 2 })),
    plansQuery.then((rows) => fetchSupplierCurrencyPaymentSnapshot({ from: paymentEvidenceFrom(rows, requestFrom), to: requestTo, timeoutMs: 15_000, plans: rows })),
    fetchManagerSupplierNames(user.oneCManagerName?.trim() || user.name),
  ]);
  const { plansSourceError, evidenceSourceError } = procurementSourceHealth(plansResult, requestsResult, currencyPaymentsResult);
  const allPlans = plansResult.status === "fulfilled" ? plansResult.value : [];
  const plans = allPlans.filter((plan) => plan.managerUserId === user.id);
  const source =
    ordersResult.status === "fulfilled" ? ordersResult.value : null;
  const managerName = user.oneCManagerName?.trim() || user.name;
  const managerOrders = source ? ordersForManager(source.rows, managerName) : [];
  const orders = managerOrders;
  const supplierNames = rosterResult.status === 'fulfilled' ? rosterResult.value : [];
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
      : source?.complete === false ? "SOURCE_INCOMPLETE" : "";
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
      paymentPurpose: plan.paymentPurpose,
      foreignAmount: plan.foreignAmount == null ? null : Number(plan.foreignAmount),
      managerName: plan.manager.oneCManagerName?.trim() || plan.manager.name,
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
    { allowSmallRemainder: !evidenceSourceError && !plansSourceError },
  );
  attachQrFunding(paymentEvidence,await qrFundingPromise);
  const displayEvidence = await preservePaymentEvidenceViews(allPlans, paymentEvidence,
    !evidenceSourceError && !plansSourceError, evidenceReadStartedAt, prisma.supplierPaymentPlan, new Date(), { persist: !readOnly });
  const serializedPlans = plans.map((plan) => {
    const latestSnapshot = plan.events[0]?.snapshot;
    const snapshot = latestSnapshot && typeof latestSnapshot === "object" && !Array.isArray(latestSnapshot)
      ? latestSnapshot as Record<string, unknown>
      : {};
    return {
      ...JSON.parse(JSON.stringify(plan)),
      revision: readPaymentRevision(plan.oneCCashEvidence),
      correctionReason: typeof snapshot.correctionReason === "string" ? snapshot.correctionReason : "",
      evidence: displayEvidence.get(plan.id),
    };
  });
  // Expose only the aggregate reserve of other managers, never their requests.
  const otherUsdtReserve = plansResult.status !== 'fulfilled' ? null : usdtReservedByPlans(
    allPlans.filter(plan => plan.managerUserId !== user.id).map(plan => ({
      status: plan.status, paymentMethod: plan.paymentMethod,
      fundingSource: plan.fundingSource,
      plannedAmount: Number(plan.plannedAmount),
      foreignAmount: plan.foreignAmount == null ? null : Number(plan.foreignAmount),
      evidence: paymentEvidence.get(plan.id),
    })), rateResult.status === 'fulfilled' ? rateResult.value.rate : null,
  );
  const delivery = await deliveryPromise;
  const cnyRateReference=await cnyRatePromise;
  const latest=await prisma.supplierPaymentPlan.findMany({select:{id:true,updatedAt:true}});
  if(!sameAdminPlanVersions(initialPlans,latest))return <ProcurementCalendarUpdate generation={generation} data={null}/>;
  return (
    <ProcurementCalendarUpdate generation={generation} data={{
      cargoAllowed:cargoManagerAllowed(user.oneCManagerName?.trim()||user.name),
      initialOrders:orders,initialPlans:serializedPlans,otherUsdtReserve,checkedAt:source?.checkedAt||'',
      sourceError,plansSourceError,evidenceSourceError,managerMappingError,
      supplierBalances:settlementSummary?.bySupplier||{},supplierDebtTotal:settlementSummary?.debtTotal??null,
      supplierDebtError:rosterResult.status==='rejected'||settlementsResult.status==='rejected'||settlementsResult.value.complete===false||Boolean(settlementSummary?.unsupportedCurrencyRows),
      usdtBalance,accountableBalance,usdtRateReference:rateResult.status==='fulfilled'?rateResult.value:undefined,
      cnyRateReference,todayKey,deliveryCashPanel:delivery?<ProcurementDeliveryPanel key="delivery" initial={delivery}/>:null,
    }}/>
  );
}
