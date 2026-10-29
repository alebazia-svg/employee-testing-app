"use client";
import {ProcurementMobilePresentation,ProcurementMobileReceiptEntry} from '@/components/ProcurementMobilePresentation';
import {activePaymentDeferral,paymentPreparationDate,paymentScheduleLabel,paymentScheduleDetail} from '@/lib/procurement-schedule';
import {canCollectQrReceiptBeforePayment,qrPaymentStage} from '@/lib/procurement-receipt-policy';
import {paymentListRemainder} from '@/lib/procurement-list-amount';
import {onlyPaymentDateChanged} from '@/lib/procurement-schedule';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';
import { ProcurementPaymentDebtSummary } from '@/components/ProcurementPaymentDebtSummary';
import { ProcurementCnyFields } from '@/components/ProcurementCnyFields';
import { ProcurementUsdtFields } from '@/components/ProcurementUsdtFields';
import {fundingSourceLabel} from '@/lib/procurement-usdt-funding';
import { cnyCommentDraftPatch, cnyRateFromComment, plannedFxRubles,type PlannedRateReference } from '@/lib/procurement-planned-fx';
import { isFinishedPaymentState } from '@/lib/procurement-small-remainder';
import { ProcurementCollectionNotice } from '@/components/ProcurementCollectionNotice';
import { buyerOrderPurpose, supplierPosition, supplierPositionSummary } from '@/lib/procurement-supplier-position';
import { ProcurementPaymentHistory } from "@/components/ProcurementPaymentHistory";
import { ProcurementReceipts } from '@/components/ProcurementReceipts';
import { canCollectProcurementReceipt } from '@/lib/procurement-receipt-policy';
import {supplierOnlyPaymentLabel, SUPPLIER_ADVANCE} from '@/lib/procurement-supplier-advance';
import { useProcurementVisualPreview } from '@/components/ProcurementVisualPreview';
import { ProcurementDeliveryCash, type DeliveryCashSnapshot } from '@/components/ProcurementDeliveryCash';
import { isInactivePaymentPlan, COMPLETED_WITHOUT_TOPUP } from '@/lib/procurement-payment-completion';
import { ProcurementDiscardDraftDialog } from '@/components/ProcurementDiscardDraftDialog';
import { ProcurementPaymentDialog } from '@/components/ProcurementPaymentDialog';
import { usdtReservedByPlans } from "@/lib/procurement-usdt-reserve";
import { ProcurementUsdtEstimate } from "@/components/ProcurementUsdtEstimate";
import type { PaymentRevision } from "@/lib/procurement-plan-revision";
import { ProcurementChangeHistory, type PlanChangeEvent } from "@/components/ProcurementChangeHistory";
import { useRouter } from "next/navigation";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buyerPaymentComment } from '@/lib/procurement-buyer-comment';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { ProcurementPaymentForm } from "./ProcurementPaymentForm";
import { calculateOrderPlanning, paymentPlanLeadTime } from "@/lib/procurement-payment-control";
import type { SupplierBalance } from "@/lib/procurement-supplier-settlements";
import { ProcurementDataRefresh } from "@/components/ProcurementDataRefresh";
import { buildProcurementReviewQueue, ordersForNewPayment, paymentActionPriority, MIN_SUGGESTED_PAYMENT_RUB, matchesPaymentOrderSearch, sortPaymentPickerOrders } from "@/lib/procurement-payment-priority";
import { procurementOrderCommentText } from "@/lib/procurement-order-comment";
import { procurementWorkingOrders } from "@/lib/procurement-working-orders";
import { ordersForRequest } from '@/lib/procurement-order-selection';
import { isBuyerPaymentHistory, orderMissingAmountLabel } from '@/lib/procurement-payment-priority';

type Order = {
  receiptSettlement?: import('@/lib/procurement-planning-verification').OrderReceiptSettlement;
  noAcquisitions?: { checkedAt: string };
  outstandingAcquisitions?: { checkedAt: string };
  paymentClosure?: import('@/lib/procurement-order-payment-closure').OrderPaymentClosure;
  planningState?: string;
  planningReason?: string;
  ref: string;
  number: string;
  date: string;
  supplierPartner: string;
  supplierCounterparty: string;
  amount: number;
  receiptAmount: number;
  paymentAmount: number;
  orderPaymentGap: number;
  supplierDebt: number;
  currentState: string;
  controlGroup: string;
  controlReason: string;
  orderComment: string;
};
type Plan = {
  fundingSource?: string|null;
  paymentPurpose?: string;
  oneCCashEvidence?: unknown;
  id: string;
  planCode: string;
  supplierPartner: string;
  supplierCounterparty: string;
  orderRefs: string[];
  orderNumbers: string[];
  plannedDate: string;
  plannedAmount: string;
  condition: string;
  paymentMethod: string;
  currency: string;
  foreignAmount: string | null;
  exchangeRate: string | null;
  commissionAmount: string | null;
  exchangerName: string;
  supplierConfirmation: string;
  status: string;
  createdAt: string;
  correctionReason?: string;
  updatedAt: string;
  revision?: PaymentRevision | null;
  events?: PlanChangeEvent[];
  evidence?: {
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
    manualPaymentCount?: number;
    cashOrders?: { ref: string; number: string; date?: string }[];
    currencyPayments?: { ref: string; number: string; date: string }[];
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
type Draft = {
  fundingSource: string;
  supplier: string;
  orderRefs: string[];
  plannedDate: string;
  plannedAmount: string;
  condition: string;
  paymentMethod: string;
  foreignAmount: string;
  exchangeRate: string;
  commissionAmount: string;
  exchangerName: string;
  supplierConfirmation: string;
};
const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function OrderComment({ value }: { value: string }) {
  const comment = procurementOrderCommentText(value);
  if (!comment) return null;
  return <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-600" title={comment}>Комментарий из 1С: {comment}</p>;
}
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(value));
const orderDateLabel = (value: string) => {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (match) return `${match[1]}.${match[2]}.${match[3]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "дата не указана" : dateLabel(value);
};
const orderCountLabel = (count: number) => {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const word = mod100 >= 11 && mod100 <= 14
    ? "заказов"
    : mod10 === 1
      ? "заказ"
      : mod10 >= 2 && mod10 <= 4
        ? "заказа"
        : "заказов";
  return `${count} ${word}`;
};
const dateKey = (value: string) => value.slice(0, 10);
const nextDayKey = (value: string) => {
  const result = new Date(`${value}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + 1);
  return result.toISOString().slice(0, 10);
};
const emptyDraft = (): Draft => ({
  fundingSource: '',
  supplier: "",
  orderRefs: [],
  plannedDate: "",
  plannedAmount: "",
  condition: "",
  paymentMethod: "CASH",
  foreignAmount: "",
  exchangeRate: "",
  commissionAmount: "",
  exchangerName: "",
  supplierConfirmation: "",
});
const methodLabel = (method: string) =>
  method === "CNY" ? "Перевод в юанях" : method === "USDT"
    ? "Оплата в USDT"
    : method === "CASH"
      ? "Наличные"
      : method === "ACCOUNTABLE_QR"
        ? "Оплата поставщику по QR"
        : "Перевод на карту";
const commentHint = (method: string) =>
  method === "USDT"
    ? "Например: курс уточняется"
    : method === "ACCOUNTABLE_QR"
      ? "Например: QR пришлют после 15:00"
      : method === "BANK"
        ? "Например: реквизиты пришлют завтра"
        : "Например: 42 112 юаней по курсу 13,55 ₽";
const leadTimeLabel = (plan: Plan) => {
  const timing = paymentPlanLeadTime(plan.createdAt, plan.plannedDate);
  if (timing.state === "SAME_DAY") return "Внесено в день подготовки денег";
  if (timing.state === "NEXT_DAY") return "Внесено за день";
  if (timing.state === "LATE") return "Внесено после даты подготовки";
  return timing.days == null ? "" : `Внесено заранее · за ${timing.days} дн.`;
};

