"use client";
import {activePaymentDeferral,paymentPreparationDate,paymentScheduleLabel,paymentScheduleDetail} from '@/lib/procurement-schedule';
import {qrPaymentStage} from '@/lib/procurement-receipt-policy';
import {paymentListRemainder} from '@/lib/procurement-list-amount';
import { ProcurementCollectionNotice } from '@/components/ProcurementCollectionNotice';
import { ProcurementApprovedEdit } from '@/components/ProcurementApprovedEdit';
import { ProcurementRevisionReview } from '@/components/ProcurementRevisionReview';
import { readPaymentRevision } from '@/lib/procurement-plan-revision';
import { useAdminProcurementForecast } from '@/components/useAdminProcurementForecast';
import type { AdminForecastInput } from '@/lib/procurement-admin-forecast';
import { ProcurementAdminList } from "@/components/ProcurementAdminList";
import ProcurementFundingPlan from '@/components/ProcurementFundingPlan';
import { ProcurementAdminComment } from "@/components/ProcurementAdminComment";
import type { ReactNode } from "react";
import "./procurement-workspace.css";
import { ProcurementPaymentHistory } from "@/components/ProcurementPaymentHistory";
import { ProcurementReceipts } from '@/components/ProcurementReceipts';
import { canCollectProcurementReceipt } from '@/lib/procurement-receipt-policy';
import {supplierOnlyPaymentLabel} from '@/lib/procurement-supplier-advance';
import { useProcurementVisualPreview } from '@/components/ProcurementVisualPreview';
import { ProcurementCompletionAction } from '@/components/ProcurementCompletionAction';
import { isFinishedPaymentState } from '@/lib/procurement-small-remainder';
import { isInactivePaymentPlan, COMPLETED_WITHOUT_TOPUP } from '@/lib/procurement-payment-completion';
import { ProcurementUsdtEstimate } from "@/components/ProcurementUsdtEstimate";
import { ProcurementChangeHistory, type PlanChangeEvent } from "@/components/ProcurementChangeHistory";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  Check,
  Search,
  Undo2,
  WalletCards,
  History,
  X,
  CalendarDays,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { calculateCashPreparation, paymentPlanLeadTime } from "@/lib/procurement-payment-control";
import {fundingSourceLabel} from '@/lib/procurement-usdt-funding';
import { ProcurementDataRefresh } from "@/components/ProcurementDataRefresh";
import type { ProcurementForecastHistoryView } from "@/lib/procurement-forecast-history";
import type { ProcurementDebtAllocation } from "@/lib/procurement-debt-allocation";
import type { ProcurementCashPreparation } from "@/lib/procurement-cash-preparation";
import type { ProcurementFinancialAssistant } from "@/lib/procurement-financial-assistant";
import type { RequestFundingAssessment } from "@/lib/procurement-request-funding";
import { forecastCoverageLabel } from "@/lib/procurement-forecast-coverage";

