"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Pencil,
  Plus,
  RefreshCw,
  RussianRuble,
  X,
} from "lucide-react";
import { ProcurementPaymentBatchForm } from "./ProcurementPaymentBatchForm";
import { calculateOrderPlanning, paymentPlanLeadTime } from "@/lib/procurement-payment-control";

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
  const supplierDebtTotals = initialOrders.reduce<Record<string, number>>((totals, order) => {
    totals[order.supplierPartner] = Number(totals[order.supplierPartner] || 0) + Number(order.supplierDebt || 0);
    return totals;
  }, {});
  const totalSupplierDebt = Object.values(supplierDebtTotals).reduce((sum, value) => sum + value, 0);
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
  function openNew(supplier = "") {
    const refs = missingOrders
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
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#58a908]">
            Закупки
          </p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">
            Платёжный календарь
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Укажите дату и сумму заранее, чтобы деньги успели подготовить.
          </p>
        </div>
        <div className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
          <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" />
          Заказы 1С:{" "}
          {checkedAt
            ? new Date(checkedAt).toLocaleString("ru-RU")
            : "данные недоступны"}
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

      <section
        className="rounded-2xl border border-slate-200 bg-white p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p
              className="text-xs font-black uppercase tracking-wide text-slate-500"
            >
              Ближайшее действие
            </p>
            <h2 className="mt-1 text-xl font-black">
              {mappingBlocked
                ? "Нужно исправить связь с 1С"
                : missingOrders.length
                  ? "Добавьте следующую известную оплату"
                  : "Все известные оплаты уже в календаре"}
            </h2>
            <p
              className="mt-1 text-sm font-medium text-slate-600"
            >
              {mappingBlocked
                ? "Количество намеренно не показывается."
                : missingOrders.length
                  ? `В 1С сейчас ${orderCountLabel(missingOrders.length)} с остатком к оплате. Не нужно заполнять их все сразу.`
                  : "Новых действий сейчас нет."}
            </p>
          </div>
          {!mappingBlocked && !sourceError ? (
            <button
              onClick={() => openNew()}
              className="admin-material-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-black text-white"
            >
              <Plus className="h-5 w-5" />
              Добавить оплаты
            </button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Заказы с остатком к оплате"
          value={mappingBlocked || sourceError ? "—" : missingOrders.length}
        />
        <Metric
          label="Общая задолженность в 1С"
          value={mappingBlocked || sourceError ? "—" : rub.format(totalSupplierDebt)}
          compact
        />
        <Metric
          label="Ожидают согласования"
          value={plans.filter((plan) => plan.status === "SUBMITTED").length}
        />
        <Metric
          label="Согласовано к оплате"
          value={plans.filter((plan) => plan.status === "APPROVED").length}
        />
      </section>
      {message && !formOpen ? (
        <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
          {message}
        </p>
      ) : null}

      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
        <h2 className="text-lg font-black">Календарь оплат</h2>
        <p className="mt-1 text-sm text-slate-500">
          Оплаты сгруппированы по дате, когда нужно подготовить деньги.
        </p>
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
                      className={`grid gap-3 rounded-xl border p-3 sm:p-4 md:grid-cols-[minmax(220px,1.2fr)_minmax(190px,0.8fr)_auto_auto] md:items-center ${key < todayKey ? "border-red-200 bg-red-50/40" : "border-slate-200"}`}
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
                          className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 md:justify-self-end"
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
        </div>
      </section>

      {paidPlans.length ? (
        <details className="rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer font-black text-slate-800">История оплаченных · {paidPlans.length}</summary>
          <div className="mt-3 divide-y divide-slate-100">
            {paidPlans.map((plan) => <div key={plan.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-extrabold">{plan.supplierPartner}</p><p className="text-xs font-semibold text-slate-500">Заказ: {plan.orderNumbers.filter(Boolean).join(", ") || "без номера"}</p></div><p className="font-black text-blue-800">Оплачено по 1С · {rub.format(Number(plan.evidence?.issuedAmount || plan.plannedAmount))}</p></div>)}
          </div>
        </details>
      ) : null}

      {formOpen ? <section
        id="payment-plan-form"
        className="scroll-mt-4 rounded-2xl bg-white ring-1 ring-slate-200"
      >
        <div className="flex w-full items-center justify-between gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-green-100 p-2 text-green-700">
              <Plus className="h-5 w-5" />
            </span>
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
            supplierDebtTotals={supplierDebtTotals}
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

    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <RussianRuble className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
        <div className="min-w-0 flex-1">
          <div>
            <p className="font-black text-blue-950">Деньги для оплат по QR</p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <BalanceValue label="На карте" value={accountableBalance.balance == null ? "—" : rub.format(accountableBalance.balance)} />
              <BalanceValue label="В заявках" value={rub.format(plannedQr)} />
              <BalanceValue label={freeQr != null && freeQr < 0 ? "Не хватает" : "Свободно"} value={freeQr == null ? "—" : rub.format(Math.abs(freeQr))} critical={freeQr != null && freeQr < 0} />
            </div>
          </div>
        </div>
      </div>
    </section>
    <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <div className="flex items-start gap-3">
          <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
          <div className="min-w-0 flex-1">
            <div>
              <p className="font-black text-violet-950">Деньги для оплат в USDT</p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <BalanceValue label="Доступно" value={usdtBalance.balance == null ? "—" : `${usdtBalance.balance.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} USDT`} />
                <BalanceValue label="В заявках" value={`${plannedUsdt.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} USDT`} />
                <BalanceValue label={freeUsdt != null && freeUsdt < 0 ? "Не хватает" : "Свободно"} value={freeUsdt == null ? "—" : `${Math.abs(freeUsdt).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} USDT`} critical={freeUsdt != null && freeUsdt < 0} />
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-slate-500" />
          <div>
            <p className="font-extrabold text-slate-800">
              После оплаты ничего отмечать не нужно
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Портал получит подтверждение из проведённого расходного документа
              в 1С.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string | number; compact?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className={`mt-2 font-black ${compact ? "text-xl sm:text-2xl" : "text-3xl"}`}>{value}</p>
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

function BalanceValue({ label, value, critical = false }: { label: string; value: string; critical?: boolean }) {
  return <div className="min-w-0">
    <p className="text-[11px] font-bold text-slate-500">{label}</p>
    <p className={`mt-1 truncate text-sm font-black sm:text-base ${critical ? "text-red-700" : "text-slate-950"}`}>{value}</p>
  </div>;
}