export default function ProcurementPaymentCalendarClient({
  initialOrders,
  initialPlans,
  checkedAt,
  sourceError,
  sourceRefreshing = false,
  planningDisplayAvailable = false,
  planningDisplayAt = '',
  balancesDisplayAt = '',
  balancesRefreshing = false,
  balancesUnavailable = false,
  plansSourceError = false,
  evidenceSourceError,
  managerMappingError,
  supplierBalances,
  supplierDebtTotal,
  supplierDebtError,
  usdtBalance,
  accountableBalance,
  deliveryCash,
  deliveryCashPanel,
  cargoAllowed = false,
  usdtRateReference,
  cnyRateReference,
  todayKey,
  basisPreview = false,
  readOnlyPreview,
  otherUsdtReserve = null,
}: {
  initialOrders: Order[];
  initialPlans: Plan[];
  checkedAt: string;
  sourceError: string;
  sourceRefreshing?: boolean;
  planningDisplayAvailable?: boolean;
  planningDisplayAt?: string;
  balancesDisplayAt?: string;
  balancesRefreshing?: boolean;
  balancesUnavailable?: boolean;
  plansSourceError?: boolean;
  evidenceSourceError: boolean;
  managerMappingError: boolean;
  supplierBalances: Record<string, SupplierBalance>;
  supplierDebtTotal: number | null;
  supplierDebtError: boolean;
  usdtBalance: UsdtBalance;
  accountableBalance: UsdtBalance;
  deliveryCash?: DeliveryCashSnapshot;
  deliveryCashPanel?: React.ReactNode;
  cargoAllowed?: boolean;
  usdtRateReference?: UsdtRateReference;
  cnyRateReference?: PlannedRateReference;
  todayKey: string;
  basisPreview?: boolean;
  /** Local screen snapshot only; never supplied by the production page. */
  readOnlyPreview?: { compact: boolean; supplierCount: number; debtTotal: number | null };
  otherUsdtReserve?: number | null;
}) {
  const preview = useEmployeePreview();
  const [paymentView, setPaymentView] = useState<'current' | 'accountable' | 'history'>('current');
  const [mobile,setMobile]=useState(false);
  const [actionTarget,setActionTarget]=useState<HTMLDivElement|null>(null);
  const openAccountable=useCallback(()=>{setPaymentView('accountable');requestAnimationFrame(()=>document.getElementById('delivery')?.scrollIntoView({block:'nearest'}));},[]);
  useEffect(()=>{
    const query=window.matchMedia('(max-width: 767px)');
    const update=()=>{setMobile(query.matches);if(!query.matches)setPaymentView(value=>value==='accountable'?'current':value);};
    const navigate=()=>{if(!query.matches)return;const view=new URLSearchParams(window.location.search).get('view');if(window.location.hash==='#delivery'||view==='accountable')openAccountable();else if(view==='history')setPaymentView('history');};
    update();navigate();query.addEventListener('change',update);window.addEventListener('hashchange',navigate);window.addEventListener('popstate',navigate);
    const showAccountable=()=>{if(query.matches)openAccountable();};
    window.addEventListener('mobo:procurement-accountable',showAccountable);
    return()=>{query.removeEventListener('change',update);window.removeEventListener('hashchange',navigate);window.removeEventListener('popstate',navigate);window.removeEventListener('mobo:procurement-accountable',showAccountable);};
  },[openAccountable]);
  const mobilePresentation=useMemo(()=>mobile?{target:actionTarget,openAccountable}:null,[mobile,actionTarget,openAccountable]);
  const visualPreview = useProcurementVisualPreview();
  const compact = readOnlyPreview?.compact ?? true;
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState(initialPlans);
  const [receiptCounts,setReceiptCounts]=useState<Record<string,number>>({});
  const [receiptLoadState,setReceiptLoadState]=useState<'loading'|'ready'|'error'>('loading');
  const stage=(plan:Plan)=>qrPaymentStage(plan,receiptCounts[plan.id]??null);
  const receiptStageUnknown=(plan:Plan)=>mobile&&process.env.NEXT_PUBLIC_PROCUREMENT_RECEIPTS_ENABLED==='1'&&canCollectQrReceiptBeforePayment(plan)&&receiptCounts[plan.id]===undefined;
  const visibleStage=(plan:Plan)=>stage(plan)||(receiptStageUnknown(plan)?(receiptLoadState==='error'?'Статус чеков недоступен':'Проверяем чеки…'):'');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editingVersion, setEditingVersion] = useState<string | undefined>();
  const router = useRouter();
  const [changeReason, setChangeReason] = useState("");
  const [batchSeedRefs, setBatchSeedRefs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [paymentCreated, setPaymentCreated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAllReviewOrders, setShowAllReviewOrders] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [batchDraftState, setBatchDraftState] = useState({ hasDraft: false, saving: false });
  const [originalEditDraft, setOriginalEditDraft] = useState<Draft | null>(null);
  const [editBasis, setEditBasis] = useState<'ORDER' | 'DEBT'>('ORDER');
  const [editOrderRefs, setEditOrderRefs] = useState<string[]>([]);
  const [editOrderQuery, setEditOrderQuery] = useState('');
  const editingPlan = plans.find(plan => plan.id === editingId);
  const editHasPayment = Number(editingPlan?.evidence?.issuedAmount) > 0 || Number(editingPlan?.evidence?.paidAmount) > 0 || Number(editingPlan?.evidence?.paidForeignAmount) > 0;
  const editBasisLocked = !editingPlan?.evidence || editingPlan.evidence.state !== 'NO_EVIDENCE'
    || editHasPayment;
  useEffect(() => setPlans(initialPlans), [initialPlans]);
  const referenceUsdtRate = Number(usdtRateReference?.rate || 0);
  const previousCommentRate = useRef<number|null>(null);
  const paymentFormOpener = useRef<HTMLElement|null>(null);

  const suppliers = useMemo(
    () =>
      [
        ...new Set(
          initialOrders.map((order) => order.supplierPartner).filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "ru")),
    [initialOrders],
  );
  const supplierOrders = initialOrders.filter(
    (order) => order.supplierPartner === draft.supplier,
  );
  const activePlans = (plansSourceError ? [] : plans).filter((plan) => !isInactivePaymentPlan(plan.status));
  const unverifiedPaymentView = activePlans.some(plan => plan.evidence?.verification === 'last-confirmed' || plan.evidence?.verification === 'unavailable');
  const isCurrencyPaid = (plan: Plan) => plan.evidence?.state === "PAID_BY_ONE_C";
  const isPaymentFinished = (plan: Plan) => isFinishedPaymentState(plan.evidence?.state);
  const paidPlans = [...activePlans.filter(isPaymentFinished), ...plans.filter(plan=>plan.status===COMPLETED_WITHOUT_TOPUP)];
  const receiptPlans = plans.filter(canCollectProcurementReceipt);
  const unknownPayments = activePlans.filter(plan => plan.status === 'APPROVED' && plan.evidence?.verification === 'unavailable');
  const workingPlans = activePlans.filter(plan => !isPaymentFinished(plan) && (plan.status !== 'APPROVED' || plan.evidence?.verification !== 'unavailable'));
  const planningOrders = calculateOrderPlanning(
    initialOrders,
    workingPlans.map((plan) => ({
      orderRefs: plan.orderRefs,
      plannedAmount: Number(plan.plannedAmount),
      status: plan.status,
      issuedAmount: plan.evidence?.state === "MISMATCH" ? 0 : Number(plan.evidence?.issuedAmount || 0) + Number(plan.evidence?.paidAmount || 0),
    })),
  );
  const missingOrders = ordersForNewPayment(planningOrders);
  const editableOrders = sortPaymentPickerOrders(planningOrders.filter(order => order.supplierPartner === draft.supplier &&
    (draft.orderRefs.includes(order.ref) || ['order', 'prepayment'].includes(buyerOrderPurpose(order, supplierBalances[draft.supplier])))))
    .filter(order => matchesPaymentOrderSearch(order, editOrderQuery));
  const existingPlanForOrder = (order: Order) => workingPlans.find(plan =>
    plan.orderRefs.includes(order.ref) || (!plan.orderRefs.length && plan.supplierPartner === order.supplierPartner));
  const newPaymentOrders = ordersForRequest(planningOrders, todayKey).filter(order => !existingPlanForOrder(order));
  const activeOrderRefs = workingPlans.flatMap(plan => plan.orderRefs);
  const workingCatalogue = procurementWorkingOrders(missingOrders, todayKey, activeOrderRefs);
  const reviewOrders = Object.entries(supplierDebtError && !planningDisplayAvailable ? {} : supplierBalances)
    .filter(([,balance]) => supplierPosition(balance) === 'review' || supplierPosition(balance) === 'debt' && balance.debt >= MIN_SUGGESTED_PAYMENT_RUB)
    .map(([supplierPartner,balance])=>({supplierPartner,balance}))
    .sort((a,b)=> Number(supplierPosition(a.balance)==='review')-Number(supplierPosition(b.balance)==='review') || b.balance.debt-a.balance.debt || a.supplierPartner.localeCompare(b.supplierPartner,'ru'));
  const visibleReviewOrders = showAllReviewOrders
    ? reviewOrders
    : reviewOrders.slice(0, 3);
  const positionSummary = supplierPositionSummary(supplierBalances);
  const unpaidActivePlans = workingPlans.map((plan) => ({
    ...plan,
    remainingRub: isCurrencyPaid(plan) ? 0 : Math.max(0, Number(plan.plannedAmount) - (plan.evidence?.state === "MISMATCH" ? 0 : Number(plan.evidence?.issuedAmount || 0) + Number(plan.evidence?.paidAmount || 0))),
  })).filter((plan) => plan.remainingRub > 0.009);
  const plannedQr = unpaidActivePlans
    .filter((plan) => plan.paymentMethod === "ACCOUNTABLE_QR")
    .reduce((sum, plan) => sum + plan.remainingRub, 0);
  const ownUsdtReserve = usdtReservedByPlans(activePlans, referenceUsdtRate);
  const reservesUnavailable = basisPreview || plansSourceError || evidenceSourceError || unverifiedPaymentView;
  const plannedUsdt = reservesUnavailable || ownUsdtReserve == null || otherUsdtReserve == null
    ? null : ownUsdtReserve + otherUsdtReserve;
  const freeQr = balancesRefreshing || balancesUnavailable || reservesUnavailable || accountableBalance.error || accountableBalance.balance == null ? null : accountableBalance.balance - plannedQr;
  const freeUsdt = balancesRefreshing || balancesUnavailable || usdtBalance.error || usdtBalance.balance == null || plannedUsdt == null
    ? null : usdtBalance.balance - plannedUsdt;
  const otherEditReserve=usdtReservedByPlans(activePlans.filter(plan=>plan.id!==editingId),referenceUsdtRate);
  const editAvailableUsdt=balancesRefreshing||balancesUnavailable||reservesUnavailable||usdtBalance.error||usdtBalance.balance==null||otherUsdtReserve==null||otherEditReserve==null?null:usdtBalance.balance-otherUsdtReserve-otherEditReserve;
  const groupedPlans = useMemo(() => {
    const groups = new Map<string, Plan[]>();
    [...workingPlans]
      .sort((a, b) => (paymentPreparationDate(a)||'9999-12-31').localeCompare(paymentPreparationDate(b)||'9999-12-31') || paymentActionPriority(a) - paymentActionPriority(b))
      .forEach((plan) => {
        const key = paymentPreparationDate(plan)||'9999-12-31';
        groups.set(key, [...(groups.get(key) || []), plan]);
      });
    return [...groups.entries()];
  }, [plans, plansSourceError, evidenceSourceError]);
  const mappingBlocked = managerMappingError && !sourceError;
  const planningBlocked = mappingBlocked || Boolean(sourceError) || plansSourceError || evidenceSourceError || unverifiedPaymentView || supplierDebtError;
  // Stored requests can be opened/edited while the catalogue refreshes. The
  // mutation endpoint rechecks ownership, version, basis, payment and overlap.
  const editingBlocked = mappingBlocked || plansSourceError;
  function openNew(supplier = "", selectedRefs?: string[]) {
    if (planningBlocked && !preview) return;
    setPaymentCreated(false);
    paymentFormOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const refs = selectedRefs || workingCatalogue.working.filter(order => !existingPlanForOrder(order))
      .filter((order) => order.supplierPartner === supplier)
      .map((order) => order.ref);
    setEditingId("");
    setBatchDraftState({ hasDraft: false, saving: false });
    setBatchSeedRefs(refs);
    setDraft({
      ...emptyDraft(),
      supplier,
      orderRefs: refs,
      plannedAmount: "",
    });
    setMessage("");
    setFormOpen(true);
  }
  function editPlan(plan: Plan) {
    setPaymentCreated(false);
    if (visualPreview?.edit) { visualPreview.edit(plan.id); return; }
    if (editingBlocked) return;
    paymentFormOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setChangeReason("");
    setEditingId(plan.id);
    setEditingVersion(plan.updatedAt);
    setEditBasis(plan.orderRefs.length ? 'ORDER' : 'DEBT');
    setEditOrderRefs(plan.orderRefs);
    setEditOrderQuery('');
    const nextDraft = {
      fundingSource: plan.fundingSource || '',
      supplier: plan.supplierPartner,
      orderRefs: plan.orderRefs,
      plannedDate: dateKey(plan.plannedDate),
      plannedAmount: String(plan.plannedAmount),
      condition: buyerPaymentComment(plan.condition),
      paymentMethod: plan.paymentMethod,
      foreignAmount: plan.foreignAmount || "",
      exchangeRate: plan.exchangeRate || "",
      commissionAmount: plan.commissionAmount || "",
      exchangerName: plan.exchangerName || "",
      supplierConfirmation: plan.supplierConfirmation || "",
    };
    setDraft(nextDraft);
    setOriginalEditDraft(nextDraft);
    setMessage("");
    setFormOpen(true);
  }
  function chooseSupplier(supplier: string) {
    setDraft((current) => ({
      ...current,
      supplier,
      orderRefs: [],
      plannedAmount: "",
      foreignAmount: "",
    }));
    setMessage("");
  }
  function closePaymentForm() {
    setDiscardOpen(false);
    setFormOpen(false);
    setEditingId("");
    setBatchSeedRefs([]);
    setDraft(emptyDraft());
    setOriginalEditDraft(null);
    setBatchDraftState({ hasDraft: false, saving: false });
    setChangeReason("");
  }
  function requestClosePaymentForm() {
    if (saving || batchDraftState.saving) return;
    const hasChanges = editingId
      ? JSON.stringify(draft) !== JSON.stringify(originalEditDraft) || Boolean(changeReason)
        || editBasis !== (editingPlan?.orderRefs.length ? 'ORDER' : 'DEBT')
      : batchDraftState.hasDraft;
    if (hasChanges) setDiscardOpen(true);
    else closePaymentForm();
  }
  function chooseEditBasis(basis: 'ORDER' | 'DEBT') {
    if (editBasisLocked || basis === editBasis) return;
    if (basis === 'DEBT') setEditOrderRefs(draft.orderRefs);
    setDraft(current => ({...current, orderRefs: basis === 'DEBT' ? [] : editOrderRefs}));
    setEditBasis(basis);
    setEditOrderQuery('');
    setMessage('');
  }
  function toggleOrder(ref: string, checked: boolean) {
    const refs = checked
      ? [...draft.orderRefs, ref]
      : draft.orderRefs.filter((value) => value !== ref);
    setDraft((current) => ({
      ...current,
      orderRefs: refs,
    }));
  }
  const dateOnlyEdit = editingPlan?.status === 'APPROVED' && editBasis === (editingPlan.orderRefs.length ? 'ORDER' : 'DEBT') && onlyPaymentDateChanged(originalEditDraft, draft);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview) { setMessage("Режим проверки: изменения не сохранены."); return; }
    if (basisPreview || (editingId ? editingBlocked : planningBlocked) || readOnlyPreview) {
      setMessage(basisPreview || readOnlyPreview ? 'Проверка интерфейса: отправка отключена.' : 'Данные не загружены полностью. Обновите страницу перед сохранением.');
      return;
    }
    setSaving(true);
    setMessage("");
    const selected = supplierOrders.filter((order) =>
      draft.orderRefs.includes(order.ref),
    );
    const body = {
      fundingSource: null,
      paymentPurpose: editingPlan?.paymentPurpose || 'GOODS',
      basis: editBasis,
      changeReason,
      version: editingVersion,
      supplierPartner: draft.supplier,
      supplierCounterparty: selected[0]?.supplierCounterparty || plans.find(plan => plan.id === editingId)?.supplierCounterparty || "",
      orderRefs: draft.orderRefs,
      orderNumbers: selected.map((order) => order.number),
      plannedDate: draft.plannedDate,
      plannedAmount: draft.plannedAmount,
      condition: draft.condition,
      paymentMethod: draft.paymentMethod,
      currency: ["USDT","CNY"].includes(draft.paymentMethod) ? draft.paymentMethod : "RUB",
      foreignAmount: draft.foreignAmount,
      exchangeRate: draft.exchangeRate,
      commissionAmount: draft.commissionAmount,
      exchangerName: draft.exchangerName,
      supplierConfirmation: draft.supplierConfirmation,
    };
    try {
    const response = await fetch(
      editingId
        ? `/api/procurement/payment-plans/${editingId}${dateOnlyEdit ? '/schedule' : ''}`
        : "/api/procurement/payment-plans",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dateOnlyEdit ? {action:'RESCHEDULE',date:draft.plannedDate,comment:changeReason,version:editingVersion} : body),
      },
    );
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Не удалось сохранить заявку.");
      return;
    }
    const wasEditing = Boolean(editingId);
    router.refresh();
    setPlans((current) =>
      (wasEditing
        ? current.map((plan) =>
            plan.id === editingId ? { ...plan, ...data } : plan,
          )
        : [...current, data]
      ).sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)),
    );
    setDraft(emptyDraft());
    setEditingId("");
    setFormOpen(false);
    setMessage(
      data.dateChanged ? `Дата изменена. Администратору отправлено уведомление, повторное согласование не требуется.${activePaymentDeferral(data)?' Отсрочка оплаты сохраняется. '+paymentScheduleDetail(data)+'.':''}` : data.revision ? "Изменения отправлены на согласование. До согласования действуют прежние условия." : wasEditing ? "Изменения сохранены." : "Заявка передана на согласование.",
    );
    } catch { setMessage("Нет связи с порталом. Изменения не подтверждены — проверьте заявку перед повторной отправкой."); }
    finally { setSaving(false); }
  }
  const groupTitle = (key: string) => {
    if(key==='9999-12-31')return 'Дата уточняется';
    const date = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric', month: 'long', timeZone: 'UTC',
      ...(key.slice(0, 4) !== todayKey.slice(0, 4) ? { year: 'numeric' as const } : {}),
    }).format(new Date(`${key}T12:00:00Z`));
    return key === todayKey ? `Сегодня · ${date}` : key === nextDayKey(todayKey) ? `Завтра · ${date}` : date;
  };

  const fundsSummary=(
          <section className={`procurement-funds-summary rounded-2xl border border-slate-200 bg-white p-4 ${compact ? '' : 'sm:p-5'}`}>
            <h2 className="text-lg font-black text-slate-900">Сводка</h2>
            <div className={`${compact ? 'mt-3' : 'mt-4'} grid gap-3`}>
              <SummaryMetric
                label="Долг поставщикам по 1С"
                value={mappingBlocked || (supplierDebtError && !planningDisplayAvailable) || readOnlyPreview?.debtTotal === null ? "—" : rub.format(readOnlyPreview?.debtTotal ?? positionSummary.debt)}
                hint={[planningDisplayAt ? `Данные на ${displayCheckedAt(planningDisplayAt)}${supplierDebtError ? sourceRefreshing ? ' · обновляем…' : ' · обновление не удалось' : ''}` : '',positionSummary.reviewCount ? `Без ${positionSummary.reviewCount} поставщиков: долг не подтверждён` : ''].filter(Boolean).join(' · ')}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1.5 text-amber-800 ring-1 ring-amber-200">
                Ждёт решения: {basisPreview || plansSourceError ? '—' : plans.filter((plan) => plan.status === "SUBMITTED").length}
              </span>
              <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1.5 text-slate-700">
                Деньги будут готовы: {reservesUnavailable ? '—' : plans.filter((plan) => plan.status === "APPROVED" && !isPaymentFinished(plan) && (!activePaymentDeferral(plan)||!!activePaymentDeferral(plan)?.date) && !visibleStage(plan)).length}
              </span>
              {plans.some(plan => plan.revision) ? <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">Изменения на согласовании: {plans.filter(plan => plan.revision).length}</span> : null}
            </div>

            <div className={`${compact ? 'mt-3 pt-3' : 'mt-4 pt-4'} border-t border-slate-200`}>
              <h3 className="text-sm font-black text-slate-900">Остатки касс</h3>
              {balancesRefreshing || balancesUnavailable || balancesDisplayAt ? <p className="mt-1 text-xs text-slate-500" role="status">{balancesDisplayAt ? `Данные на ${displayCheckedAt(balancesDisplayAt)}` : balancesRefreshing ? 'Загружаем остатки' : 'Остатки недоступны'}{balancesRefreshing && balancesDisplayAt ? ' · обновляем…' : balancesUnavailable && balancesDisplayAt ? ' · обновление не удалось' : ''}</p> : null}
              <div className={compact ? 'mt-2 space-y-2' : 'mt-3 space-y-3'}>
                <BalanceSummary
                  title="QR · рубли"
                  availableLabel="Остаток"
                  available={accountableBalance.balance == null ? "—" : rub.format(accountableBalance.balance)}
                  planned={reservesUnavailable ? '—' : rub.format(plannedQr)}
                  freeLabel={freeQr != null && freeQr < 0 ? "Не хватает" : "Свободно"}
                  free={freeQr == null ? "—" : rub.format(Math.abs(freeQr))}
                  critical={freeQr != null && freeQr < 0}
                />
                <BalanceSummary
                  title="Касса USDT"
                  availableLabel="Остаток"
                  available={usdtBalance.balance == null ? "—" : usdtBalance.balance.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                  planned={plannedUsdt == null ? "—" : plannedUsdt.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                  freeLabel={freeUsdt != null && freeUsdt < 0 ? "Не хватает" : "Свободно"}
                  free={freeUsdt == null ? "—" : Math.abs(freeUsdt).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                  critical={freeUsdt != null && freeUsdt < 0}
                />
              </div>
            </div>

          </section>
  );
  return (
    <ProcurementMobilePresentation.Provider value={mobilePresentation}>
    <div className={`procurement-calendar space-y-3 ${mobile?'procurement-mobile-calendar':''}`} data-view={paymentView}>
      {mobile && <div ref={setActionTarget} className='procurement-mobile-actions employee-attention-groups' aria-label='Текущие действия'/>}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">
            <span className="sm:hidden">Закупки</span><span className="hidden sm:inline">Платёжный календарь</span>
          </h1>
        </div>
        <div className="flex flex-col gap-2 sm:items-end xl:flex-row-reverse xl:items-center xl:gap-3">
          {!planningBlocked || preview ? (
            <button
              aria-label='Добавить оплату' title='Добавить оплату'
              aria-hidden={paymentView !== 'current' || undefined}
              disabled={paymentView !== 'current'}
              tabIndex={paymentView !== 'current' ? -1 : undefined}
              onClick={() => { if (visualPreview?.add) { visualPreview.add(); return; } setPaymentView('current'); if(!formOpen)openNew(); }}
              className={`buyer-create-payment admin-material-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-black text-white ${paymentView !== 'current' ? 'invisible' : ''}`}
            >
              <Plus className="h-5 w-5" />
              <span className="buyer-create-payment-label">Добавить оплату</span>
            </button>
          ) : null}
        </div>
      </header>
      <div className="buyer-calendar-tabs-row flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--portal-border)]">
      <nav aria-label="Разделы календаря" className="flex gap-6" style={mobile?{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}:undefined}>
        <button type="button" aria-pressed={paymentView==='current'} disabled={formOpen}
          onClick={()=>setPaymentView('current')}
          className={`-mb-px min-h-11 rounded-none border-0 border-b-[3px] bg-transparent px-1 py-2 text-sm font-bold disabled:opacity-50 ${paymentView==='current'?'border-[var(--portal-text)] text-[var(--portal-text)]':'border-transparent text-[var(--portal-text-muted)] hover:text-[var(--portal-text)]'}`}><span className="md:hidden">Оплаты</span><span className="hidden md:inline">Текущие оплаты</span></button>
        {mobile && <button type="button" aria-pressed={paymentView==='accountable'} disabled={formOpen} onClick={()=>setPaymentView('accountable')} className='min-h-11 px-1 text-sm font-bold'>{deliveryCashPanel||deliveryCash?'Подотчёт':'Сводка'}</button>}
        <button type="button" aria-pressed={paymentView==='history'} disabled={formOpen}
          onClick={()=>setPaymentView('history')}
          className={`-mb-px min-h-11 rounded-none border-0 border-b-[3px] bg-transparent px-1 py-2 text-sm font-bold disabled:opacity-50 ${paymentView==='history'?'border-[var(--portal-text)] text-[var(--portal-text)]':'border-transparent text-[var(--portal-text-muted)] hover:text-[var(--portal-text)]'}`}><span className="md:hidden">История</span><span className="hidden md:inline">История оплат</span></button>
      </nav>
        {!mobile && <div className="buyer-calendar-freshness pb-1"><ProcurementDataRefresh checkedAt={checkedAt} label="Заказы 1С" mobileSummary unavailable={!!sourceError} refreshing={sourceRefreshing} pauseWhileDialogOpen /></div>}
      </div>
      {visualPreview?.toolbar}
      {!visualPreview || visualPreview.persistedReceipts ? <ProcurementReceipts plans={receiptPlans} allPlans={plans} onCounts={setReceiptCounts} onLoadState={setReceiptLoadState} renderEntry={mobile?state=><ProcurementMobileReceiptEntry {...state}/>:undefined}/> : null}
      {mobile && <div className='procurement-mobile-accountable'>{deliveryCashPanel ?? (deliveryCash ? <ProcurementDeliveryCash snapshot={deliveryCash}/> : null)}{fundsSummary}</div>}
      {sourceRefreshing ? <p role="status" className="text-sm text-slate-600"><span className="sm:hidden">Обновляем 1С. Показаны сохранённые данные.</span><span className="hidden sm:inline">Обновляем данные 1С. Сохранённые заявки доступны; изменения проверяются при сохранении.</span></p> : null}
      {mobile ? (() => {
        const warnings = [
          {visible: !sourceRefreshing && sourceError, title: 'Заказы 1С сейчас недоступны', text: 'Сохранённые заявки видны, но создать новую можно после восстановления связи.'},
          {visible: plansSourceError, title: 'Заявки сейчас недоступны', text: 'Не удалось загрузить действующие заявки. Резервы неизвестны. Обновите страницу — создавать новые заявки пока нельзя.'},
          {visible: !sourceRefreshing && supplierDebtError, title: 'Долги поставщикам сейчас не проверены', text: 'Сохранённые заявки видны. Обновите данные перед новой оплатой.'},
          {visible: !sourceRefreshing && evidenceSourceError, title: 'Оплаты обновляются', text: 'Статусы временно не обновляются. Сохранён результат последней проверки. Обновление повторится автоматически.'},
        ].filter(warning => warning.visible);
        return warnings.length ? <details className='procurement-source-status'>
          <summary><AlertTriangle size={15} aria-hidden='true'/><span>Данные 1С не обновлены</span><small>Подробнее</small></summary>
          <ul>{warnings.map(warning => <li key={warning.title}><strong>{warning.title}</strong><p>{warning.text}</p></li>)}</ul>
        </details> : null;
      })() : <>
      {!sourceRefreshing && sourceError ? (
        <Notice
          title="Заказы 1С сейчас недоступны"
          text="Сохранённые заявки видны, но создать новую можно после восстановления связи."
        />
      ) : null}
      {plansSourceError ? <Notice title="Заявки сейчас недоступны" text="Не удалось загрузить действующие заявки. Резервы неизвестны. Обновите страницу — создавать новые заявки пока нельзя." /> : null}
      {!sourceRefreshing && supplierDebtError ? <Notice title="Долги поставщикам сейчас не проверены" text="Сохранённые заявки видны. Обновите данные перед новой оплатой." /> : null}
      {!sourceRefreshing && evidenceSourceError ? (
        <Notice title="Оплаты обновляются" text="Статусы временно не обновляются. Сохранён результат последней проверки. Обновление повторится автоматически." />
      ) : null}
      </>}
      {unknownPayments.length ? <section className="rounded-xl border border-stone-200 bg-white p-3">
        <h2 className="text-sm font-semibold">Сохранённые заявки · статус оплаты уточняется</h2>
        <p className="mt-1 text-xs text-slate-600">Пока сверка не завершена, эти заявки не считаются неоплаченными.</p>
        <div className="mt-2 divide-y divide-stone-100">{unknownPayments.map(plan=><div key={plan.id} className="flex items-center justify-between gap-3 py-2">
          <span className="text-sm font-semibold">{plan.supplierPartner}<span className="ml-2 text-xs font-normal text-slate-500">{plan.orderNumbers.length?'Заказ '+plan.orderNumbers.join(', '):supplierOnlyPaymentLabel(plan)}</span></span>
          <button type="button" className="pam-button shrink-0" disabled={editingBlocked||!!plan.revision} onClick={()=>editPlan(plan)} aria-label={`Изменить оплату ${plan.supplierPartner}`}>Изменить</button>
        </div>)}</div>
      </section> : null}
      {mappingBlocked ? (
        <Notice
          critical
          title="Профиль не сопоставлен с менеджером в 1С"
          text="Это ошибка настройки, а не отсутствие заказов. Сообщите администратору."
        />
      ) : null}

      <div className={compact ? 'compact-payment-calendar grid gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_280px] min-[1180px]:grid-cols-[minmax(0,1fr)_360px] min-[1280px]:grid-cols-[minmax(0,1fr)_380px] items-start' : 'grid gap-5 min-[1180px]:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.72fr)] min-[1180px]:items-start'}>
        {paymentView==='history' ? <ProcurementPaymentHistory plans={paidPlans} compactBuyer splitView={mobile} /> :
        <div className="flex min-w-0 flex-col gap-5">
          {message && !formOpen ? (
            <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm">
              <span>{message}</span>
              {paymentCreated ? <button type="button" onClick={() => openNew()} className="font-semibold text-[#785537] underline underline-offset-4">Добавить ещё оплату</button> : null}
            </div>
          ) : null}

      <section
        className={compact ? 'buyer-payment-list-section rounded-2xl border border-slate-200 bg-white p-3 sm:p-4' : 'rounded-2xl border border-slate-200 bg-white p-4 sm:p-5'}
        aria-hidden={formOpen || undefined}
        inert={formOpen || undefined}
      >
        <div className={`flex flex-col gap-2 border-b border-slate-200 sm:flex-row sm:items-end sm:justify-between ${compact ? 'pb-3' : 'pb-4'}`}>
          <div>
            <h2 className="text-lg font-black">Мои заявки</h2>
          </div>
          {!planningBlocked || preview ? (
            <p className="text-xs font-bold text-slate-500">
              {compact ? `Всего заявок: ${workingPlans.length}` : `Поставщиков с долгом: ${readOnlyPreview?.supplierCount ?? (supplierDebtError ? '—' : Object.values(supplierBalances).filter(balance=>supplierPosition(balance)==='debt').length)}`}
            </p>
          ) : null}
        </div>
        <div className={compact ? 'compact-payment-list mt-2 space-y-3' : 'mt-5 space-y-6'}>
          {groupedPlans.length ? (
            groupedPlans.map(([key, datePlans]) => (
              <div key={key}>
                <div data-payment-day={key === todayKey ? 'today' : key < todayKey && datePlans.some(plan=>!visibleStage(plan)) ? 'past' : 'future'} className={`${compact ? 'mb-1 rounded-lg px-2.5 py-1.5' : 'mb-3 rounded-xl px-3 py-3'} flex flex-wrap items-center gap-x-3 gap-y-1 ${key < todayKey && datePlans.some(plan=>!visibleStage(plan)) ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-900'}`}>
                  <CalendarDays
                    className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} shrink-0 ${key < todayKey && datePlans.some(plan=>!visibleStage(plan)) ? "text-red-600" : "procurement-calendar-icon"}`}
                  />
                  <h3
                    className={compact ? 'text-sm font-bold' : 'text-base font-bold sm:text-lg'}
                  >
                    <time dateTime={key==='9999-12-31'?undefined:key} aria-current={key === todayKey ? 'date' : undefined}>{groupTitle(key)}</time>
                  </h3>
                  {key < todayKey && datePlans.some(plan=>!visibleStage(plan)) ? <span className="text-xs font-semibold">Плановая дата прошла</span> : null}
                  <span aria-label={`Заявок: ${datePlans.length}`} className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
                    {datePlans.length}
                  </span>
                </div>
                <div className={compact ? 'divide-y divide-slate-100' : 'space-y-2'}>
                  {datePlans.map((plan) => (
                    <article
                      key={plan.id}
                      data-expanded={expandedPlan === plan.id}
                      onClick={compact ? event => {
                        if (!window.matchMedia('(max-width: 767px)').matches) return;
                        const target = event.target as HTMLElement;
                        if (target.closest('button,a,input,select,textarea,label,summary,[data-payment-details]') || window.getSelection()?.toString()) return;
                        setExpandedPlan(current => current === plan.id ? null : plan.id);
                      } : undefined}
                      className={compact ? `compact-payment-row grid items-center gap-x-3 gap-y-1 px-2.5 py-2 ${expandedPlan === plan.id ? 'rounded-lg bg-slate-50/70' : ''} ${key < todayKey && !visibleStage(plan) ? 'bg-red-50/40' : ''}` : `grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(170px,.72fr)] sm:items-center sm:p-4 min-[960px]:grid-cols-[minmax(190px,1fr)_minmax(165px,.85fr)_minmax(145px,.72fr)_104px] ${key < todayKey && !visibleStage(plan) ? "border-red-200 bg-red-50/40" : "border-slate-200"}`}
                    >
                      <div className="min-w-0">
                        <h4 className={compact ? 'text-sm font-bold leading-5' : 'font-black'}>{plan.supplierPartner}</h4>
                        <p className={compact ? "mt-0.5 hidden text-xs font-semibold text-slate-500 sm:block" : "mt-0.5 text-xs font-semibold text-slate-500"}>
                          {visualPreview?.labels?.[plan.id] ?? (plan.paymentPurpose==='DELIVERY'?'Доставка':!plan.orderRefs.length ? supplierOnlyPaymentLabel(plan) : <>{plan.orderNumbers.filter(Boolean).length > 1
                            ? "Заказы"
                            : "Заказ"}: {" "}
                          {plan.orderNumbers.filter(Boolean).join(", ") ||
                            "без номера"}</>)}
                        </p>
                        {!compact && <p className="mt-1 text-xs font-medium text-slate-500">
                          {leadTimeLabel(plan)}
                        </p>}
                      </div>
                      <div>
                        {paymentListRemainder(plan)?<p className="text-xs font-medium text-slate-500">Доплатить</p>:null}
                        <p className={compact ? 'whitespace-nowrap text-[15px] font-bold tabular-nums leading-5' : 'text-xl font-black'}>
                          {paymentListRemainder(plan)?.replace(/^Доплатить /,'') || (["USDT","CNY"].includes(plan.paymentMethod)
                            ? Number(plan.foreignAmount || 0) > 0
                              ? `${Number(plan.foreignAmount).toLocaleString("ru-RU", { maximumFractionDigits: 4 })} ${plan.paymentMethod}`
                              : rub.format(Number(plan.plannedAmount))
                            : rub.format(Number(plan.plannedAmount)))}
                        </p>
                        <p className={compact ? 'mt-0.5 hidden text-xs text-slate-500 sm:block' : 'mt-0.5 text-sm font-semibold text-slate-600'}>
                          {visualPreview?.methods?.[plan.id] ?? methodLabel(plan.paymentMethod)}
                        </p>
                        {plan.paymentMethod === "USDT" && !Number(plan.foreignAmount || 0) ? <ProcurementUsdtEstimate amount={Number(plan.plannedAmount)} rate={usdtRateReference?.rate} conversionAt={usdtRateReference?.conversionAt} /> : null}
                        {!compact && buyerPaymentComment(plan.condition) ? (
                          <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-600" title={buyerPaymentComment(plan.condition)}>
                            Комментарий: {buyerPaymentComment(plan.condition)}
                          </p>
                        ) : null}
                      </div>
                      <div className="compact-payment-status space-y-1">
                        {visualPreview?.badge?.(plan.id)}
                        <span
                          className={`block w-fit shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold leading-4 ${receiptStageUnknown(plan) ? "bg-amber-100 text-amber-900" : paymentScheduleLabel(plan)==='Оплата отложена' ? "bg-stone-100 text-stone-700" : plan.status === "APPROVED" ? "bg-green-100 text-green-800" : plan.status === "NEEDS_CHANGES" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}
                        >
                          {visibleStage(plan) || paymentScheduleLabel(plan) || (plan.status === "APPROVED"
                            ? plan.evidence?.state === "MISMATCH" ? "ОПЛАТА НА ПРОВЕРКЕ" : plan.evidence?.state === "PARTIALLY_ISSUED" || plan.evidence?.state === "PARTIALLY_PAID_BY_ONE_C" ? "ЧАСТИЧНО ОПЛАЧЕНО" : "Деньги будут готовы"
                            : plan.status === "NEEDS_CHANGES" ? "НУЖНО ИСПРАВИТЬ" : "Ждёт решения")}
                        </span>
                        {plan.status==='SUBMITTED'&&activePaymentDeferral(plan)?<p className="text-xs text-amber-800">Ждёт решения</p>:null}
                        {plan.status === "NEEDS_CHANGES" && plan.correctionReason ? <p className="max-w-[240px] text-xs font-bold text-red-700">{plan.correctionReason}</p> : null}
                        {plan.revision ? <p className="max-w-[240px] text-xs font-bold text-amber-800">Изменения на согласовании. Пока действуют прежние условия.</p> : null}
                        {!compact && <ProcurementChangeHistory events={plan.events} buyerView />}
                        {plan.paymentMethod==='USDT'&&plan.fundingSource?<p className="text-xs text-slate-600">{fundingSourceLabel(plan.fundingSource)}</p>:null}
                        {plan.evidence?.state === 'PARTIALLY_ISSUED' ? <p className="text-xs font-bold text-blue-800">Оплачено {rub.format(plan.evidence.issuedAmount)} · осталось по заявке {rub.format(Math.max(0, Number(plan.plannedAmount) - plan.evidence.issuedAmount))}</p> : null}
                        {plan.evidence?.paymentAmountNeedsConfirmation ? <p className="text-xs font-bold text-amber-800">Оплата найдена: {plan.evidence.paidForeignAmount.toLocaleString('ru-RU')} USDT. Выполнение заявки ещё не подтверждено.</p> : null}
                        {plan.evidence?.state === "PARTIALLY_PAID_BY_ONE_C" ? <p className="text-xs font-bold text-blue-800">Оплачено {plan.evidence.paidForeignAmount.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT · осталось {plan.evidence.remainingForeignAmount != null ? `${plan.evidence.remainingForeignAmount.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT` : rub.format(plan.evidence.remainingAmount)}</p> : null}
                      </div>
                      {compact ? <div className="compact-payment-actions flex items-center justify-end gap-1">
                        {!mobile && ['SUBMITTED','NEEDS_CHANGES','APPROVED'].includes(plan.status) ? <button type="button" disabled={editingBlocked||!!plan.revision} title={plan.revision?'Изменения уже на согласовании':editingBlocked?'Не удалось загрузить заявку или подтвердить доступ.':undefined} onClick={() => editPlan(plan)} aria-label={`Изменить оплату ${plan.supplierPartner}`} className="procurement-secondary-action inline-flex min-h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 disabled:opacity-50">Изменить</button> : null}
                        <button type="button" aria-expanded={expandedPlan === plan.id} aria-controls={`plan-details-${plan.id}`}
                        aria-label={`Подробности оплаты ${plan.supplierPartner}`} onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                        className="inline-flex h-11 w-11 md:h-8 md:w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                        <ChevronDown className={`h-4 w-4 transition-transform ${expandedPlan === plan.id ? 'rotate-180' : ''}`} />
                      </button></div> : ["SUBMITTED", "NEEDS_CHANGES", "APPROVED"].includes(plan.status) ? (
                        <button
                          disabled={editingBlocked||!!plan.revision}
                          title={plan.revision?'Изменения уже на согласовании':editingBlocked?'Не удалось загрузить заявку или подтвердить доступ.':undefined}
                          onClick={() => editPlan(plan)}
                          className="procurement-secondary-action inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Изменить
                        </button>
                      ) : (
                        <span />
                      )}
                      <ProcurementCollectionNotice collection={plan.evidence?.collection} today={todayKey} />
                      {compact && expandedPlan === plan.id ? <div id={`plan-details-${plan.id}`} data-payment-details className="col-span-full flex flex-wrap items-start justify-between gap-3 border-t border-slate-200 pt-3 pb-1">
                        <div className="min-w-0 flex-1 space-y-2 text-sm text-slate-600">
                          {mobile ? <dl className="mobile-payment-facts">
                            <div><dt>Способ оплаты</dt><dd>{methodLabel(plan.paymentMethod)}</dd></div>
                            <div><dt>{plan.paymentPurpose==='DELIVERY'?'Назначение':plan.orderNumbers.filter(Boolean).length?'Заказ':'Основание'}</dt><dd>{plan.paymentPurpose==='DELIVERY'?'Доставка':plan.orderNumbers.filter(Boolean).join(', ') || supplierOnlyPaymentLabel(plan)}</dd></div>
                            <div><dt>Подготовить к</dt><dd>{new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(plan.plannedDate))}<small>{leadTimeLabel(plan)}</small></dd></div>
                            {buyerPaymentComment(plan.condition) ? <div><dt>Комментарий</dt><dd>{buyerPaymentComment(plan.condition)}</dd></div> : null}
                          </dl> : <>
                            <p className="sm:hidden">{methodLabel(plan.paymentMethod)} · {plan.orderNumbers.filter(Boolean).length ? `Заказ: ${plan.orderNumbers.filter(Boolean).join(", ")}` : supplierOnlyPaymentLabel(plan)}</p>
                            {buyerPaymentComment(plan.condition) ? <p><span className="font-semibold">Комментарий: </span>{buyerPaymentComment(plan.condition)}</p> : <p>Комментарий не указан.</p>}
                          </>}
                          {activePaymentDeferral(plan)?<p>{paymentScheduleDetail(plan)}{activePaymentDeferral(plan)?.comment?` · ${activePaymentDeferral(plan)?.comment}`:''}</p>:null}
                          {plan.evidence?.qrFunding?.lastConfirmed?<p className="text-xs text-slate-500">Перемещение: последняя проверка {new Date(plan.evidence.qrFunding.checkedAt).toLocaleString('ru-RU')}. Обновление пока не подтверждено.</p>:null}
                          {!mobile && <p className="text-xs text-slate-500">Подготовить к: {new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(plan.plannedDate))} · {leadTimeLabel(plan)}</p>}
                          <ProcurementChangeHistory events={plan.events} buyerView />
                          {visualPreview?.detail?.(plan.id)}
                          {mobile ? <div className='mobile-payment-detail-actions'>
                            {['SUBMITTED','NEEDS_CHANGES','APPROVED'].includes(plan.status) ? <button type="button" disabled={editingBlocked||!!plan.revision} title={plan.revision?'Изменения уже на согласовании':editingBlocked?'Не удалось загрузить заявку или подтвердить доступ.':undefined} onClick={()=>editPlan(plan)} aria-label={`Изменить оплату ${plan.supplierPartner}`} className="procurement-secondary-action procurement-receipt-button">Изменить оплату</button> : null}
                            {!visualPreview || visualPreview.persistedReceipts ? <ProcurementReceipts plans={[plan]} single/> : null}
                          </div> : (!visualPreview || visualPreview.persistedReceipts ? <ProcurementReceipts plans={[plan]} single/> : null)}
                        </div>
                      </div> : null}
                    </article>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-slate-50 p-5 text-center">
              <CalendarDays className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-2 font-black text-slate-700">{plansSourceError ? 'Не удалось загрузить заявки' : unknownPayments.length ? 'Статус оплат уточняется' : basisPreview ? 'Заявки не загружены в просмотр' : paidPlans.length ? "Текущих оплат нет" : "Заявок пока нет"}</p>
              <p className="mt-1 text-sm text-slate-500">
                {evidenceSourceError ? 'Статусы обновятся автоматически после восстановления связи с 1С.' : planningBlocked ? 'Обновите данные, чтобы продолжить.' : paidPlans.length ? 'Оплаченные заявки — во вкладке «История оплат».' : "Нажмите «Добавить оплату», чтобы создать заявку."}
              </p>
            </div>
          )}
        </div>
      </section>

      {sourceRefreshing && !planningDisplayAvailable && supplierDebtError ? <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-busy="true"><h2 className="text-lg font-black">Запланировать оплату</h2><p className="mt-2 text-sm text-slate-500">Загружаем поставщиков и заказы…</p></section> : null}
      {reviewOrders.length > 0 && (!planningBlocked || planningDisplayAvailable) ? (
        <section className="buyer-supplier-planning rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" inert={formOpen || undefined} aria-hidden={formOpen || undefined}>
          <div className="flex flex-col gap-1 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Запланировать оплату</h2>
              {planningDisplayAt ? <p className="mt-1 text-xs text-slate-500">Данные на {displayCheckedAt(planningDisplayAt)}{supplierDebtError ? sourceRefreshing ? ' · обновляем…' : ' · обновление не удалось' : ''}</p> : null}
            </div>
            {reviewOrders.length ? (
              <p className="shrink-0 text-xs font-bold text-slate-500">
                Поставщиков: {reviewOrders.length}
              </p>
            ) : null}
          </div>

          {visibleReviewOrders.length ? (
            <div className="mt-2 divide-y divide-slate-100">
              {visibleReviewOrders.map((order) => (
                <article
                  key={order.supplierPartner}
                  className="grid gap-3 py-3 sm:grid-cols-[minmax(220px,1fr)_minmax(160px,0.55fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="font-black text-slate-950">{order.supplierPartner}</p>
                    {mobile && supplierPosition(order.balance)==='review' ? <p className="buyer-supplier-review text-xs text-amber-800">Расчёты требуют проверки</p> : null}
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">Уже запланировано: {reservesUnavailable ? '—' : rub.format(workingPlans.filter(plan=>plan.supplierPartner===order.supplierPartner).reduce((sum,plan)=>sum+Math.max(0,Number(plan.plannedAmount)-(plan.evidence?.state==='MISMATCH'?0:Number(plan.evidence?.issuedAmount||0)+Number(plan.evidence?.paidAmount||0))),0))}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500">Долг по 1С</p>
                    <p className="mt-0.5 text-base font-black text-slate-950">
                      {supplierPosition(order.balance)==='review' ? '—' : rub.format(order.balance.debt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={supplierPosition(order.balance)==='review' || (planningBlocked && !workingPlans.some(plan=>plan.supplierPartner===order.supplierPartner))}
                    onClick={() => { const existing = workingPlans.find(plan=>plan.supplierPartner===order.supplierPartner); if (existing) editPlan(existing); else openNew(order.supplierPartner, [`debt:${order.supplierPartner}`]); }}
                    aria-label={mobile?`${supplierPosition(order.balance)==='review' ? 'Пока недоступно' : workingPlans.some(plan=>plan.supplierPartner===order.supplierPartner) ? 'Открыть заявку' : 'Запланировать оплату'}: ${order.supplierPartner}`:undefined}
                    className="procurement-secondary-action buyer-supplier-plan-action inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition"
                  >
                    <Plus className="h-4 w-4" />
                    {mobile ? <span>{supplierPosition(order.balance)==='review' ? 'Пока недоступно' : workingPlans.some(plan=>plan.supplierPartner===order.supplierPartner) ? 'Открыть заявку' : 'Запланировать'}</span> : (supplierPosition(order.balance)==='review' ? 'Пока недоступно' : workingPlans.some(plan=>plan.supplierPartner===order.supplierPartner) ? 'Открыть заявку' : 'Запланировать')}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
              Нет поставщиков с долгом.
            </div>
          )}

          {reviewOrders.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAllReviewOrders((current) => !current)}
              className="procurement-text-action mt-2 text-sm font-black text-slate-600"
            >
              {showAllReviewOrders
                ? "Свернуть список"
                : `Показать остальные ${reviewOrders.length - 3}`}
            </button>
          ) : null}
        </section>
      ) : null}


      {formOpen ? <ProcurementPaymentDialog editing={Boolean(editingId)} busy={saving || batchDraftState.saving} onClose={requestClosePaymentForm} returnFocus={paymentFormOpener.current}>
        {editingId ? (
          <form
            className="space-y-3 p-4 sm:px-5"
            onSubmit={submit}
          >
            <div><p className="text-xs font-bold text-slate-500">{editingPlan?.paymentPurpose==='DELIVERY'?'Перевозчик':'Поставщик'}</p><p className="mt-1 font-semibold">{draft.supplier}</p></div>
            {editingPlan?.paymentPurpose===SUPPLIER_ADVANCE?<p className="text-sm text-slate-600">{supplierOnlyPaymentLabel(editingPlan)} · основание оплаты сохраняется</p>:editingPlan?.paymentPurpose==='DELIVERY'?<p className="text-sm text-slate-600">Доставка</p>:<details className="rounded-xl border border-slate-200 px-3 py-2.5"><summary className="cursor-pointer text-sm font-semibold">{editBasis==='DEBT'?'В счёт долга поставщику':`Заказ № ${draft.orderRefs.map(ref=>supplierOrders.find(o=>o.ref===ref)?.number||editingPlan?.orderNumbers[editingPlan.orderRefs.indexOf(ref)]||'—').join(', ')}`}<span className="ml-2 text-xs font-normal text-slate-500">{editBasisLocked?'Основание оплаты':'Изменить основание'}</span></summary><div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Основание оплаты">
              {(['ORDER', 'DEBT'] as const).map(basis => <button key={basis} type="button" aria-pressed={editBasis === basis}
                disabled={editBasisLocked || (basis === 'DEBT' && Boolean(editingPlan?.orderRefs.length) && supplierPosition(supplierBalances[draft.supplier]) !== 'debt')}
                onClick={() => chooseEditBasis(basis)}
                className={`procurement-form-tab border-b-2 px-3 py-2.5 text-sm font-semibold disabled:opacity-50 ${editBasis === basis ? 'border-[#9a6d46] text-[#785537]' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>
                {basis === 'ORDER' ? 'По заказу' : 'В счёт долга поставщику'}
              </button>)}
            </div>
            {editBasisLocked ? <p className="text-xs text-slate-500">{editHasPayment ? 'По заявке уже есть оплата — основание не меняется.' : 'Смена основания временно недоступна.'}</p> : null}
            {editBasis === 'DEBT' ? <p className="text-sm text-slate-600">Без привязки к заказу.</p> : draft.supplier ? (
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3 text-sm font-bold">
                  <span>Заказы поставщика</span>
                  <span className="text-slate-500">
                    Выбрано: {draft.orderRefs.length}
                  </span>
                </div>
                <input aria-label="Найти заказ" value={editOrderQuery} onChange={event => setEditOrderQuery(event.target.value)}
                  placeholder="Номер заказа или последние 3 цифры" className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                  {editableOrders.map((order) => (
                    <label
                      key={order.ref}
                      className="flex cursor-pointer gap-3 rounded-lg bg-white p-3 ring-1 ring-slate-200"
                    >
                      <input
                        type="checkbox"
                        disabled={editBasisLocked}
                        checked={draft.orderRefs.includes(order.ref)}
                        onChange={(event) =>
                          toggleOrder(order.ref, event.target.checked)
                        }
                      />
                      <span>
                        <span className="block font-extrabold">
                          Заказ № {order.number || "без номера"}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {orderDateLabel(order.date)} · сумма заказа {typeof order.amount === 'number' ? rub.format(order.amount) : '—'}
                        </span>
                      </span>
                    </label>
                  ))}
                  {!editableOrders.length&&!draft.orderRefs.length ? <p className="text-sm text-slate-500">Заказы не найдены.</p> : null}
                  {draft.orderRefs.filter(ref => !supplierOrders.some(order => order.ref === ref)).map(ref => <p key={ref} className="text-sm text-slate-600">
                    Заказ №{editingPlan?.orderNumbers[editingPlan.orderRefs.indexOf(ref)] || '—'} · уже в заявке
                  </p>)}
                </div>
              </div>
            ) : null}
            </details>}
            {editingPlan?.paymentPurpose!=='DELIVERY'?<ProcurementPaymentDebtSummary
              balance={supplierBalances[draft.supplier]} unavailable={supplierDebtError}
              orders={editBasis==='DEBT'?[]:draft.orderRefs.map(ref=>supplierOrders.find(order=>order.ref===ref)??{
                ref,number:editingPlan?.orderNumbers[editingPlan.orderRefs.indexOf(ref)]||'—',
              })}
            />:null}
            {editingPlan&&activePaymentDeferral(editingPlan)?<p className="text-sm text-slate-600">Оплата отложена. {paymentScheduleDetail(editingPlan)}. Перенос даты не отменяет отсрочку.</p>:null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Подготовить к
                <input
                  value={draft.plannedDate}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      plannedDate: event.target.value,
                    }))
                  }
                  type="date"
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3"
                />
              </label>
              <label className="text-sm font-bold">
                Способ оплаты
                <select
                  value={draft.paymentMethod}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      paymentMethod: event.target.value,
                      fundingSource: '',
                      foreignAmount: "",
                      exchangeRate: String((event.target.value==="CNY"?(cnyRateFromComment(current.condition,true)??cnyRateReference?.rate):event.target.value==="USDT"?usdtRateReference?.rate:null)??""),
                      ...(event.target.value==="CNY"?{plannedAmount:""}:{}),
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3"
                >
                  <option value="CASH">Наличные</option>
                  <option value="ACCOUNTABLE_QR">Оплата поставщику по QR</option>
                  <option value="USDT">Оплата в USDT</option>
                  <option value="CNY">Перевод в юанях</option>
                  <option value="BANK">Перевод на карту</option>
                </select>
              </label>
            </div>
            {draft.paymentMethod === 'CNY' ? <ProcurementCnyFields multipleOrders={editBasis==='ORDER'&&draft.orderRefs.length>1} amount={draft.foreignAmount} rate={draft.exchangeRate} legacyRubles={draft.plannedAmount} reference={cnyRateReference} onChange={patch=>setDraft(current=>({...current,...patch}))}/> : draft.paymentMethod === 'USDT' ? <ProcurementUsdtFields multipleOrders={editBasis==='ORDER'&&draft.orderRefs.length>1} amount={draft.foreignAmount} rate={draft.exchangeRate} source={draft.fundingSource} available={editAvailableUsdt} reference={usdtRateReference} legacyRubles={draft.plannedAmount} onChange={patch=>setDraft(current=>({...current,...patch}))}/> : <label className="block text-sm font-bold">{editBasis==='ORDER'&&draft.orderRefs.length>1?'Общая сумма оплаты, ₽':'Сумма, ₽'}<input value={draft.plannedAmount} onChange={event=>setDraft(current=>({...current,plannedAmount:event.target.value}))} type="number" min="0.01" step="0.01" required className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold"/></label>}
            {editHasPayment?<p className="text-xs text-slate-500">Укажите общую сумму, включая уже оплаченную часть.</p>:null}
            <label className="block text-sm font-bold">
              Комментарий{" "}
              <span className="font-medium text-slate-400">
                (необязательно)
              </span>
              <textarea
                value={draft.condition}
                onFocus={() => {previousCommentRate.current=cnyRateFromComment(draft.condition,true);}}
                onBlur={() => { if(draft.paymentMethod==='CNY') setDraft(current=>({...current,...cnyCommentDraftPatch(current.condition,current.foreignAmount,current.exchangeRate,cnyRateReference?.rate,previousCommentRate.current)})); }}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    condition: event.target.value,
                  }))
                }
                rows={2}
                placeholder={commentHint(draft.paymentMethod)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3"
              />
            </label>
            {plans.find(plan => plan.id === editingId)?.status === "APPROVED" ? <label className="block text-sm font-bold">{dateOnlyEdit?'Комментарий к переносу · необязательно':'Причина изменения *'}<textarea required={!dateOnlyEdit} minLength={dateOnlyEdit?undefined:3} maxLength={500} value={changeReason} onChange={event => setChangeReason(event.target.value)} rows={2} placeholder="Например: поставщик перенёс отгрузку" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3"/><span className="mt-1 block text-xs font-normal text-slate-500">{dateOnlyEdit?'Дата изменится сразу. Администратор получит уведомление, согласование оплаты сохранится.':'Изменение суммы и условий требует повторного согласования. Перенос только даты — без согласования, с уведомлением администратору. При частичной оплате укажите новую общую сумму, включая уже оплаченную часть.'}</span></label> : null}
            {message ? (
              <p className="text-sm font-bold text-red-600">{message}</p>
            ) : null}
            <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:-mx-5 sm:flex-row sm:justify-end sm:px-5">
              <button
                type="button"
                disabled={saving}
                onClick={requestClosePaymentForm}
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
              >
                Отмена
              </button>
              <button
                disabled={
                  saving || editingBlocked || (editBasis === 'ORDER' && !draft.orderRefs.length) || (
                    draft.paymentMethod === "USDT"
                      ? !draft.plannedAmount && !draft.foreignAmount
                      : !draft.plannedAmount
                  )
                }
                className="admin-material-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {saving
                  ? "Проверяем оплату в 1С…"
                  : editingId
                    ? editingPlan?.status === 'APPROVED' && editBasis !== (editingPlan.orderRefs.length ? 'ORDER' : 'DEBT') ? 'Передать изменения' : "Сохранить"
                    : "Передать на согласование"}
              </button>
            </div>
          </form>
        ) : (
          <ProcurementPaymentForm
            availableUsdt={freeUsdt}
            cargoAllowed={cargoAllowed}
            basisPreview={basisPreview || Boolean(readOnlyPreview)}
            submissionBlocked={planningBlocked}
            supplierDebtError={supplierDebtError}
            key={batchSeedRefs.join("|")}
            orders={ordersForRequest(planningOrders, todayKey)}
            todayKey={todayKey}
            activeOrderRefs={planningOrders.filter(order=>existingPlanForOrder(order)).map(order=>order.ref)}
            activeSupplierNames={workingPlans.map(plan=>plan.supplierPartner)}
            supplierBalances={supplierBalances}
            initialSelectedRefs={batchSeedRefs}
            usdtRateReference={usdtRateReference}
            cnyRateReference={cnyRateReference}
            onDraftStateChange={setBatchDraftState}
            onCancel={requestClosePaymentForm}
            onCreated={(created) => {
              setPlans((current) =>
                [...current, ...(created as unknown as Plan[])].sort((a, b) =>
                  a.plannedDate.localeCompare(b.plannedDate),
                ),
              );
              setFormOpen(false);
              setBatchSeedRefs([]);
              setPaymentCreated(true);
              setMessage('Заявка отправлена.');
            }}
          />
        )}
      </ProcurementPaymentDialog> : null}
      <ProcurementDiscardDraftDialog open={discardOpen} editing={Boolean(editingId)}
        onKeep={() => setDiscardOpen(false)} onDiscard={closePaymentForm} />
        </div>}

        <aside
          className={compact ? 'space-y-3' : 'space-y-5 min-[1180px]:sticky min-[1180px]:top-6'}
        >
          {!mobile && fundsSummary}
          {!mobile && (deliveryCashPanel ?? (deliveryCash ? <ProcurementDeliveryCash snapshot={deliveryCash} /> : null))}
        </aside>
      </div>
      {mobile && <div className="buyer-calendar-freshness pb-1"><ProcurementDataRefresh checkedAt={checkedAt} label="Заказы 1С" mobileSummary unavailable={!!sourceError} refreshing={sourceRefreshing} pauseWhileDialogOpen /></div>}
    </div>
    </ProcurementMobilePresentation.Provider>
  );
}

function displayCheckedAt(value:string) {
  const date=new Date(value);
  return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(date):'—';
}

function SummaryMetric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <p className="text-xs font-semibold leading-4 text-slate-500">{label}</p>
      <p className="mt-1.5 text-lg font-black text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-xs font-semibold text-slate-500">{hint}</p> : null}
    </div>
  );
}
function Notice({
  title,
  text,
  critical = false,
}: {
  title: string;
  text: string;
  critical?: boolean;
}) {
  return (
    <div
      className={`flex gap-3 rounded-2xl border p-4 text-sm ${critical ? "border-red-200 bg-red-50 text-red-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}
    >
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <div>
        <p className="font-black">{title}</p>
        <p className="mt-1 font-medium">{text}</p>
      </div>
    </div>
  );
}

function BalanceSummary({
  title,
  availableLabel,
  available,
  planned,
  freeLabel,
  free,
  critical = false,
}: {
  title: string;
  availableLabel: string;
  available: string;
  planned: string;
  freeLabel: string;
  free: string;
  critical?: boolean;
}) {
  return <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
    <p className="text-sm font-black text-slate-900">{title}</p>
    <div className="mt-2 grid grid-cols-3 gap-2">
      <SmallBalanceValue label={availableLabel} value={available} />
      <SmallBalanceValue label="В заявках" value={planned} />
      <SmallBalanceValue label={freeLabel} value={free} critical={critical} />
    </div>
  </div>;
}

function SmallBalanceValue({ label, value, critical = false }: { label: string; value: string; critical?: boolean }) {
  return <div className="min-w-0">
    <p className="text-[10px] font-bold text-slate-500">{label}</p>
    <p className={`mt-0.5 break-words text-xs font-black tabular-nums ${critical ? "text-red-700" : "text-slate-950"}`}>{value}</p>
  </div>;
}
