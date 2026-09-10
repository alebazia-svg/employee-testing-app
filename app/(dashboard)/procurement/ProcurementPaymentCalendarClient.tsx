"use client";

import { useEffect, useMemo, useState } from "react";
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
import { buildProcurementReviewQueue } from "@/lib/procurement-payment-priority";

type Order = {
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
  evidence?: {
    state: string;
    issuedAmount: number;
    actualSupplier?: string;
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
  maximumFractionDigits: 0,
});
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
  if (timing.state === "SAME_DAY") return "Внесено в день оплаты";
  if (timing.state === "NEXT_DAY") return "Внесено за день";
  if (timing.state === "LATE") return "Дата оплаты уже прошла";
  return timing.days == null ? "" : `Внесено заранее · за ${timing.days} дн.`;
};

export default function ProcurementPaymentCalendarClient({
  initialOrders,
  initialPlans,
  checkedAt,
  sourceError,
  managerMappingError,
  supplierBalances,
  supplierDebtTotal,
  supplierDebtError,
  usdtBalance,
  accountableBalance,
  usdtRateReference,
  todayKey,
}: {
  initialOrders: Order[];
  initialPlans: Plan[];
  checkedAt: string;
  sourceError: string;
  managerMappingError: boolean;
  supplierBalances: Record<string, SupplierBalance>;
  supplierDebtTotal: number | null;
  supplierDebtError: boolean;
  usdtBalance: UsdtBalance;
  accountableBalance: UsdtBalance;
  usdtRateReference?: UsdtRateReference;
  todayKey: string;
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [batchSeedRefs, setBatchSeedRefs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAllReviewOrders, setShowAllReviewOrders] = useState(false);
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
  const rateDate = usdtRateReference?.conversionAt || usdtRateReference?.checkedAt || "";
  const parsedRateDate = rateDate ? new Date(rateDate) : null;
  const rateDateLabel = parsedRateDate && !Number.isNaN(parsedRateDate.getTime())
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(parsedRateDate)
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
  const activePlans = plans.filter((plan) => plan.status !== "CANCELLED");
  const paidPlans = activePlans.filter((plan) => plan.evidence?.state === "ISSUED_BY_ONE_C");
  const workingPlans = activePlans.filter((plan) => plan.evidence?.state !== "ISSUED_BY_ONE_C");
  const planningOrders = calculateOrderPlanning(
    initialOrders,
    activePlans.map((plan) => ({
      orderRefs: plan.orderRefs,
      plannedAmount: Number(plan.plannedAmount),
      status: plan.status,
      issuedAmount: plan.evidence?.state === "MISMATCH" ? 0 : Number(plan.evidence?.issuedAmount || 0),
    })),
  );
  const missingOrders = planningOrders.filter((order) => order.unplannedAmount > 0.009);
  const reviewOrders = buildProcurementReviewQueue(missingOrders, todayKey);
  const primaryReviewOrders = reviewOrders.reduce<typeof reviewOrders>((selected, order) => {
    if (selected.length >= 3 || selected.some((item) => item.reviewReason === order.reviewReason)) return selected;
    return [...selected, order];
  }, []);
  const visibleReviewOrders = showAllReviewOrders
    ? reviewOrders
    : reviewOrders.reduce<typeof reviewOrders>((selected, order) => {
        if (selected.length >= 3 || selected.some((item) => item.ref === order.ref)) return selected;
        return [...selected, order];
      }, primaryReviewOrders);
  const orderPaymentGapTotal = initialOrders.reduce((sum, order) => sum + Number(order.orderPaymentGap || 0), 0);
  const supplierOrderGapTotals = initialOrders.reduce<Record<string, number>>((totals, order) => {
    totals[order.supplierPartner] = Number(totals[order.supplierPartner] || 0) + Number(order.orderPaymentGap || 0);
    return totals;
  }, {});
  const unpaidActivePlans = activePlans.map((plan) => ({
    ...plan,
    remainingRub: Math.max(0, Number(plan.plannedAmount) - (plan.evidence?.state === "MISMATCH" ? 0 : Number(plan.evidence?.issuedAmount || 0))),
  })).filter((plan) => plan.remainingRub > 0.009);
  const plannedQr = unpaidActivePlans
    .filter((plan) => plan.paymentMethod === "ACCOUNTABLE_QR")
    .reduce((sum, plan) => sum + plan.remainingRub, 0);
  const plannedUsdt = unpaidActivePlans
    .filter((plan) => plan.paymentMethod === "USDT")
    .reduce((sum, plan) => {
      const originalRub = Number(plan.plannedAmount || 0);
      const knownUsdt = Number(plan.foreignAmount || 0);
      if (knownUsdt > 0 && originalRub > 0) return sum + knownUsdt * Math.min(1, plan.remainingRub / originalRub);
      return sum + (referenceUsdtRate > 0 ? plan.remainingRub / referenceUsdtRate : 0);
    }, 0);
  const freeQr = accountableBalance.balance == null ? null : accountableBalance.balance - plannedQr;
  const freeUsdt = usdtBalance.balance == null ? null : usdtBalance.balance - plannedUsdt;
  const groupedPlans = useMemo(() => {
    const groups = new Map<string, Plan[]>();
    [...workingPlans]
      .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
      .forEach((plan) => {
        const key = dateKey(plan.plannedDate);
        groups.set(key, [...(groups.get(key) || []), plan]);
      });
    return [...groups.entries()];
  }, [plans]);
  const mappingBlocked = managerMappingError && !sourceError;

  const estimateRoubles = (refs: string[]) => {
    const selected = planningOrders.filter((order) => refs.includes(order.ref));
    const gaps = selected.reduce(
      (sum, order) => sum + Math.max(0, order.unplannedAmount),
      0,
    );
    return (
      gaps ||
      selected.reduce((sum, order) => sum + Math.max(0, order.amount), 0)
    );
  };
  const openForm = () =>
    window.setTimeout(
      () =>
        document
          .getElementById("payment-plan-form")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  function openNew(supplier = "", selectedRefs?: string[]) {
    const refs = selectedRefs || missingOrders
      .filter((order) => order.supplierPartner === supplier)
      .map((order) => order.ref);
    setEditingId("");
    setBatchSeedRefs(refs);
    setDraft({
      ...emptyDraft(),
      supplier,
      orderRefs: refs,
      plannedAmount: refs.length ? String(estimateRoubles(refs)) : "",
    });
    setMessage("");
    setFormOpen(true);
    openForm();
  }
  function editPlan(plan: Plan) {
    setEditingId(plan.id);
    setDraft({
      supplier: plan.supplierPartner,
      orderRefs: plan.orderRefs,
      plannedDate: dateKey(plan.plannedDate),
      plannedAmount: String(plan.plannedAmount),
      condition:
        plan.condition === "Оплата по выбранным заказам" ? "" : plan.condition,
      paymentMethod: plan.paymentMethod,
      foreignAmount: plan.foreignAmount || "",
      exchangeRate: plan.exchangeRate || "",
      commissionAmount: plan.commissionAmount || "",
      exchangerName: plan.exchangerName || "",
      supplierConfirmation: plan.supplierConfirmation || "",
    });
    setMessage("");
    setFormOpen(true);
    openForm();
  }
  function chooseSupplier(supplier: string) {
    const refs = missingOrders
      .filter((order) => order.supplierPartner === supplier)
      .map((order) => order.ref);
    setDraft((current) => ({
      ...current,
      supplier,
      orderRefs: refs,
      plannedAmount: refs.length ? String(estimateRoubles(refs)) : "",
    }));
    setMessage("");
  }
  function toggleOrder(ref: string, checked: boolean) {
    const refs = checked
      ? [...draft.orderRefs, ref]
      : draft.orderRefs.filter((value) => value !== ref);
    setDraft((current) => ({
      ...current,
      orderRefs: refs,
      plannedAmount: String(estimateRoubles(refs) || ""),
    }));
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const selected = supplierOrders.filter((order) =>
      draft.orderRefs.includes(order.ref),
    );
    const body = {
      supplierPartner: draft.supplier,
      supplierCounterparty: selected[0]?.supplierCounterparty || "",
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
      wasEditing ? "Изменения сохранены." : "Заявка передана на согласование.",
    );
  }
  const groupTitle = (key: string) =>
    key < todayKey
      ? `Просрочено · ${dateLabel(key)}`
      : key === todayKey
        ? "Сегодня"
        : key === nextDayKey(todayKey)
          ? "Завтра"
          : dateLabel(key);

  return (
    <div className="space-y-5">
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
          {!mappingBlocked && !sourceError && !formOpen ? (
            <button
              onClick={() => openNew()}
              className="admin-material-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 font-black text-white"
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
              По датам, когда нужно подготовить деньги.
            </p>
          </div>
          {!mappingBlocked && !sourceError ? (
            <p className="text-xs font-bold text-slate-500">
              Ещё не запланировано: {orderCountLabel(missingOrders.length)}
            </p>
          ) : null}
        </div>
        <div className="mt-5 space-y-6">
          {groupedPlans.length ? (
            groupedPlans.map(([key, datePlans]) => (
              <div key={key}>
                <div className="mb-2 flex items-center gap-2">
                  <CalendarDays
                    className={`h-4 w-4 ${key < todayKey ? "text-red-600" : "text-[#58a908]"}`}
                  />
                  <h3
                    className={`text-sm font-black uppercase tracking-wide ${key < todayKey ? "text-red-700" : "text-slate-700"}`}
                  >
                    {groupTitle(key)}
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                    {datePlans.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {datePlans.map((plan) => (
                    <article
                      key={plan.id}
                      className={`grid gap-3 rounded-xl border p-3 sm:p-4 md:grid-cols-[minmax(240px,1fr)_minmax(190px,220px)_minmax(150px,180px)_112px] md:items-center ${key < todayKey ? "border-red-200 bg-red-50/40" : "border-slate-200"}`}
                    >
                      <div className="min-w-0">
                        <h4 className="font-black">{plan.supplierPartner}</h4>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">
                          {plan.orderNumbers.filter(Boolean).length > 1
                            ? "Заказы"
                            : "Заказ"}: {" "}
                          {plan.orderNumbers.filter(Boolean).join(", ") ||
                            "без номера"}
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
                          {plan.paymentMethod === "USDT" && !Number(plan.foreignAmount || 0)
                            ? " · сумма USDT уточняется"
                            : ""}
                          {plan.condition &&
                          plan.condition !== "Оплата по выбранным заказам"
                            ? ` · ${plan.condition}`
                            : ""}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span
                          className={`block w-fit shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${plan.status === "APPROVED" ? "bg-green-100 text-green-800" : plan.status === "NEEDS_CHANGES" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}
                        >
                          {plan.status === "APPROVED"
                            ? plan.evidence?.state === "MISMATCH" ? "ПРОВЕРЯЕТ РУКОВОДИТЕЛЬ" : plan.evidence?.state === "PARTIALLY_ISSUED" ? "ЧАСТИЧНО ОПЛАЧЕНО" : "СОГЛАСОВАНО"
                            : plan.status === "NEEDS_CHANGES" ? "НУЖНО ИСПРАВИТЬ" : "НА СОГЛАСОВАНИИ"}
                        </span>
                        {plan.status === "NEEDS_CHANGES" && plan.correctionReason ? <p className="max-w-[240px] text-xs font-bold text-red-700">{plan.correctionReason}</p> : null}
                      </div>
                      {plan.status === "SUBMITTED" || plan.status === "NEEDS_CHANGES" ? (
                        <button
                          onClick={() => editPlan(plan)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700"
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
            <div className="rounded-2xl bg-slate-50 p-6 text-center">
              <CalendarDays className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-2 font-black text-slate-700">Заявок пока нет</p>
              <p className="mt-1 text-sm text-slate-500">
                Экран пуст, потому что оплаты ещё не вносили.
              </p>
            </div>
          )}
          {!mappingBlocked && !sourceError && !formOpen ? (
            <button
              type="button"
              onClick={() => openNew()}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3 text-sm font-black text-slate-600 transition hover:border-green-400 hover:bg-green-50/50 hover:text-green-800"
            >
              <Plus className="h-4 w-4" />
              {workingPlans.length ? "Добавить ещё одну оплату" : "Добавить первую оплату"}
            </button>
          ) : null}
        </div>
      </section>

      {!mappingBlocked && !sourceError ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-1 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Что стоит проверить</h2>
              <p className="mt-1 text-sm text-slate-500">
                Заказы с повышенным риском по данным 1С. Точную дату уточните у поставщика.
              </p>
            </div>
            {reviewOrders.length ? (
              <p className="shrink-0 text-xs font-bold text-slate-500">
                Найдено: {orderCountLabel(reviewOrders.length)}
              </p>
            ) : null}
          </div>

          {visibleReviewOrders.length ? (
            <div className="mt-2 divide-y divide-slate-100">
              {visibleReviewOrders.map((order) => (
                <article
                  key={order.ref}
                  className="grid gap-3 py-3 sm:grid-cols-[minmax(220px,1fr)_minmax(160px,0.55fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="font-black text-slate-950">{order.supplierPartner}</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">
                      Заказ № {order.number || "без номера"} · {orderDateLabel(order.date)}
                    </p>
                    {order.orderComment ? (
                      <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-600" title={order.orderComment}>
                        Комментарий: {order.orderComment}
                      </p>
                    ) : null}
                    <p className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
                      {order.reviewReason}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500">Не запланировано</p>
                    <p className="mt-0.5 text-base font-black text-slate-950">
                      {rub.format(order.unplannedAmount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openNew(order.supplierPartner, [order.ref])}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-green-50 hover:text-green-800"
                  >
                    <Plus className="h-4 w-4" />
                    Запланировать
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
              Нет заказов, требующих первоочередной проверки.
            </div>
          )}

          {reviewOrders.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAllReviewOrders((current) => !current)}
              className="mt-2 text-sm font-black text-slate-600 hover:text-green-800"
            >
              {showAllReviewOrders
                ? "Свернуть список"
                : `Показать остальные ${reviewOrders.length - 3}`}
            </button>
          ) : null}
        </section>
      ) : null}

      {paidPlans.length ? (
        <details
          className="rounded-2xl border border-slate-200 bg-white p-4"
          aria-hidden={formOpen || undefined}
          inert={formOpen || undefined}
        >
          <summary className="cursor-pointer font-black text-slate-800">История оплаченных · {paidPlans.length}</summary>
          <div className="mt-3 divide-y divide-slate-100">
            {paidPlans.map((plan) => <div key={plan.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-extrabold">{plan.supplierPartner}</p><p className="text-xs font-semibold text-slate-500">Заказ: {plan.orderNumbers.filter(Boolean).join(", ") || "без номера"}</p></div><p className="font-black text-blue-800">Оплачено по 1С · {rub.format(Number(plan.evidence?.issuedAmount || plan.plannedAmount))}</p></div>)}
          </div>
        </details>
      ) : null}

      {formOpen ? <section
        id="payment-plan-form"
        className="order-first w-full max-w-[1080px] self-center scroll-mt-4 rounded-2xl bg-white ring-1 ring-slate-200"
      >
        <div className="flex w-full items-center justify-between gap-4 p-4 sm:p-5">
          <div>
            <span>
              <span className="block font-black">
                {editingId ? "Изменить оплату" : "Новый список оплат"}
              </span>
              <span className="block text-sm font-medium text-slate-500">
                Только самое необходимое
              </span>
            </span>
          </div>
          <button
            type="button"
            aria-label="Закрыть форму"
            onClick={() => {
              setFormOpen(false);
              setEditingId("");
              setBatchSeedRefs([]);
              setDraft(emptyDraft());
            }}
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
                onChange={(event) => chooseSupplier(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-semibold"
                required
              >
                <option value="">Выберите поставщика</option>
                {suppliers.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            {draft.supplier ? (
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3 text-sm font-bold">
                  <span>Заказы поставщика</span>
                  <span className="text-slate-500">
                    Выбрано: {draft.orderRefs.length}
                  </span>
                </div>
                <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                  {supplierOrders.map((order) => (
                    <label
                      key={order.ref}
                      className="flex cursor-pointer gap-3 rounded-lg bg-white p-3 ring-1 ring-slate-200"
                    >
                      <input
                        type="checkbox"
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
                          {orderDateLabel(order.date)} · по данным 1С{" "}
                          {rub.format(order.orderPaymentGap)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Когда нужна оплата
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
                {draft.paymentMethod === "USDT" ? "Сумма в рублях" : "Сколько рублей подготовить"}
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
            {message ? (
              <p className="text-sm font-bold text-red-600">{message}</p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setEditingId("");
                  setDraft(emptyDraft());
                }}
                className="rounded-xl bg-slate-100 px-5 py-3 font-black text-slate-700"
              >
                Отмена
              </button>
              <button
                disabled={
                  saving || !draft.orderRefs.length || (
                    draft.paymentMethod === "USDT"
                      ? !draft.plannedAmount && !draft.foreignAmount
                      : !draft.plannedAmount
                  )
                }
                className="admin-material-primary rounded-xl bg-green-600 px-5 py-3 font-black text-white disabled:opacity-40"
              >
                {saving
                  ? "Сохраняю…"
                  : editingId
                    ? "Сохранить"
                    : "Передать на согласование"}
              </button>
            </div>
          </form>
        ) : (
          <ProcurementPaymentBatchForm
            key={batchSeedRefs.join("|")}
            orders={missingOrders}
            supplierBalances={supplierBalances}
            supplierOrderGapTotals={supplierOrderGapTotals}
            initialSelectedRefs={batchSeedRefs}
            usdtRateReference={usdtRateReference}
            onCancel={() => {
              setFormOpen(false);
              setBatchSeedRefs([]);
            }}
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
        </div>

        <aside
          className="space-y-5 min-[1180px]:sticky min-[1180px]:top-6"
        >
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-lg font-black text-slate-900">Сводка</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <SummaryMetric
                label="Осталось оплатить по заказам"
                value={mappingBlocked || sourceError ? "—" : rub.format(orderPaymentGapTotal)}
                hint={mappingBlocked || sourceError ? undefined : `${orderCountLabel(initialOrders.length)} с остатком в 1С`}
              />
              <SummaryMetric
                label="Долг за полученный товар"
                value={mappingBlocked || supplierDebtError || supplierDebtTotal == null ? "—" : rub.format(supplierDebtTotal)}
                hint="Взаиморасчёты 1С"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-800 ring-1 ring-amber-200">
                На согласовании: {plans.filter((plan) => plan.status === "SUBMITTED").length}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">
                Согласовано: {plans.filter((plan) => plan.status === "APPROVED").length}
              </span>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <h3 className="text-sm font-black text-slate-900">Доступно для оплат</h3>
              <div className="mt-3 space-y-3">
                <BalanceSummary
                  title="QR · рубли"
                  availableLabel="На карте"
                  available={accountableBalance.balance == null ? "—" : rub.format(accountableBalance.balance)}
                  planned={rub.format(plannedQr)}
                  freeLabel={freeQr != null && freeQr < 0 ? "Не хватает" : "Свободно"}
                  free={freeQr == null ? "—" : rub.format(Math.abs(freeQr))}
                  critical={freeQr != null && freeQr < 0}
                />
                <BalanceSummary
                  title="USDT"
                  availableLabel="Доступно"
                  available={usdtBalance.balance == null ? "—" : usdtBalance.balance.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                  planned={plannedUsdt.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                  freeLabel={freeUsdt != null && freeUsdt < 0 ? "Не хватает" : "Свободно"}
                  free={freeUsdt == null ? "—" : Math.abs(freeUsdt).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                  critical={freeUsdt != null && freeUsdt < 0}
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2.5 border-t border-slate-200 pt-4">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-slate-500" />
              <p className="text-xs font-semibold leading-relaxed text-slate-600">
                После оплаты ничего отмечать не нужно — подтверждение появится из 1С.
              </p>
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