type Plan = {
  oneCCashEvidence?: unknown;
  events?: PlanChangeEvent[];
  id: string;
  planCode: string;
  supplierPartner: string;
  supplierCounterparty: string;
  orderRefs: string[];
  orderNumbers: string[];
  paymentPurpose?: string;
  plannedDate: string;
  plannedAmount: string;
  condition: string;
  paymentMethod: string;
  currency: string;
  foreignAmount: string | null;
  fundingSource?: string|null;
  exchangeRate: string | null;
  commissionAmount: string | null;
  exchangerName: string;
  supplierConfirmation: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  correctionReason?: string;
  orderContext?: {
    number: string;
    text: string;
  }[];
  manager: { name: string };
  evidence: {
    qrFunding?: import('@/lib/procurement-qr-funding').QrFunding;
    verification?: 'current' | 'last-confirmed' | 'unavailable';
    verifiedAt?: string;
    collection?: import('@/lib/procurement-collection').ProcurementCollection;
    state: string;
    issuedAmount: number;
    actualSupplier?: string;
    paidAmount: number;
    paidForeignAmount: number;
    paymentAmountNeedsConfirmation?: boolean;
    remainingAmount: number;
    remainingForeignAmount: number | null;
    actualExchangeRate: number | null;
    cashOrders: {
      number: string;
      date: string;
      amount: number;
      cashbox: string;
    }[];
  };
};
type UsdtBalance = {
  balance: number | null;
  checkedAt: string;
  sourceLabel: string;
  error: string;
};
type UsdtRateReference = {
  rate: number | null;
  checkedAt: string;
  sourceLabel: string;
  conversionAt?: string;
};
type Forecast30Days = {
  asOf: string;
  horizonEnd: string;
  checkedAt: string;
  rows: {
    date: string;
    items: { id: string; title: string; amountMinor: number | null; source: string; certainty: "fact" | "estimate" | "unknown" }[];
    safeOutMinor: number;
    cardsOutMinor: number;
    safeBeforeMinor: number | null;
    cardsBeforeMinor: number | null;
    safeAfterMinor: number | null;
    cardsAfterMinor: number | null;
    gapMinor: number;
  }[];
  firstGap: { date: string; amountMinor: number } | null;
  safeMinor: number | null;
  cardsMinor: number | null;
  coverageReady: boolean;
  allocatedOutMinor: number;
  scheduledOutMinor: number;
  unallocatedPlanCount: number;
  tbank: {
    status: "verified" | "review" | "unavailable";
    renewsOn: string;
    freeRemainingMinor: number | null;
    tierOneRemainingMinor: number | null;
    currentRateBps: number | null;
  } | null;
  limitations: string[];
};
type SupplierWarning = {
  supplier: string;
  level: "urgent" | "attention";
  amountMinor: number;
  metric: string;
  reason: string;
  action: string;
  confidence: "current_snapshot" | "needs_review";
};
const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});
const date = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(value));
const dateKey = (value: string) => value.slice(0, 10);
const nextDayKey = (value: string) => {
  const result = new Date(`${value}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + 1);
  return result.toISOString().slice(0, 10);
};

export default function AdminProcurementClient({
  initialPlans, forecastInput, refreshState = 'ready',
  revisionReview, revisionCount = 0, paymentLinks, paymentLinkHistory,
  sourceCheckedAt,
  sourceWarnings,
  unplannedOrderCount,
  openOrderCount,
  orderPaymentGapTotal,
  unplannedCashCount,
  supplierDebtTotal,
  usdtBalance,
  accountableBalance,
  usdtRateReference,
  todayKey,
  forecastHistory: initial_forecastHistory,
  forecast30Days: initial_forecast30Days,
  supplierWarnings: initial_supplierWarnings,
  supplierWarningsReady: initial_supplierWarningsReady,
  debtAllocation: initial_debtAllocation,
  debtReserveBreakdown: initial_debtReserveBreakdown,
  cashPreparation: initial_cashPreparation,
  financialAssistant: initial_financialAssistant,
  requestFundingAssessments: initial_requestFundingAssessments,
}: {
  initialPlans: Plan[];
  refreshState?: 'loading' | 'ready' | 'error';
  forecastInput?: AdminForecastInput;
  revisionReview?: ReactNode; revisionCount?: number; paymentLinks?: ReactNode; paymentLinkHistory?: ReactNode;
  sourceCheckedAt: string;
  sourceWarnings: string[];
  unplannedOrderCount: number | null;
  openOrderCount: number | null;
  orderPaymentGapTotal: number | null;
  unplannedCashCount: number | null;
  supplierDebtTotal: number | null;
  usdtBalance: UsdtBalance;
  accountableBalance: UsdtBalance;
  usdtRateReference?: UsdtRateReference;
  todayKey: string;
  forecastHistory: ProcurementForecastHistoryView;
  forecast30Days: Forecast30Days;
  supplierWarnings: SupplierWarning[];
  supplierWarningsReady: boolean;
  debtAllocation: ProcurementDebtAllocation;
  cashPreparation: ProcurementCashPreparation;
  financialAssistant: ProcurementFinancialAssistant;
  requestFundingAssessments: RequestFundingAssessment[];
  debtReserveBreakdown: {
    salaryMinor: number | null;
    rentMinor: number;
    approvedPlansMinor: number;
  };
}) {
  const router = useRouter();
  const visualPreview = useProcurementVisualPreview();

  // Adopt new evidence in the same render as its readiness flag. An effect
  // would briefly enable actions against the previous cached plan array.
  const [localPlans, setLocalPlans] = useState({source:initialPlans,value:initialPlans});
  const plans = localPlans.source===initialPlans ? localPlans.value : initialPlans;
  const [receiptCounts,setReceiptCounts]=useState<Record<string,number>>({});
  const stage=(plan:Plan)=>qrPaymentStage(plan,receiptCounts[plan.id]??null);
  const setPlans = (update:(current:Plan[])=>Plan[]) => setLocalPlans(previous=>({
    source:initialPlans,value:update(previous.source===initialPlans?previous.value:initialPlans),
  }));
  const [tab, setTab] = useState<"pending" | "approved" | "plan" | "history">(() => visualPreview?.initialAdminTab ?? (revisionCount || initialPlans.some(p => p.status === "SUBMITTED" && p.evidence.state !== "PAID_BY_ONE_C") ? "pending" : "approved"));
  const [forecastRequested,setForecastRequested]=useState(false);
  const [rescheduleState,setRescheduleState]=useState({dirty:false,busy:false});
  const [pendingEditState,setPendingEditState]=useState<{dirty:boolean;busy:boolean;editing?:boolean}>({dirty:false,busy:false});
  const currentForecastInput=useMemo(()=>forecastInput?{...forecastInput,plansWithOrderContext:forecastInput.plansWithOrderContext.map(row=>{
    const latest=plans.find(p=>p.id===row.id);return latest?{...row,plannedDate:latest.plannedDate,oneCCashEvidence:latest.oneCCashEvidence,plannedAmount:latest.plannedAmount,foreignAmount:latest.foreignAmount,paymentMethod:latest.paymentMethod,status:latest.status}:row;
  })}:undefined,[forecastInput,plans]);
  const forecast=useAdminProcurementForecast(currentForecastInput,refreshState==='ready'&&(forecastRequested||tab==='plan'),visualPreview?.forecastReader,refreshState);
  const {forecastHistory,forecast30Days,supplierWarnings,supplierWarningsReady,debtAllocation,debtReserveBreakdown,cashPreparation,financialAssistant,requestFundingAssessments}=forecast.data??{forecastHistory: initial_forecastHistory,forecast30Days: initial_forecast30Days,supplierWarnings: initial_supplierWarnings,supplierWarningsReady: initial_supplierWarningsReady,debtAllocation: initial_debtAllocation,debtReserveBreakdown: initial_debtReserveBreakdown,cashPreparation: initial_cashPreparation,financialAssistant: initial_financialAssistant,requestFundingAssessments: initial_requestFundingAssessments};
  const fundingByPlanId = new Map(requestFundingAssessments.map((assessment) => [assessment.planId, assessment]));
  const forecastStatus=refreshState!=='ready'?<p role="status" className="text-sm text-slate-600">{refreshState==='loading'?'Проверяем оплаты и остатки в 1С…':'Свежие данные пока недоступны. Обновление повторится автоматически.'}</p>:forecastInput&&!forecast.data?<div role="status" className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">{forecast.error?<><p>Прогноз пока недоступен. Заявки и история оплат доступны.</p><button type="button" className="pam-button mt-3" onClick={forecast.retry}>Повторить загрузку</button></>:"Проверяем остатки и обязательные выплаты…"}</div>:null;
  const [busy, setBusy] = useState("");
  const [returningId, setReturningId] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [cancellingId,setCancellingId]=useState("");
  const [searchQuery,setSearchQuery]=useState("");
  const closeDecision=()=>{setReturningId("");setReturnReason("");setCancellingId("");setActionMessage("");};
  const [actionMessage, setActionMessage] = useState("");
  const active = plans.filter((plan) => !isInactivePaymentPlan(plan.status));
  const isCurrencyPaid = (plan: Plan) => plan.evidence.state === "PAID_BY_ONE_C";
  const isPaymentFinished = (plan: Plan) => isFinishedPaymentState(plan.evidence.state);
  const submitted = active.filter((plan) => plan.status === "SUBMITTED" && !isCurrencyPaid(plan));
  const completedPlans = [...active.filter((plan) => plan.status === "APPROVED" && isPaymentFinished(plan)), ...plans.filter(plan=>plan.status===COMPLETED_WITHOUT_TOPUP)];
  const receiptPlans = plans.filter(canCollectProcurementReceipt);
  const unknownPayments = active.filter(plan => plan.status === 'APPROVED' && plan.evidence.verification === 'unavailable');
  const stalePayments = active.some(plan => plan.evidence.verification === 'last-confirmed');
  const paymentTotalsUnavailable = active.some(plan => plan.evidence.verification === 'last-confirmed' || plan.evidence.verification === 'unavailable');
  const calendarPlans = active.filter((plan) => plan.status === "APPROVED" && !isPaymentFinished(plan) && plan.evidence.verification !== 'unavailable');
  const urgentSubmitted = submitted.filter((plan) => ["SAME_DAY", "LATE"].includes(paymentPlanLeadTime(plan.createdAt, plan.plannedDate).state));
  const referenceUsdtRate = Number(usdtRateReference?.rate || 0);
  const estimatedUsdtPlanIds = new Set(
    active
      .filter((plan) => !isCurrencyPaid(plan))
      .filter((plan) => plan.paymentMethod === "USDT" && !Number(plan.foreignAmount || 0) && referenceUsdtRate > 0 && Number(plan.plannedAmount) > 0)
      .map((plan) => plan.id),
  );
  const referenceRatePlanIds = new Set(
    active
      .filter((plan) => !isCurrencyPaid(plan))
      .filter((plan) => plan.paymentMethod === "USDT" && !Number(plan.exchangeRate || 0) && referenceUsdtRate > 0)
      .map((plan) => plan.id),
  );
  const rateDate = usdtRateReference?.conversionAt || "";
  const parsedRateDate = rateDate ? new Date(rateDate) : null;
  const rateDateLabel = parsedRateDate && !Number.isNaN(parsedRateDate.getTime())
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" }).format(parsedRateDate)
    : "";
  const groupedPlans = useMemo(() => {
    const ordered = [...calendarPlans].sort(
      (a, b) =>
        (paymentPreparationDate(a)||'9999-12-31').localeCompare(paymentPreparationDate(b)||'9999-12-31'),
    );
    const groups = new Map<string, Plan[]>();
    ordered.forEach((plan) => {
      const key = paymentPreparationDate(plan)||'9999-12-31';
      groups.set(key, [...(groups.get(key) || []), plan]);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [calendarPlans]);
  const preparation = calculateCashPreparation(
    (paymentTotalsUnavailable ? [] : active).map((plan) => {
      const plannedRub = Number(plan.plannedAmount);
      const remainingRub = isPaymentFinished(plan) ? 0 : Math.max(0, plannedRub - (plan.evidence.state === "MISMATCH" ? 0 : Number(plan.evidence.issuedAmount || 0) + Number(plan.evidence.paidAmount || 0)));
      const remainingRatio = plannedRub > 0 ? Math.min(1, remainingRub / plannedRub) : 0;
      const fullForeignAmount = plan.evidence.remainingForeignAmount != null && plan.evidence.state === "PARTIALLY_PAID_BY_ONE_C"
        ? plan.evidence.remainingForeignAmount
        : Number(plan.foreignAmount || 0) || (estimatedUsdtPlanIds.has(plan.id) ? plannedRub / referenceUsdtRate : 0);
      return {
        id: plan.id,
        plannedDate: paymentPreparationDate(plan)||'',
        plannedAmount: remainingRub,
        paymentMethod: plan.paymentMethod,
        fundingSource: plan.fundingSource,
        foreignAmount: plan.evidence.state === "PARTIALLY_PAID_BY_ONE_C" && plan.evidence.remainingForeignAmount != null
          ? fullForeignAmount
          : fullForeignAmount * remainingRatio,
        exchangeRate: Number(plan.exchangeRate || 0) || (referenceRatePlanIds.has(plan.id) ? referenceUsdtRate : 0),
        commissionAmount: Number(plan.commissionAmount || 0),
        issued: isPaymentFinished(plan),
      };
    }),
    usdtBalance.balance,
    todayKey,
  );
  const nextDate = preparation.rows[0]?.plannedDate.slice(0, 10);
  const nextPlans = nextDate ? preparation.rows.filter((row) => row.plannedDate.slice(0, 10) === nextDate) : [];
  const nextAmount = nextPlans.reduce((sum, row) => sum + row.cashRequired, 0);
  const nextAmountEstimated = nextPlans.some((row) => row.estimated || referenceRatePlanIds.has(row.planId));
  const nextPlanMethods = nextPlans.map((row) => active.find((plan) => plan.id === row.planId)?.paymentMethod).filter(Boolean);
  const nextPreparationLabel = nextPlanMethods.every((method) => method === "CASH") ? "Наличные из сейфа" : nextPlanMethods.every((method) => method === "CNY") ? "Наличные на обмен в юани" : nextPlanMethods.every((method) => method === "USDT") ? "Ориентир на пополнение USDT" : "Подготовка наличных";
  const plannedUsdt = preparation.plannedUsdt;
  const unknownUsdtCount = preparation.unknownUsdtCount;
  const estimatedUsdtCount = estimatedUsdtPlanIds.size;
  const usdtDeficit = paymentTotalsUnavailable ? null : preparation.usdtDeficit;
  const usdtRemainder =
    paymentTotalsUnavailable || usdtBalance.balance == null || unknownUsdtCount > 0
      ? null
      : Math.max(0, usdtBalance.balance - plannedUsdt);
  const plannedQr = (paymentTotalsUnavailable ? [] : active)
    .filter((plan) => plan.paymentMethod === "ACCOUNTABLE_QR" && dateKey(plan.plannedDate) >= todayKey && !isPaymentFinished(plan))
    .reduce((sum, plan) => sum + Math.max(0, Number(plan.plannedAmount || 0) - (plan.evidence.state === "MISMATCH" ? 0 : Number(plan.evidence.issuedAmount || 0))), 0);
  const qrShortfall = paymentTotalsUnavailable || accountableBalance.balance == null ? null : Math.max(0, plannedQr - accountableBalance.balance);
  const plannedQrLabel = paymentTotalsUnavailable ? '—' : rub.format(plannedQr);
  const plannedUsdtLabel = paymentTotalsUnavailable ? '—' : plannedUsdt > 0 ? `${estimatedUsdtCount > 0 ? '≈ ' : ''}${plannedUsdt.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} USDT` : unknownUsdtCount > 0 ? 'Уточняется' : '0 USDT';
  const groupTitle = (key: string) =>
    key < todayKey
      ? `Просрочено · ${date(key)}`
      : key === todayKey
        ? "Сегодня"
        : key === nextDayKey(todayKey)
          ? "Завтра"
          : date(key);
  const methodLabel = (plan: Plan) =>
    visualPreview?.methods?.[plan.id] ?? (plan.paymentMethod === "CNY" ? "Перевод в юанях" : plan.paymentMethod === "USDT"
      ? "Оплата в USDT"
      : plan.paymentMethod === "CASH"
        ? "Наличные"
        : plan.paymentMethod === "ACCOUNTABLE_QR"
          ? "Оплата по QR"
          : "Перевод на карту");
  const amountLabel = (plan: Plan) =>
    ["USDT","CNY"].includes(plan.paymentMethod) && Number(plan.foreignAmount || 0) > 0
      ? `${Number(plan.foreignAmount).toLocaleString("ru-RU", { maximumFractionDigits: 4 })} ${plan.paymentMethod}`
      : rub.format(Number(plan.plannedAmount));
  const estimatedUsdtForPlan = (plan: Plan) =>
    estimatedUsdtPlanIds.has(plan.id) ? Number(plan.plannedAmount) / referenceUsdtRate : 0;
  const usdtEstimateNote = (plan: Plan) => {
    const amount = estimatedUsdtForPlan(plan);
    if (!amount) return "Сумма USDT и курс уточняются";
    return `Примерно ${amount.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} USDT · последний курс ${referenceUsdtRate.toLocaleString("ru-RU")} ₽${rateDateLabel ? ` от ${rateDateLabel}` : ""} в 1С`;
  };
  const orderLabel = (plan: Plan) =>
    visualPreview?.labels?.[plan.id] ?? (plan.paymentPurpose==='DELIVERY'?'Доставка':plan.orderNumbers?.filter(Boolean).length
      ? `Заказы: ${plan.orderNumbers.filter(Boolean).join(", ")}`
      : supplierOnlyPaymentLabel(plan));
  const planComment = (plan: Plan) =>
    plan.condition && plan.condition !== "Оплата по выбранным заказам"
      ? plan.condition
      : "";
  const historyChange = forecastHistory.change;
  const newPlanChanges = historyChange?.planChanges.filter((item) => item.kind === "new") || [];
  const newPlanAmountMinor = newPlanChanges.reduce((sum, item) => sum + item.currentOutstandingMinor, 0);
  const commitmentDeltaMinor = historyChange
    ? historyChange.planOutstandingDeltaMinor + (historyChange.salaryDeltaMinor ?? 0)
    : null;
  const mainSupplierChange = historyChange ? [...historyChange.supplierChanges]
    .filter((item) => item.debtDeltaMinor !== null && item.debtDeltaMinor !== 0)
    .sort((left, right) => Math.abs(right.debtDeltaMinor || 0) - Math.abs(left.debtDeltaMinor || 0))[0]
    : undefined;
  const formatMinor = (value: number) => rub.format(Math.abs(value) / 100);
  const signedMinor = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatMinor(value)}`;
  const historyTime = (value: string) => value
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Moscow",
      }).format(new Date(value))
    : "";
  const shortDay = (value: string) => new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00.000Z`));
  const currentTbankLabel = forecast30Days.tbank?.status !== "verified"
    ? "Лимит нужно сверить"
    : forecast30Days.tbank.currentRateBps === 0
      ? `Без комиссии: ${rub.format((forecast30Days.tbank.freeRemainingMinor ?? 0) / 100)}`
      : `${(forecast30Days.tbank.currentRateBps ?? 0) / 100}% + 59 ₽`;
  const sevenDaysEnd = new Date(`${todayKey}T12:00:00.000Z`);
  sevenDaysEnd.setUTCDate(sevenDaysEnd.getUTCDate() + 6);
  const sevenDaysEndKey = sevenDaysEnd.toISOString().slice(0, 10);
  const upcomingSevenDays = forecast30Days.rows.filter((row) => row.date >= todayKey && row.date <= sevenDaysEndKey);
  const firstSupplierRecommendation = debtAllocation.recommendations.find((item) => item.recommendedMinor > 0);
  const controlledSupplierDebts = debtAllocation.debts.filter((item) => item.debtMinor >= 30_000_000);
  const supplierAllocationByName = new Map(debtAllocation.recommendations.map((item) => [item.supplier, item]));
  const firstSupplierControl = firstSupplierRecommendation ?? controlledSupplierDebts[0];
  const firstSubmittedFunding = submitted[0] ? fundingByPlanId.get(submitted[0].id) : undefined;
  const primaryDecision = submitted[0] && firstSubmittedFunding
    ? firstSubmittedFunding.state === "covered"
      ? {
          title: `Согласовать заявку ${submitted[0].supplierPartner}`,
          detail: `${amountLabel(submitted[0])} · деньги предусмотрены с учётом обязательных выплат.`,
          tone: "ready" as const,
        }
      : firstSubmittedFunding.state === "prepare"
        ? {
            title: `Согласовать после подготовки денег`,
            detail: `${submitted[0].supplierPartner} · ${firstSubmittedFunding.title}. ${firstSubmittedFunding.detail}`,
            tone: "prepare" as const,
          }
        : firstSubmittedFunding.state === "gap"
          ? {
              title: `Перенести или вернуть заявку ${submitted[0].supplierPartner}`,
              detail: `${firstSubmittedFunding.title}. ${firstSubmittedFunding.detail}`,
              tone: "gap" as const,
            }
          : {
              title: `Не принимать решение по заявке без актуальных остатков`,
              detail: `${submitted[0].supplierPartner} · ${firstSubmittedFunding.detail}`,
              tone: "prepare" as const,
            }
    : {
        title: `${financialAssistant.title}${financialAssistant.amountMinor == null ? "" : ` · ${rub.format(financialAssistant.amountMinor / 100)}`}`,
        detail: financialAssistant.explanation,
        tone: financialAssistant.state === "ready" ? "ready" as const : financialAssistant.state === "review" ? "gap" as const : "prepare" as const,
      };
  const hasImmediateAction = submitted.length > 0 || (cashPreparation.state === "ready" && ((cashPreparation.prepareMinor ?? 0) > 0 || (cashPreparation.unresolvedMinor ?? 0) > 0)) || Boolean(firstSupplierControl);
  const immediateStateUnavailable = financialAssistant.state === "unavailable";

  function openForecastDetail(targetId: string) {
    const target = document.getElementById(targetId);
    const collapsedParent = target?.closest("details");
    if (collapsedParent instanceof HTMLDetailsElement) collapsedParent.open = true;
    requestAnimationFrame(() => target?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  async function act(id: string, action: "APPROVE" | "RETURN" | "CANCEL") {
    if (visualPreview) {
      visualPreview.decide?.(id, action, returnReason);
      setActionMessage('Учебный пример: рабочие заявки не изменяются.');
      setReturningId('');
      return;
    }
    // Cancellation is confirmed in the request dialog before invoking the existing endpoint.
    if (action === "RETURN" && returnReason.trim().length < 3) {
      setActionMessage("Коротко укажите, что Астемиру нужно исправить.");
      return;
    }
    if (busy) return;
    setBusy(id);
    setActionMessage("");
    try {
    const response = await fetch(`/api/admin/procurement/payment-plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, version: plans.find(plan => plan.id === id)?.updatedAt, reason: action === "RETURN" ? returnReason : undefined }),
    });
    if (response.ok) {
      const updated = await response.json();
      setPlans((current) =>
        current.map((plan) =>
          plan.id === id ? { ...plan, ...updated } : plan,
        ),
      );
      setReturningId("");
      setReturnReason("");
      setCancellingId("");
      if (action === "APPROVE" && submitted.length === 1 && revisionCount === 0) setTab("approved");
      router.refresh();
    } else {
      const payload = await response.json().catch(() => ({}));
      setActionMessage(payload.error || "Не удалось выполнить действие.");
    }
    } catch { setActionMessage("Связь прервалась. Обновите данные перед повторным действием."); }
    finally { setBusy(""); }
  }

  return (
    <div className="procurement-calendar procurement-workspace w-full min-w-0 space-y-3">
      <nav aria-label="Разделы закупок" className="admin-section-tabs">
        {([{id:"pending",label:"На согласование",count:submitted.length+revisionCount},{id:"approved",label:"Ждут оплаты",count:calendarPlans.length},{id:"plan",label:"План и прогноз",count:null},{id:"history",label:"История оплат",count:completedPlans.length}] as const).map(item=><button key={item.id} type="button" aria-pressed={tab===item.id} onClick={()=>{setTab(item.id);if(item.id==="plan")setForecastRequested(true);setReturningId("");setReturnReason("");}} className={tab===item.id?"admin-section-tab is-active":"admin-section-tab"}>{item.label}{item.count!==null?<span className={item.id==="pending"&&item.count>0?"needs-decision":""}>{item.count}</span>:null}</button>)}
      </nav>
      {!visualPreview?.fundingPlan&&visualPreview?.toolbar}
      <div className="pam-toolbar">{tab==='plan'&&visualPreview?.fundingPlan?visualPreview.toolbar:tab!=="plan"?<label className="pam-search"><Search size={17}/><input type="search" aria-label="Найти поставщика или заказ" placeholder="Поставщик или № заказа" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/></label>:null}<ProcurementDataRefresh checkedAt={sourceCheckedAt} label={visualPreview?.fundingPlan?'Снимок':refreshState==='ready'?'Сверка оплат':'Последняя сверка оплат'} intervalMs={60_000} refreshing={refreshState==='loading'} pauseWhileDialogOpen/>{!visualPreview || visualPreview.persistedReceipts ? <ProcurementReceipts admin plans={receiptPlans} allPlans={plans} onCounts={setReceiptCounts}/> : null}</div>
      {actionMessage?<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{actionMessage}</p>:null}
      {sourceWarnings.length ? (
        <details className="order-0 group rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />Не получены данные из {sourceWarnings.length} {sourceWarnings.length === 1 ? "источника" : "источников"} 1С — рекомендации временно ограничены</span><ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" /></summary>
          <p className="mt-2 border-t border-amber-200 pt-2 text-xs font-semibold leading-relaxed">Не получены: {sourceWarnings.join(", ")}. Обновление повторится автоматически.</p>
        </details>
      ) : null}

      {!(tab==='plan'&&visualPreview?.fundingPlan)&&(refreshState==='loading'?<p role="status" className="text-sm text-slate-600">{sourceCheckedAt?'Обновляем оплаты из 1С. Пока показан результат последней подтверждённой проверки.':'Проверяем оплаты в 1С. Заявки уже доступны для просмотра.'}</p>:refreshState==='error'||stalePayments?<p role="status" className="text-sm text-slate-600">{sourceCheckedAt?'Свежие данные пока недоступны. Показан результат последней успешной проверки.':'Свежие данные пока недоступны.'} При сохранении изменений оплата проверяется отдельно. Обновление повторится автоматически.</p>:null)}
      {unknownPayments.length ? <p role="status" className="text-sm text-amber-900">Статус оплаты уточняется: {unknownPayments.map(plan => plan.supplierPartner).join(', ')}. Эти заявки не считаются неоплаченными.</p> : null}

      {tab === 'plan' && visualPreview?.fundingPlan}
      {tab === 'plan' && !visualPreview?.fundingPlan && (forecast.funding
        ? <ProcurementFundingPlan data={forecast.funding} stale={forecast.fundingStatus==='stale'} refreshing={forecast.fundingStatus==='refreshing'}/>
        : <div role="status" className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
            {forecast.error || refreshState==='error' ? 'Не удалось обновить расчёт. Повторим автоматически.' : 'Подбираем источники денег по остаткам и заявкам…'}
          </div>)}
      <section hidden={tab !== "pending"} className="space-y-4">
        {revisionReview || <ProcurementRevisionReview items={plans.flatMap(plan=>{const revision=readPaymentRevision(plan.oneCCashEvidence);return revision?[{id:plan.id,supplierPartner:plan.supplierPartner,revision}]:[];})}/>}
        <ProcurementAdminList  onOpen={()=>setForecastRequested(true)} key="pending" searchQuery={searchQuery} dirty={!!returnReason.trim()||pendingEditState.dirty} busy={!!busy||pendingEditState.busy} onClose={closeDecision} error={actionMessage}
          renderFooter={(id,close)=>pendingEditState.editing?<button type="button" className="pam-button" disabled={pendingEditState.busy} onClick={close}>Закрыть</button>:returningId===id?<><button type="button" className="pam-button" disabled={!!busy} onClick={close}>Отмена</button><button type="button" className="pam-button pam-primary" disabled={!!busy||returnReason.trim().length<3} onClick={()=>act(id,"RETURN")}>{busy===id?"Сохраняем…":"Вернуть Астемиру"}</button></>:cancellingId===id?<><button type="button" className="pam-button" disabled={!!busy} onClick={()=>setCancellingId("")}>Назад</button><button type="button" className="pam-button pam-primary" disabled={!!busy} onClick={()=>act(id,"CANCEL")}>{busy===id?"Сохраняем…":"Отменить заявку"}</button></>:<><button type="button" className="pam-cancel" disabled={!!busy} onClick={()=>{setCancellingId(id);setActionMessage("");}}>Отменить заявку</button><button type="button" className="pam-button" disabled={!!busy} onClick={()=>{setReturningId(id);setReturnReason("");setActionMessage("");}}><Undo2 size={16}/>Вернуть на исправление</button><button type="button" className="pam-button pam-primary" disabled={!!busy} onClick={()=>act(id,"APPROVE")}><Check size={18}/>{busy===id?"Сохраняем…":"Согласовать"}</button></>}
          items={[...submitted].sort((a,b)=>(paymentPreparationDate(a)||'9999-12-31').localeCompare(paymentPreparationDate(b)||'9999-12-31')).map(plan=>{const day=paymentPreparationDate(plan);return {id:plan.id,name:plan.supplierPartner,amount:amountLabel(plan),meta:day?date(day):'Дата уточняется',dateLabel:day?date(day):'Дата уточняется',warning:paymentScheduleLabel(plan),basis:orderLabel(plan),method:methodLabel(plan),search:plan.orderNumbers.join(" "),priority:day&&day<todayKey?"overdue":day===todayKey?"today":"later",group:!day?'Дата уточняется':day<todayKey?"Срок прошёл":day===todayKey?"Сегодня":day===nextDayKey(todayKey)?"Завтра":"Предстоящие"};})}
          empty="Новых заявок на согласование нет." renderDetail={id=>{
          const plan=submitted.find(p=>p.id===id)!;const funding=fundingByPlanId.get(plan.id);
          if(returningId===id)return <div className="pam-return"><h3>{plan.supplierPartner}</h3><label>Что исправить<textarea autoFocus value={returnReason} onChange={e=>setReturnReason(e.target.value)} maxLength={300} rows={4} placeholder="Укажите, что нужно изменить в заявке"/></label><p>Астемир увидит пояснение и сможет изменить заявку.</p></div>;
          if(cancellingId===id)return <div className="pam-return"><h3>Отменить заявку?</h3><p>{plan.supplierPartner} · {amountLabel(plan)}</p><p>Заявка исчезнет из рабочего календаря. Документы 1С не изменятся.</p></div>;
          return (<article id={`payment-plan-${plan.id}`} key={plan.id} className="procurement-detail">
              <div className="pam-identity"><div><h3>{plan.supplierPartner}</h3><p>{orderLabel(plan)}</p></div><span className="pam-state">Ждёт решения</span></div>
              <div className="pam-key-info"><div><span>Сумма заявки</span><strong>{amountLabel(plan)}</strong>{plan.paymentMethod==="USDT"&&!visualPreview?.hideRubleEstimate?<small>{Number(plan.foreignAmount||0)>0?`Ориентир: ${rub.format(Number(plan.plannedAmount))}`:usdtEstimateNote(plan)}</small>:null}</div><div><span>{activePaymentDeferral(plan)?paymentScheduleLabel(plan):dateKey(plan.plannedDate)<todayKey?"Срок прошёл":dateKey(plan.plannedDate)===todayKey?"Подготовить сегодня":"Подготовить к"}</span><strong>{paymentPreparationDate(plan)?date(paymentPreparationDate(plan)!):'Дата уточняется'}</strong></div></div>
              <ProcurementApprovedEdit plan={plan} today={todayKey} beforeApproval disabled={!!busy} pending={!!readPaymentRevision(plan.oneCCashEvidence)} onStateChange={setPendingEditState} onSaved={saved=>setPlans(current=>current.map(row=>row.id===saved.id?{...row,...saved}:row))}/>
              <dl className="pam-payment-method"><dt>Способ оплаты</dt><dd>{methodLabel(plan)}</dd></dl>
              {!activePaymentDeferral(plan)&&["SAME_DAY","LATE"].includes(paymentPlanLeadTime(plan.createdAt,plan.plannedDate).state)?<p className="mb-3 text-sm font-semibold text-red-800">{paymentPlanLeadTime(plan.createdAt,plan.plannedDate).state==="SAME_DAY"?"Заявка внесена в день оплаты":"Дата оплаты уже прошла"}</p>:null}
              {forecastStatus}
              {!forecastStatus && funding ? <div className={`mt-3 rounded-xl border px-3.5 py-3 ${funding.state === "covered" ? "border-green-200 bg-green-50/70" : funding.state === "gap" ? "border-red-200 bg-red-50/70" : funding.state === "prepare" ? "border-amber-200 bg-amber-50/70" : "border-slate-200 bg-slate-50"}`}><div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><div><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Если согласовать</p><p className={`mt-0.5 text-sm font-black ${funding.state === "covered" ? "text-green-900" : funding.state === "gap" ? "text-red-900" : funding.state === "prepare" ? "text-amber-950" : "text-slate-800"}`}>{funding.title}</p></div><p className="max-w-xl text-xs font-semibold leading-relaxed text-slate-600 sm:text-right">{funding.detail}</p></div>{funding.steps.length ? <div className="mt-2 flex flex-wrap gap-1.5 border-t border-black/5 pt-2">{funding.steps.map((step) => <span key={step.source} className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-black/5">{step.source === "vtb" ? "ВТБ" : step.source === "tbank_card" ? "Карта Т‑Банка" : step.source === "tbank_account" ? "Счёт → карта Т‑Банка" : "Сейф"}: {rub.format(step.amountMinor / 100)}</span>)}</div> : null}</div> : null}
              <ProcurementAdminComment value={planComment(plan)} />
              {plan.supplierConfirmation ? <p className="mt-2 whitespace-pre-wrap break-words text-sm">{plan.supplierConfirmation}</p> : null}
              {plan.paymentMethod==='USDT'&&plan.fundingSource?<p className="mt-2 text-sm font-semibold">{fundingSourceLabel(plan.fundingSource)}</p>:null}
              {plan.exchangeRate ? <p className="mt-2 text-xs text-slate-500">Плановый курс: {Number(plan.exchangeRate).toLocaleString('ru-RU')} ₽ / {plan.paymentMethod==='CNY'?'CNY':'USDT'}</p> : null}
              {plan.paymentMethod==='CNY'?<p className="mt-2 text-sm font-semibold text-[#785537]">Подготовить наличными: ≈ {rub.format(Number(plan.plannedAmount))}</p>:null}
              {plan.orderContext?.length ? (
                <details className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <summary className="cursor-pointer font-bold text-slate-600">
                    Данные из {plan.orderContext.length === 1 ? "заказа" : `${plan.orderContext.length} заказов`} в 1С
                  </summary>
                  <div className="mt-2 space-y-1.5 border-t border-slate-200 pt-2">
                    {plan.orderContext.map((item, index) => (
                      <p key={`${item.number}-${index}`} className="text-slate-700">
                        <span className="font-bold">№ {item.number}:</span>{" "}
                        {item.text}
                      </p>
                    ))}
                  </div>
                </details>
              ) : null}
              {visualPreview?.detail?<div>{visualPreview.detail(plan.id)}</div>:null}
              {!visualPreview||visualPreview.persistedReceipts?<ProcurementReceipts admin plans={[plan]} single hideEmptyBeforePayment/>:null}
            </article>);
        }}/>
      </section>
      <section hidden={tab !== "approved"} className="space-y-4">
        <div className="procurement-payment-priorities" aria-label="Сроки согласованных оплат">
          <span><strong>Согласованные оплаты</strong></span>
          <span data-priority="overdue" data-active={calendarPlans.some(plan=>!stage(plan)&&(paymentPreparationDate(plan)||'9999-12-31')<todayKey)}>Просрочено: <strong>{calendarPlans.filter(plan=>!stage(plan)&&(paymentPreparationDate(plan)||'9999-12-31')<todayKey).length}</strong></span>
          <span data-priority="today">Сегодня: <strong>{calendarPlans.filter(plan=>paymentPreparationDate(plan)===todayKey).length}</strong></span>
          <span data-priority="tomorrow">Завтра: <strong>{calendarPlans.filter(plan=>paymentPreparationDate(plan)===nextDayKey(todayKey)).length}</strong></span>
        </div>
<ProcurementAdminList key="approved" dirty={rescheduleState.dirty} busy={rescheduleState.busy} searchQuery={searchQuery} items={groupedPlans.flatMap(([,rows])=>rows).map(plan=>{
 const day=paymentPreparationDate(plan), sortDay=day||'9999-12-31';
 return {id:plan.id,name:plan.supplierPartner,amount:paymentListRemainder(plan)?.replace(/^Доплатить /,'')||amountLabel(plan),amountCaption:paymentListRemainder(plan)?'Доплатить':undefined,meta:day?date(day):'Дата уточняется',dateLabel:day?date(day):'Дата уточняется',basis:orderLabel(plan),method:methodLabel(plan),priority:!stage(plan)&&sortDay<todayKey?'overdue' as const:day===todayKey?'today' as const:'later' as const,search:plan.orderNumbers.join(' '),group:stage(plan)?'Оплаты по QR':!day?'Дата уточняется':day<todayKey?'Просрочено':day===todayKey?'Сегодня':day===nextDayKey(todayKey)?'Завтра':'Далее',warning:plan.evidence.paymentAmountNeedsConfirmation?'Проверьте найденную оплату':plan.evidence.state==='MISMATCH'?'Расхождение с 1С':stage(plan)||paymentScheduleLabel(plan)||(['PARTIALLY_ISSUED','PARTIALLY_PAID_BY_ONE_C'].includes(plan.evidence.state)?'Частично оплачено':plan.evidence.state==='NO_EVIDENCE'&&day&&day>=todayKey&&!plan.evidence.collection?'Деньги будут готовы':undefined)};
 })} empty={unknownPayments.length ? "Статус оплат уточняется. Дождитесь обновления." : "Оплат в ожидании нет."} renderDetail={id=>{
          const plan=calendarPlans.find(p=>p.id===id)!;
          const deferred=activePaymentDeferral(plan);
          const deadline = paymentPreparationDate(plan)||'9999-12-31';
          const priority = stage(plan)?'later':deadline < todayKey ? "overdue" : deadline === todayKey ? "today" : deadline === nextDayKey(todayKey) ? "tomorrow" : "later";
          const needsCheck = plan.evidence.paymentAmountNeedsConfirmation || plan.evidence.state === "MISMATCH" || ["PARTIALLY_ISSUED", "PARTIALLY_PAID_BY_ONE_C"].includes(plan.evidence.state);
          return (<><div className="procurement-payment-deadline" data-priority={priority}>
            <div className="flex items-center gap-2">{priority === "overdue" ? <AlertTriangle className="h-5 w-5 shrink-0"/> : <CalendarDays className="h-5 w-5 shrink-0"/>}<strong>{stage(plan)||paymentScheduleLabel(plan)|| (priority === "overdue" ? "Срок оплаты прошёл" : priority === "today" ? "Оплата сегодня" : priority === "tomorrow" ? "Оплата завтра" : "Предстоящая оплата")}</strong></div>
            <p>{stage(plan)?stage(plan)==='Ожидает чека'?'Деньги переданы в подотчёт. После оплаты Астемир добавит чек.':'Чек добавлен. Оформите оплату поставщику в 1С.':<>{deferred?paymentScheduleDetail(plan):date(plan.plannedDate)} · {refreshState!=='ready' ? "Статус оплаты уточняется" : plan.evidence.collection ? "Выдача из кассы назначена" : needsCheck ? "Проверьте найденную оплату и остаток" : deferred ? (deferred.comment||'Согласование сохраняется') : priority === "overdue" ? "Проверьте оплату — срок уже прошёл" : priority === "today" ? "Подготовьте деньги к оплате сегодня" : priority === "tomorrow" ? "Подготовьте деньги заранее" : "Подготовьте деньги к указанной дате"}</>}</p>
            {deferred?<p>В заявке: подготовить к {date(plan.plannedDate)}</p>:null}
            {plan.evidence.qrFunding?.lastConfirmed?<p>Перемещение: последняя проверка {new Date(plan.evidence.qrFunding.checkedAt).toLocaleString('ru-RU')}. Обновление пока не подтверждено.</p>:null}
          </div><article key={plan.id} data-confirmed-only={!needsCheck} className="procurement-detail procurement-approved-detail">
                    {plan.evidence.paymentAmountNeedsConfirmation ? <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900 sm:col-span-4">Оплата найдена: {plan.evidence.paidForeignAmount.toLocaleString('ru-RU')} USDT. Рублёвый эквивалент не подтверждён — проверьте выполнение заявки перед повторной оплатой.</p> : null}
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-950">{plan.supplierPartner}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${plan.evidence.state === "MISMATCH" ? "bg-red-100 text-red-800" : plan.evidence.state === "PARTIALLY_PAID_BY_ONE_C" ? "bg-blue-100 text-blue-800" : plan.evidence.state === "ISSUED_BY_ONE_C" ? "bg-blue-100 text-blue-800" : plan.evidence.state === "PARTIALLY_ISSUED" ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-800"}`}>{plan.evidence.state === "MISMATCH" ? "НЕ СОВПАДАЕТ С 1С" : plan.evidence.state === "ISSUED_BY_ONE_C" ? "ОПЛАЧЕНО ПО 1С" : plan.evidence.state === "PARTIALLY_PAID_BY_ONE_C" ? "ЧАСТИЧНО ОПЛАЧЕНО" : plan.evidence.state === "PARTIALLY_ISSUED" ? "ЧАСТИЧНО ПО 1С" : "СОГЛАСОВАНО"}</span></div><p className="mt-0.5 text-xs font-semibold leading-relaxed text-slate-500">{orderLabel(plan)}</p>{plan.evidence.state === "MISMATCH" ? <p className="mt-1 text-xs font-black text-red-700">В заявке: {plan.supplierPartner} · в 1С: {plan.evidence.actualSupplier || "другой поставщик"}</p> : plan.evidence.state === "PARTIALLY_ISSUED" ? <p className="mt-1 text-xs font-bold text-amber-800">По 1С оплачено {rub.format(plan.evidence.issuedAmount)} из {rub.format(Number(plan.plannedAmount))}</p> : plan.evidence.state === "PARTIALLY_PAID_BY_ONE_C" ? <p className="mt-1 text-xs font-bold text-blue-800">Оплачено {plan.evidence.paidForeignAmount.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT · осталось {plan.evidence.remainingForeignAmount != null ? `${plan.evidence.remainingForeignAmount.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT` : rub.format(plan.evidence.remainingAmount)}</p> : null}</div>
                    <ProcurementApprovedEdit plan={plan} today={todayKey} pending={!!readPaymentRevision(plan.oneCCashEvidence)} disabled={plan.evidence.verification==='current'&&['MISMATCH','NEEDS_REVIEW'].includes(plan.evidence.state)} onStateChange={setRescheduleState} onSaved={saved=>setPlans(current=>current.map(row=>row.id===saved.id?{...row,...saved}:row))}/>
                    <div><p className="text-xs font-bold text-slate-500">Сумма заявки</p><p className="mt-0.5 font-extrabold text-slate-950">{amountLabel(plan)}</p>{plan.paymentMethod === "USDT" && !Number(plan.foreignAmount || 0) ? <ProcurementUsdtEstimate amount={Number(plan.plannedAmount)} rate={usdtRateReference?.rate} conversionAt={usdtRateReference?.conversionAt} /> : null}</div>
                    <div><p className="text-xs font-bold text-slate-400">Способ</p><p className="mt-0.5 font-extrabold text-slate-800">{methodLabel(plan)}</p></div>
                    <div className="text-left sm:text-right"><p className="text-xs font-bold text-slate-400">Ответственный</p><p className="mt-0.5 text-sm font-extrabold text-slate-700">{plan.manager.name}</p></div>
                    {refreshState==='ready'&&plan.evidence.verification!=='last-confirmed'&&['PARTIALLY_ISSUED','PARTIALLY_PAID_BY_ONE_C'].includes(plan.evidence.state)&&!plan.evidence.paymentAmountNeedsConfirmation?<div className="procurement-completion-section flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                      <div>{!(plan.evidence.state==='PARTIALLY_PAID_BY_ONE_C'&&plan.evidence.remainingForeignAmount!=null)?<p className="text-sm font-semibold">Осталось по заявке: {rub.format(plan.evidence.remainingAmount)}</p>:null}<p className="text-xs text-slate-500">Если доплачивать не нужно, завершите заявку.</p></div>
                      <ProcurementCompletionAction id={plan.id} supplier={plan.supplierPartner} disabled={rescheduleState.busy||rescheduleState.dirty}/>
                    </div>:null}
                    <ProcurementCollectionNotice collection={plan.evidence.collection} today={todayKey} />
                    <div className="procurement-comment-section"><ProcurementAdminComment value={planComment(plan)} /></div>
                    <div className="sm:col-span-4"><ProcurementChangeHistory events={plan.events} /></div>
                    {visualPreview?.detail ? <div className="sm:col-span-4">{visualPreview.detail(plan.id)}</div> : null}
                    {!visualPreview || visualPreview.persistedReceipts ? <div className="sm:col-span-4"><ProcurementReceipts admin plans={[plan]} single/></div> : null}
                  </article></>);
        }}/>
        {paymentLinks}
      </section>
      <section hidden={tab !== "history"} className="space-y-4">
        <ProcurementPaymentHistory plans={completedPlans} showManager splitView adminDialogs searchQuery={searchQuery}/>
        {paymentLinkHistory}
      </section>
    </div>
  );
}
