"use client";
import { buyerOrderPurpose, supplierPosition, supplierPositionSummary } from '@/lib/procurement-supplier-position';
import { ProcurementPaymentHistory } from "@/components/ProcurementPaymentHistory";
import { isInactivePaymentPlan, COMPLETED_WITHOUT_TOPUP } from '@/lib/procurement-payment-completion';
import { ProcurementDiscardDraftDialog } from '@/components/ProcurementDiscardDraftDialog';
import { usdtReservedByPlans } from "@/lib/procurement-usdt-reserve";
import { ProcurementUsdtEstimate } from "@/components/ProcurementUsdtEstimate";
import type { PaymentRevision } from "@/lib/procurement-plan-revision";
import { ProcurementChangeHistory, type PlanChangeEvent } from "@/components/ProcurementChangeHistory";
import { useRouter } from "next/navigation";

import React, { useEffect, useMemo, useState } from "react";
import { buyerPaymentComment } from '@/lib/procurement-buyer-comment';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { ProcurementPaymentBatchForm } from "./ProcurementPaymentBatchForm";
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
  method === "USDT"
    ? "Оплата в USDT"
    : method === "CASH"
      ? "Наличные"
      : method === "ACCOUNTABLE_QR"
        ? "Оплата поставщику по QR"
        : "Перевод поставщику";
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
  plansSourceError = false,
  evidenceSourceError,
  managerMappingError,
  supplierBalances,
  supplierDebtTotal,
  supplierDebtError,
  usdtBalance,
  accountableBalance,
  usdtRateReference,
  todayKey,
  basisPreview = false,
  otherUsdtReserve = null,
}: {
  initialOrders: Order[];
  initialPlans: Plan[];
  checkedAt: string;
  sourceError: string;
  plansSourceError?: boolean;
  evidenceSourceError: boolean;
  managerMappingError: boolean;
  supplierBalances: Record<string, SupplierBalance>;
  supplierDebtTotal: number | null;
  supplierDebtError: boolean;
  usdtBalance: UsdtBalance;
  accountableBalance: UsdtBalance;
  usdtRateReference?: UsdtRateReference;
  todayKey: string;
  basisPreview?: boolean;
  otherUsdtReserve?: number | null;
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const router = useRouter();
  const [changeReason, setChangeReason] = useState("");
  const [batchSeedRefs, setBatchSeedRefs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
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
  const enteredRoubles = Number(draft.plannedAmount || 0);
  const enteredUsdt = Number(draft.foreignAmount || 0);
  const estimatedUsdt = referenceUsdtRate > 0 && enteredRoubles > 0
    ? enteredRoubles / referenceUsdtRate
    : 0;
  const estimatedRoubles = referenceUsdtRate > 0 && enteredUsdt > 0
    ? enteredUsdt * referenceUsdtRate
    : 0;
  const rateDate = usdtRateReference?.conversionAt || "";
  const parsedRateDate = rateDate ? new Date(rateDate) : null;
  const rateDateLabel = parsedRateDate && !Number.isNaN(parsedRateDate.getTime())
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" }).format(parsedRateDate)
    : "";
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
  const activePlans = (plansSourceError ? [] : plans).filter((plan) => !isInactivePaymentPlan(plan.status))
    .map(plan => evidenceSourceError ? { ...plan, evidence: undefined } : plan);
  const isCurrencyPaid = (plan: Plan) => plan.evidence?.state === "PAID_BY_ONE_C";
  const paidPlans = [...activePlans.filter((plan) => plan.evidence?.state === "ISSUED_BY_ONE_C" || isCurrencyPaid(plan)), ...plans.filter(plan=>plan.status===COMPLETED_WITHOUT_TOPUP)];
  const workingPlans = activePlans.filter((plan) => plan.evidence?.state !== "ISSUED_BY_ONE_C" && !isCurrencyPaid(plan));
  const planningOrders = calculateOrderPlanning(
    initialOrders,
    activePlans.map((plan) => ({
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
  const reviewOrders = Object.entries(supplierDebtError ? {} : supplierBalances)
    .filter(([,balance]) => supplierPosition(balance) === 'review' || supplierPosition(balance) === 'debt' && balance.debt >= MIN_SUGGESTED_PAYMENT_RUB)
    .map(([supplierPartner,balance])=>({supplierPartner,balance}))
    .sort((a,b)=> Number(supplierPosition(a.balance)==='review')-Number(supplierPosition(b.balance)==='review') || b.balance.debt-a.balance.debt || a.supplierPartner.localeCompare(b.supplierPartner,'ru'));
  const visibleReviewOrders = showAllReviewOrders
    ? reviewOrders
    : reviewOrders.slice(0, 3);
  const positionSummary = supplierPositionSummary(supplierBalances);
  const unpaidActivePlans = activePlans.map((plan) => ({
    ...plan,
    remainingRub: isCurrencyPaid(plan) ? 0 : Math.max(0, Number(plan.plannedAmount) - (plan.evidence?.state === "MISMATCH" ? 0 : Number(plan.evidence?.issuedAmount || 0) + Number(plan.evidence?.paidAmount || 0))),
  })).filter((plan) => plan.remainingRub > 0.009);
  const plannedQr = unpaidActivePlans
    .filter((plan) => plan.paymentMethod === "ACCOUNTABLE_QR")
    .reduce((sum, plan) => sum + plan.remainingRub, 0);
  const ownUsdtReserve = usdtReservedByPlans(activePlans, referenceUsdtRate);
  const reservesUnavailable = basisPreview || plansSourceError || evidenceSourceError;
  const plannedUsdt = reservesUnavailable || ownUsdtReserve == null || otherUsdtReserve == null
    ? null : ownUsdtReserve + otherUsdtReserve;
  const freeQr = reservesUnavailable || accountableBalance.error || accountableBalance.balance == null ? null : accountableBalance.balance - plannedQr;
  const freeUsdt = usdtBalance.error || usdtBalance.balance == null || plannedUsdt == null
    ? null : usdtBalance.balance - plannedUsdt;
  const groupedPlans = useMemo(() => {
    const groups = new Map<string, Plan[]>();
    [...workingPlans]
      .sort((a, b) => paymentActionPriority(a) - paymentActionPriority(b) || a.plannedDate.localeCompare(b.plannedDate))
      .forEach((plan) => {
        const key = `${paymentActionPriority(plan)}|${dateKey(plan.plannedDate)}`;
        groups.set(key, [...(groups.get(key) || []), plan]);
      });
    return [...groups.entries()].map(([id, rows]) => [id.split('|')[1], rows, id, ['Нужно исправить', 'На согласовании', 'Согласовано'][Number(id[0])]] as const);
  }, [plans, plansSourceError, evidenceSourceError]);
  const mappingBlocked = managerMappingError && !sourceError;
  const planningBlocked = mappingBlocked || Boolean(sourceError) || plansSourceError || evidenceSourceError || supplierDebtError;
  const openForm = () =>
    window.setTimeout(
      () =>
        document
          .getElementById("payment-plan-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  function openNew(supplier = "", selectedRefs?: string[]) {
    if (planningBlocked) return;
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
    openForm();
  }
  function editPlan(plan: Plan) {
    if (planningBlocked) return;
    setChangeReason("");
    setEditingId(plan.id);
    setEditBasis(plan.orderRefs.length ? 'ORDER' : 'DEBT');
    setEditOrderRefs(plan.orderRefs);
    setEditOrderQuery('');
    const nextDraft = {
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
    openForm();
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
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (basisPreview || planningBlocked) {
      setMessage(basisPreview ? 'Проверка интерфейса: отправка отключена.' : 'Данные не загружены полностью. Обновите страницу перед сохранением.');
      return;
    }
    setSaving(true);
    setMessage("");
    const selected = supplierOrders.filter((order) =>
      draft.orderRefs.includes(order.ref),
    );
    const body = {
      basis: editBasis,
      changeReason,
      version: plans.find(plan => plan.id === editingId)?.updatedAt,
      supplierPartner: draft.supplier,
      supplierCounterparty: selected[0]?.supplierCounterparty || plans.find(plan => plan.id === editingId)?.supplierCounterparty || "",
      orderRefs: draft.orderRefs,
      orderNumbers: selected.map((order) => order.number),
      plannedDate: draft.plannedDate,
      plannedAmount: draft.plannedAmount,
      condition: draft.condition,
      paymentMethod: draft.paymentMethod,
      currency: draft.paymentMethod === "USDT" ? "USDT" : "RUB",
      foreignAmount: draft.foreignAmount,
      exchangeRate: draft.exchangeRate,
      commissionAmount: draft.commissionAmount,
      exchangerName: draft.exchangerName,
      supplierConfirmation: draft.supplierConfirmation,
    };
    try {
    const response = await fetch(
      editingId
        ? `/api/procurement/payment-plans/${editingId}`
        : "/api/procurement/payment-plans",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      data.revision ? "Изменения отправлены на согласование. До согласования действуют прежние условия." : wasEditing ? "Изменения сохранены." : "Заявка передана на согласование.",
    );
    } catch { setMessage("Нет связи с порталом. Изменения не подтверждены — проверьте заявку перед повторной отправкой."); }
    finally { setSaving(false); }
  }
  const groupTitle = (key: string) =>
    key < todayKey
      ? `Дата подготовки прошла · ${dateLabel(key)}`
      : key === todayKey
        ? "Сегодня"
        : key === nextDayKey(todayKey)
          ? "Завтра"
          : dateLabel(key);

  return (
    <div className="procurement-calendar space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">
            Платёжный календарь
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Запланируйте известные оплаты, чтобы деньги подготовили вовремя.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {!planningBlocked ? (
            <button
              onClick={() => formOpen ? openForm() : openNew()}
              className="admin-material-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-black text-white"
            >
              <Plus className="h-5 w-5" />
              Добавить оплаты
            </button>
          ) : null}
          <ProcurementDataRefresh checkedAt={checkedAt} label="Заказы 1С" />
        </div>
      </header>
      {sourceError ? (
        <Notice
          title="Заказы 1С сейчас недоступны"
          text="Сохранённые заявки видны, но создать новую можно после восстановления связи."
        />
      ) : null}
      {plansSourceError ? <Notice title="Заявки сейчас недоступны" text="Не удалось загрузить действующие заявки. Резервы неизвестны. Обновите страницу — создавать новые заявки пока нельзя." /> : null}
      {supplierDebtError ? <Notice title="Долги поставщикам сейчас не проверены" text="Сохранённые заявки видны. Обновите данные перед новой оплатой." /> : null}
      {evidenceSourceError ? (
        <Notice title="Оплаты из 1С сейчас не проверены" text="Заявки доступны, но подтверждение фактической оплаты появится после восстановления связи." />
      ) : null}
      {mappingBlocked ? (
        <Notice
          critical
          title="Профиль не сопоставлен с менеджером в 1С"
          text="Это ошибка настройки, а не отсутствие заказов. Сообщите администратору."
        />
      ) : null}

      <div className="grid gap-5 min-[1180px]:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.72fr)] min-[1180px]:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {message && !formOpen ? (
            <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
              {message}
            </p>
          ) : null}

      <section
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
        aria-hidden={formOpen || undefined}
        inert={formOpen || undefined}
      >
        <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black">Календарь оплат</h2>
            <p className="mt-1 text-sm text-slate-500">
              Согласовано — деньги одобрены, но оплата ещё не подтверждена.
            </p>
          </div>
          {!planningBlocked ? (
            <p className="text-xs font-bold text-slate-500">
              Поставщиков с долгом: {supplierDebtError ? '—' : Object.values(supplierBalances).filter(balance=>supplierPosition(balance)==='debt').length}
            </p>
          ) : null}
        </div>
        <div className="mt-5 space-y-6">
          {groupedPlans.length ? (
            groupedPlans.map(([key, datePlans, groupId, statusLabel]) => (
              <div key={groupId}>
                <div className="mb-2 flex items-center gap-2">
                  <CalendarDays
                    className={`h-4 w-4 ${key < todayKey ? "text-red-600" : "procurement-calendar-icon"}`}
                  />
                  <h3
                    className={`text-sm font-black uppercase tracking-wide ${key < todayKey ? "text-red-700" : "text-slate-700"}`}
                  >
                    {statusLabel} · {groupTitle(key)}
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                    {datePlans.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {datePlans.map((plan) => (
                    <article
                      key={plan.id}
                      className={`grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(170px,.72fr)] sm:items-center sm:p-4 min-[960px]:grid-cols-[minmax(190px,1fr)_minmax(165px,.85fr)_minmax(145px,.72fr)_104px] ${key < todayKey ? "border-red-200 bg-red-50/40" : "border-slate-200"}`}
                    >
                      <div className="min-w-0">
                        <h4 className="font-black">{plan.supplierPartner}</h4>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">
                          {!plan.orderRefs.length ? 'В счёт долга поставщику' : <>{plan.orderNumbers.filter(Boolean).length > 1
                            ? "Заказы"
                            : "Заказ"}: {" "}
                          {plan.orderNumbers.filter(Boolean).join(", ") ||
                            "без номера"}</>}
                        </p>
                        <p className={`mt-1 text-xs font-bold ${paymentPlanLeadTime(plan.createdAt, plan.plannedDate).state === "ADVANCE" ? "text-green-700" : "text-amber-700"}`}>
                          {leadTimeLabel(plan)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xl font-black">
                          {plan.paymentMethod === "USDT"
                            ? Number(plan.foreignAmount || 0) > 0
                              ? `${Number(plan.foreignAmount).toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT`
                              : rub.format(Number(plan.plannedAmount))
                            : rub.format(Number(plan.plannedAmount))}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-600">
                          {methodLabel(plan.paymentMethod)}
                        </p>
                        {plan.paymentMethod === "USDT" && !Number(plan.foreignAmount || 0) ? <ProcurementUsdtEstimate amount={Number(plan.plannedAmount)} rate={usdtRateReference?.rate} conversionAt={usdtRateReference?.conversionAt} /> : null}
                        {buyerPaymentComment(plan.condition) ? (
                          <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-600" title={buyerPaymentComment(plan.condition)}>
                            Комментарий: {buyerPaymentComment(plan.condition)}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <span
                          className={`block w-fit shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${plan.status === "APPROVED" ? "bg-green-100 text-green-800" : plan.status === "NEEDS_CHANGES" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}
                        >
                          {plan.status === "APPROVED"
                            ? plan.evidence?.state === "MISMATCH" ? "ОПЛАТА НА ПРОВЕРКЕ" : plan.evidence?.state === "PARTIALLY_ISSUED" || plan.evidence?.state === "PARTIALLY_PAID_BY_ONE_C" ? "ЧАСТИЧНО ОПЛАЧЕНО" : "СОГЛАСОВАНО"
                            : plan.status === "NEEDS_CHANGES" ? "НУЖНО ИСПРАВИТЬ" : "НА СОГЛАСОВАНИИ"}
                        </span>
                        {plan.status === "NEEDS_CHANGES" && plan.correctionReason ? <p className="max-w-[240px] text-xs font-bold text-red-700">{plan.correctionReason}</p> : null}
                        {plan.revision ? <p className="max-w-[240px] text-xs font-bold text-amber-800">Изменения на согласовании. Пока действуют прежние условия.</p> : null}
                        <ProcurementChangeHistory events={plan.events} buyerView />
                        {plan.evidence?.state === 'PARTIALLY_ISSUED' ? <p className="text-xs font-bold text-blue-800">Оплачено {rub.format(plan.evidence.issuedAmount)} · осталось по заявке {rub.format(Math.max(0, Number(plan.plannedAmount) - plan.evidence.issuedAmount))}</p> : null}
                        {plan.evidence?.paymentAmountNeedsConfirmation ? <p className="text-xs font-bold text-amber-800">Оплата найдена: {plan.evidence.paidForeignAmount.toLocaleString('ru-RU')} USDT. Выполнение заявки ещё не подтверждено.</p> : null}
                        {plan.evidence?.state === "PARTIALLY_PAID_BY_ONE_C" ? <p className="text-xs font-bold text-blue-800">Оплачено {plan.evidence.paidForeignAmount.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT · осталось {plan.evidence.remainingForeignAmount != null ? `${plan.evidence.remainingForeignAmount.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT` : rub.format(plan.evidence.remainingAmount)}</p> : null}
                      </div>
                      {!planningBlocked && !plan.revision && ["SUBMITTED", "NEEDS_CHANGES", "APPROVED"].includes(plan.status) ? (
                        <button
                          onClick={() => editPlan(plan)}
                          className="procurement-secondary-action inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Изменить
                        </button>
                      ) : (
                        <span />
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-slate-50 p-5 text-center">
              <CalendarDays className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-2 font-black text-slate-700">{plansSourceError ? 'Не удалось загрузить заявки' : basisPreview ? 'Заявки не загружены в просмотр' : paidPlans.length ? "Текущих оплат нет" : "Заявок пока нет"}</p>
              <p className="mt-1 text-sm text-slate-500">
                {planningBlocked ? 'Обновите данные, чтобы продолжить.' : paidPlans.length ? "Оплаченные заявки — в истории ниже." : "Нажмите «Добавить оплаты», чтобы создать заявку."}
              </p>
            </div>
          )}
        </div>
      </section>

      <ProcurementPaymentHistory plans={paidPlans} hidden={formOpen} />

      {!planningBlocked && reviewOrders.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" inert={formOpen || undefined} aria-hidden={formOpen || undefined}>
          <div className="flex flex-col gap-1 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Запланировать оплату</h2>
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
                    disabled={supplierPosition(order.balance)==='review'}
                    onClick={() => { const existing = workingPlans.find(plan=>plan.supplierPartner===order.supplierPartner); if (existing) editPlan(existing); else openNew(order.supplierPartner, [`debt:${order.supplierPartner}`]); }}
                    className="procurement-secondary-action inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition"
                  >
                    <Plus className="h-4 w-4" />
                    {supplierPosition(order.balance)==='review' ? 'Пока недоступно' : workingPlans.some(plan=>plan.supplierPartner===order.supplierPartner) ? 'Открыть заявку' : 'Запланировать'}
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


      {formOpen ? <section
        id="payment-plan-form"
        className="order-first w-full max-w-[1080px] self-center scroll-mt-4 rounded-2xl bg-white ring-1 ring-slate-200"
      >
        <div className="flex w-full items-center justify-between gap-4 p-4 sm:p-5">
          <div>
            <span>
              <span className="block font-black">
                {editingId ? "Изменить оплату" : "Новые оплаты"}
              </span>
              <span className="block text-sm font-medium text-slate-500">
                {editingId ? 'Измените данные оплаты' : 'Выберите → заполните суммы → передайте на согласование.'}
              </span>
            </span>
          </div>
          <button
            type="button"
            aria-label="Закрыть форму"
            disabled={saving || batchDraftState.saving}
            onClick={requestClosePaymentForm}
            className="admin-material-control flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {editingId ? (
          <form
            className="space-y-4 border-t border-slate-100 p-4 sm:p-5"
            onSubmit={submit}
          >
            <label className="block text-sm font-bold">
              Поставщик
              <select
                value={draft.supplier}
                disabled={Boolean(editingId)}
                onChange={(event) => chooseSupplier(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-semibold"
                required
              >
                <option value="">Выберите поставщика</option>
                {Array.from(new Set([draft.supplier, ...suppliers])).filter(Boolean).map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Основание оплаты">
              {(['ORDER', 'DEBT'] as const).map(basis => <button key={basis} type="button" aria-pressed={editBasis === basis}
                disabled={editBasisLocked || (basis === 'DEBT' && Boolean(editingPlan?.orderRefs.length) && supplierPosition(supplierBalances[draft.supplier]) !== 'debt')}
                onClick={() => chooseEditBasis(basis)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50 ${editBasis === basis ? 'border-slate-700 bg-slate-100' : 'border-slate-200'}`}>
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
                  {!editableOrders.length ? <p className="text-sm text-slate-500">Заказы не найдены.</p> : null}
                  {draft.orderRefs.filter(ref => !supplierOrders.some(order => order.ref === ref)).map(ref => <p key={ref} className="text-sm text-slate-600">
                    Заказ №{editingPlan?.orderNumbers[editingPlan.orderRefs.indexOf(ref)] || '—'} · уже в заявке
                  </p>)}
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Когда подготовить деньги
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
                Как оплачиваем
                <select
                  value={draft.paymentMethod}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      paymentMethod: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3"
                >
                  <option value="CASH">Наличные</option>
                  <option value="ACCOUNTABLE_QR">Оплата поставщику по QR</option>
                  <option value="USDT">Оплата в USDT</option>
                  <option value="BANK">Перевод поставщику</option>
                </select>
              </label>
            </div>
            {draft.paymentMethod === "USDT" ? (
              <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3 text-sm text-violet-950">
                <p className="font-bold">Укажите известную сумму — в рублях или USDT.</p>
              </div>
            ) : null}
            <label className="block text-sm font-bold">
                {draft.paymentMethod === "USDT" ? "Общая сумма заявки в рублях" : "Общая сумма заявки, ₽"}
                {draft.paymentMethod === "USDT" ? <span className="font-medium text-slate-400"> (если известна)</span> : null}
                <input
                  value={draft.plannedAmount}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      plannedAmount: event.target.value,
                    }))
                  }
                  type="number"
                  min="0.01"
                  step="0.01"
                  required={draft.paymentMethod !== "USDT"}
                  placeholder={draft.paymentMethod === "USDT" ? "Можно оставить пустым" : undefined}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3"
                />
            </label>
            <p className="text-xs text-slate-500">Укажите общую сумму заявки, согласованную с поставщиком, включая уже оплаченную часть. Выбор заказов не меняет её автоматически.</p>
            {draft.paymentMethod === "USDT" ? (
              <>
                <label className="block text-sm font-bold text-violet-900">
                  Сколько USDT отправить <span className="font-medium text-violet-500">(если известно)</span>
                  <input
                    value={draft.foreignAmount}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        foreignAmount: event.target.value,
                      }))
                    }
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    placeholder="Можно оставить пустым"
                    className="mt-1.5 w-full rounded-xl border border-violet-200 bg-violet-50 px-3 py-3"
                  />
                </label>
                {referenceUsdtRate > 0 && (enteredRoubles > 0 || enteredUsdt > 0) ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-black text-slate-950">
                      {enteredUsdt > 0 && enteredRoubles <= 0
                        ? `Примерно: ${rub.format(estimatedRoubles)}`
                        : `Примерно: ${estimatedUsdt.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} USDT`}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      По последнему курсу {referenceUsdtRate.toLocaleString("ru-RU")} ₽{rateDateLabel ? ` от ${rateDateLabel}` : ""} в 1С.
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Фактическая сумма определится после обмена.</p>
                  </div>
                ) : null}
              </>
            ) : null}
            <label className="block text-sm font-bold">
              Комментарий — если есть важная деталь{" "}
              <span className="font-medium text-slate-400">
                (необязательно)
              </span>
              <textarea
                value={draft.condition}
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
              <span className="mt-1.5 block text-xs font-medium text-slate-500">
                Поставщика, заказ, дату и сумму повторять не нужно.
              </span>
            </label>
            {plans.find(plan => plan.id === editingId)?.status === "APPROVED" ? <label className="block text-sm font-bold">Причина изменения *<textarea required minLength={3} maxLength={500} value={changeReason} onChange={event => setChangeReason(event.target.value)} rows={2} placeholder="Например: поставщик перенёс отгрузку" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3"/><span className="mt-1 block text-xs font-normal text-slate-500">Изменение условий требует повторного согласования. Комментарий сохраняется без него. При частичной оплате укажите новую общую сумму, включая уже оплаченную часть.</span></label> : null}
            {message ? (
              <p className="text-sm font-bold text-red-600">{message}</p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={saving}
                onClick={requestClosePaymentForm}
                className="rounded-xl bg-slate-100 px-5 py-3 font-black text-slate-700"
              >
                Отмена
              </button>
              <button
                disabled={
                  saving || planningBlocked || (editBasis === 'ORDER' && !draft.orderRefs.length) || (
                    draft.paymentMethod === "USDT"
                      ? !draft.plannedAmount && !draft.foreignAmount
                      : !draft.plannedAmount
                  )
                }
                className="admin-material-primary rounded-xl px-5 py-3 font-black text-white disabled:opacity-40"
              >
                {saving
                  ? "Сохраняю…"
                  : editingId
                    ? editingPlan?.status === 'APPROVED' && editBasis !== (editingPlan.orderRefs.length ? 'ORDER' : 'DEBT') ? 'Передать изменения' : "Сохранить"
                    : "Передать на согласование"}
              </button>
            </div>
          </form>
        ) : (
          <ProcurementPaymentBatchForm
            basisPreview={basisPreview}
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
              setMessage(
                `${created.length} оплат передано на согласование.`,
              );
            }}
          />
        )}
      </section> : null}
      <ProcurementDiscardDraftDialog open={discardOpen} editing={Boolean(editingId)}
        onKeep={() => setDiscardOpen(false)} onDiscard={closePaymentForm} />
        </div>

        <aside
          className="space-y-5 min-[1180px]:sticky min-[1180px]:top-6"
        >
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-lg font-black text-slate-900">Сводка</h2>
            <div className="mt-4 grid gap-3">
              <SummaryMetric
                label="Долг поставщикам по 1С"
                value={mappingBlocked || supplierDebtError ? "—" : rub.format(positionSummary.debt)}
                hint={positionSummary.reviewCount ? `Без ${positionSummary.reviewCount} поставщиков: долг не подтверждён` : ''}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800 ring-1 ring-amber-200">
                На согласовании: {basisPreview || plansSourceError ? '—' : plans.filter((plan) => plan.status === "SUBMITTED").length}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">
                Согласовано: {reservesUnavailable ? '—' : plans.filter((plan) => plan.status === "APPROVED" && plan.evidence?.state !== "ISSUED_BY_ONE_C" && !isCurrencyPaid(plan)).length}
              </span>
              {plans.some(plan => plan.revision) ? <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800">Изменения на согласовании: {plans.filter(plan => plan.revision).length}</span> : null}
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-black text-slate-900">Остатки касс</h3>
              <div className="mt-3 space-y-3">
                <BalanceSummary
                  title="QR · рубли"
                  availableLabel="На карте"
                  available={accountableBalance.balance == null ? "—" : rub.format(accountableBalance.balance)}
                  planned={reservesUnavailable ? '—' : rub.format(plannedQr)}
                  freeLabel={freeQr != null && freeQr < 0 ? "Не хватает" : "Свободно"}
                  free={freeQr == null ? "—" : rub.format(Math.abs(freeQr))}
                  critical={freeQr != null && freeQr < 0}
                />
                <BalanceSummary
                  title="USDT"
                  availableLabel="Доступно"
                  available={usdtBalance.balance == null ? "—" : usdtBalance.balance.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                  planned={plannedUsdt == null ? "—" : plannedUsdt.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                  freeLabel={freeUsdt != null && freeUsdt < 0 ? "Не хватает" : "Свободно"}
                  free={freeUsdt == null ? "—" : Math.abs(freeUsdt).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                  critical={freeUsdt != null && freeUsdt < 0}
                />
              </div>
            </div>

          </section>
        </aside>
      </div>
    </div>
  );
}

function SummaryMetric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <p className="min-h-8 text-xs font-bold leading-4 text-slate-500">{label}</p>
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
    <p className={`mt-0.5 truncate text-xs font-black ${critical ? "text-red-700" : "text-slate-950"}`} title={value}>{value}</p>
  </div>;
}
