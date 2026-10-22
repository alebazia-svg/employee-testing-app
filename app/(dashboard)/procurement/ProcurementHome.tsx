import {Suspense} from 'react';
import {randomUUID} from 'node:crypto';
import {readAdminPlans,sameAdminPlanVersions,type AdminPlans} from '@/lib/procurement-admin-plans';
import {buyerInitialView} from '@/lib/procurement-buyer-initial-view';
import {ProcurementCalendarStream,ProcurementCalendarUpdate} from './ProcurementCalendarStream';
import { preservePaymentEvidenceViews } from '@/lib/procurement-evidence-continuity';
import { ProcurementDeliveryPanel } from '@/components/ProcurementDeliveryPanel';
import {ProcurementDeliveryCash, type DeliveryCashSnapshot} from '@/components/ProcurementDeliveryCash';
import {readBuyerDisplay,writeBuyerDisplay} from '@/lib/procurement-buyer-display-cache';
import type {ComponentProps} from 'react';
import type Calendar from './ProcurementPaymentCalendarClient';
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
type CalendarProps=ComponentProps<typeof Calendar>;
type PlanningDisplay=Pick<CalendarProps,'initialOrders'|'supplierBalances'|'supplierDebtTotal'|'checkedAt'>;
type BalanceDisplay=Pick<CalendarProps,'usdtBalance'|'accountableBalance'>;

export async function ProcurementHome({user, readOnly = false}: {user: ProcurementUser; readOnly?: boolean}) {
  const plans=await readAdminPlans();
  const generation=randomUUID();
  const initial=buyerInitialView(plans,user.id,expenseRequestMoscowCalendarDate(new Date()),cargoManagerAllowed(user.oneCManagerName?.trim()||user.name));
  const scope=`${user.id}:${user.oneCManagerName?.trim()||user.name}`;
  const startedAt=Date.now();
  const [savedPlanning,savedBalances,savedDelivery]=await Promise.all([
    readBuyerDisplay<PlanningDisplay>(scope,'planning'),readBuyerDisplay<BalanceDisplay>(scope,'balances'),
    deliveryUserAllowed(user)?readBuyerDisplay<DeliveryCashSnapshot>(scope,'delivery'):null,
  ]);
  if(savedPlanning && Array.isArray(savedPlanning.data.initialOrders) && savedPlanning.data.supplierBalances && typeof savedPlanning.data.supplierDebtTotal==='number') {
    const {initialOrders,supplierBalances,supplierDebtTotal,checkedAt}=savedPlanning.data;
    Object.assign(initial,{initialOrders,supplierBalances,supplierDebtTotal,checkedAt,planningDisplayAvailable:true,planningDisplayAt:checkedAt});
  }
  if(savedBalances && [savedBalances.data.usdtBalance,savedBalances.data.accountableBalance].every(b=>b&&Number.isFinite(b.balance)&&Number.isFinite(Date.parse(b.checkedAt)))) {
    const {usdtBalance,accountableBalance}=savedBalances.data;
    Object.assign(initial,{usdtBalance,accountableBalance,balancesDisplayAt:usdtBalance.checkedAt});
  }
  if(deliveryUserAllowed(user)) {
    const cash=savedDelivery?.data;
    initial.deliveryCashPanel=<ProcurementDeliveryCash snapshot={cash&&Number.isFinite(cash.balance)&&Number.isFinite(Date.parse(cash.checkedAt))?{...cash,reserveAdvice:undefined}:{balance:null,checkedAt:'',lastIssue:null}} reserveDetails={false} showLastIssue={false}>
      <p className="mt-2 text-xs text-slate-500" role="status">Обновляем подотчёт…</p>
    </ProcurementDeliveryCash>;
  }
  async function Planning() {
    try {
      const manager=user.oneCManagerName?.trim()||user.name;
      const [source,settlements,names]=await Promise.all([fetchRequestOrderCatalogue(),fetchSupplierSettlements(),fetchManagerSupplierNames(manager)]);
      const summary=summarizeSupplierSettlements(settlements.rows,names);
      if(!source.complete||!settlements.complete||summary.unsupportedCurrencyRows)throw Error('INCOMPLETE');
      const orders=ordersForManager(source.rows,manager);
      const managerMappingError=Boolean(source.rows.length&&!orders.length);
      const data:PlanningDisplay={initialOrders:orders,supplierBalances:summary.bySupplier,supplierDebtTotal:summary.debtTotal,checkedAt:[source.checkedAt,settlements.checkedAt].sort()[0]};
      if(!managerMappingError&&!readOnly)await writeBuyerDisplay(scope,'planning',data,startedAt);
      return <ProcurementCalendarUpdate generation={generation} part="planning" data={{...data,sourceError:'',supplierDebtError:false,managerMappingError,planningDisplayAvailable:!managerMappingError,planningDisplayAt:data.checkedAt}}/>;
    }catch{return <ProcurementCalendarUpdate generation={generation} part="planning" data={{sourceError:'SOURCE_UNAVAILABLE',supplierDebtError:true}}/>;}
  }
  async function Balances() {
    try {
      const balances=await getProcurementBalances(initial.todayKey);
      if(balances.usdt.error||balances.accountable.error||balances.usdt.balance==null||balances.accountable.balance==null)throw Error('INCOMPLETE');
      const data={usdtBalance:balances.usdt,accountableBalance:balances.accountable};
      if(!readOnly)await writeBuyerDisplay(scope,'balances',data,startedAt);
      return <ProcurementCalendarUpdate generation={generation} part="balances" data={{...data,balancesDisplayAt:balances.usdt.checkedAt,balancesRefreshing:false,balancesUnavailable:false}}/>;
    }catch{return <ProcurementCalendarUpdate generation={generation} part="balances" data={{balancesRefreshing:false,balancesUnavailable:true}}/>;}
  }
  async function Delivery() {
    try {
      if(!deliveryUserAllowed(user))return null;
      const mapped=await deliveryMappedUser();if(mapped.id!==user.id)return null;
      const delivery=await loadDeliveryView();
      if(delivery.snapshot.balance==null)throw Error('UNAVAILABLE');
      if(!readOnly)await writeBuyerDisplay(scope,'delivery',delivery.snapshot,startedAt);
      return <ProcurementCalendarUpdate generation={generation} part="delivery" data={{deliveryCashPanel:<ProcurementDeliveryPanel initial={delivery}/>}}/>;
    }catch{
      return <ProcurementCalendarUpdate generation={generation} part="delivery" data={{deliveryCashPanel:<ProcurementDeliveryCash snapshot={savedDelivery?.data??{balance:null,checkedAt:'',lastIssue:null}} reserveDetails={false} showLastIssue={false}><p className="mt-2 text-xs text-amber-800">Не удалось обновить подотчёт. Повторите обновление.</p></ProcurementDeliveryCash>}}/>;
    }
  }
  // Keep the global matching input inside the server closure. Passing it as
  // component props also exposes it through development RSC debug payloads.
  async function Live() {
    try { return await readLive({ user, readOnly, initialPlans: plans, generation }); }
    catch { return <ProcurementCalendarUpdate generation={generation} part="evidence" data={null}/>; }
  }
  return <ProcurementCalendarStream initial={{...initial,balancesRefreshing:true}} generation={generation}>
    <Suspense fallback={null}><Planning/></Suspense>
    <Suspense fallback={null}><Balances/></Suspense>
    <Suspense fallback={null}><Delivery/></Suspense>
    <Suspense fallback={null}><Live/></Suspense>
  </ProcurementCalendarStream>;
}

async function readLive({user,initialPlans,generation,readOnly}:{user:ProcurementUser;readOnly:boolean;initialPlans:AdminPlans;generation:string}) {
  const evidenceReadStartedAt = new Date();
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
  const [plansResult, rateResult, requestsResult, currencyPaymentsResult] = await Promise.allSettled([
    plansQuery,
    getLatestProcurementUsdtRate(todayKey),
    plansQuery.then(rows => fetchExpenseRequestSnapshot({ from: paymentEvidenceFrom(rows, requestFrom), to: requestTo, includeHistory: true, historyConcurrency: 2 })),
    plansQuery.then((rows) => fetchSupplierCurrencyPaymentSnapshot({ from: paymentEvidenceFrom(rows, requestFrom), to: requestTo, timeoutMs: 15_000, plans: rows })),
  ]);
  const { plansSourceError, evidenceSourceError } = procurementSourceHealth(plansResult, requestsResult, currencyPaymentsResult);
  const allPlans = plansResult.status === "fulfilled" ? plansResult.value : [];
  const plans = allPlans.filter((plan) => plan.managerUserId === user.id);
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
  const cnyRateReference=await cnyRatePromise;
  const latest=await prisma.supplierPaymentPlan.findMany({select:{id:true,updatedAt:true}});
  if(!sameAdminPlanVersions(initialPlans,latest))return <ProcurementCalendarUpdate generation={generation} part="evidence" data={null}/>;
  return (
    <ProcurementCalendarUpdate generation={generation} part="evidence" data={{
      cargoAllowed:cargoManagerAllowed(user.oneCManagerName?.trim()||user.name),
      initialPlans:serializedPlans,otherUsdtReserve,plansSourceError,evidenceSourceError,
      usdtRateReference:rateResult.status==='fulfilled'?rateResult.value:undefined,
      cnyRateReference,todayKey,
    }}/>
  );
}
