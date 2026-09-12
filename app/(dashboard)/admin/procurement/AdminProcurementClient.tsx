"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarCheck,
  Check,
  Undo2,
  WalletCards,
  X,
} from "lucide-react";
import { calculateCashPreparation, paymentPlanLeadTime } from "@/lib/procurement-payment-control";
import { ProcurementDataRefresh } from "@/components/ProcurementDataRefresh";

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
  orderContext?: {
    number: string;
    text: string;
  }[];
  manager: { name: string };
  evidence: {
    state: string;
    issuedAmount: number;
    actualSupplier?: string;
    paidAmount: number;
    paidForeignAmount: number;
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
  initialPlans,
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
}: {
  initialPlans: Plan[];
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
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [busy, setBusy] = useState("");
  const [returningId, setReturningId] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  useEffect(() => setPlans(initialPlans), [initialPlans]);
  const active = plans.filter((plan) => plan.status !== "CANCELLED");
  const isCurrencyPaid = (plan: Plan) => plan.evidence.state === "PAID_BY_ONE_C";
  const submitted = active.filter((plan) => plan.status === "SUBMITTED" && !isCurrencyPaid(plan));
  const completedPlans = active.filter((plan) => plan.status === "APPROVED" && (plan.evidence.state === "ISSUED_BY_ONE_C" || isCurrencyPaid(plan)));
  const calendarPlans = active.filter((plan) => plan.status === "APPROVED" && plan.evidence.state !== "ISSUED_BY_ONE_C" && !isCurrencyPaid(plan));
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
  const rateDate = usdtRateReference?.conversionAt || usdtRateReference?.checkedAt || "";
  const parsedRateDate = rateDate ? new Date(rateDate) : null;
  const rateDateLabel = parsedRateDate && !Number.isNaN(parsedRateDate.getTime())
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(parsedRateDate)
    : "";
  const groupedPlans = useMemo(() => {
    const ordered = [...calendarPlans].sort(
      (a, b) =>
        a.plannedDate.localeCompare(b.plannedDate),
    );
    const groups = new Map<string, Plan[]>();
    ordered.forEach((plan) => {
      const key = dateKey(plan.plannedDate);
      groups.set(key, [...(groups.get(key) || []), plan]);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [calendarPlans]);
  const preparation = calculateCashPreparation(
    active.map((plan) => {
      const plannedRub = Number(plan.plannedAmount);
      const remainingRub = isCurrencyPaid(plan) ? 0 : Math.max(0, plannedRub - (plan.evidence.state === "MISMATCH" ? 0 : Number(plan.evidence.issuedAmount || 0) + Number(plan.evidence.paidAmount || 0)));
      const remainingRatio = plannedRub > 0 ? Math.min(1, remainingRub / plannedRub) : 0;
      const fullForeignAmount = plan.evidence.remainingForeignAmount != null && plan.evidence.state === "PARTIALLY_PAID_BY_ONE_C"
        ? plan.evidence.remainingForeignAmount
        : Number(plan.foreignAmount || 0) || (estimatedUsdtPlanIds.has(plan.id) ? plannedRub / referenceUsdtRate : 0);
      return {
        id: plan.id,
        plannedDate: plan.plannedDate,
        plannedAmount: remainingRub,
        paymentMethod: plan.paymentMethod,
        foreignAmount: plan.evidence.state === "PARTIALLY_PAID_BY_ONE_C" && plan.evidence.remainingForeignAmount != null
          ? fullForeignAmount
          : fullForeignAmount * remainingRatio,
        exchangeRate: Number(plan.exchangeRate || 0) || (referenceRatePlanIds.has(plan.id) ? referenceUsdtRate : 0),
        commissionAmount: Number(plan.commissionAmount || 0),
        issued: plan.evidence.state === "ISSUED_BY_ONE_C" || isCurrencyPaid(plan),
      };
    }),
    usdtBalance.balance,
    todayKey,
  );
  const nextDate = preparation.rows[0]?.plannedDate.slice(0, 10);
  const nextPlans = nextDate
    ? preparation.rows.filter(
        (row) => row.plannedDate.slice(0, 10) === nextDate,
      )
    : [];
  const nextAmount = nextPlans.reduce((sum, row) => sum + row.cashRequired, 0);
  const nextAmountEstimated = nextPlans.some((row) => row.estimated || referenceRatePlanIds.has(row.planId));
  const nextPlanMethods = nextPlans.map((row) => active.find((plan) => plan.id === row.planId)?.paymentMethod).filter(Boolean);
  const nextPreparationLabel = nextPlanMethods.every((method) => method === "CASH")
    ? "Наличные из сейфа"
    : nextPlanMethods.every((method) => method === "USDT")
      ? "Ориентир на пополнение USDT"
      : "Наличные и пополнение USDT";
  const plannedUsdt = preparation.plannedUsdt;
  const unknownUsdtCount = preparation.unknownUsdtCount;
  const estimatedUsdtCount = estimatedUsdtPlanIds.size;
  const usdtDeficit = preparation.usdtDeficit;
  const usdtRemainder =
    usdtBalance.balance == null || unknownUsdtCount > 0
      ? null
      : Math.max(0, usdtBalance.balance - plannedUsdt);
  const plannedQr = active
    .filter((plan) => plan.paymentMethod === "ACCOUNTABLE_QR" && dateKey(plan.plannedDate) >= todayKey && plan.evidence.state !== "ISSUED_BY_ONE_C")
    .reduce((sum, plan) => sum + Math.max(0, Number(plan.plannedAmount || 0) - (plan.evidence.state === "MISMATCH" ? 0 : Number(plan.evidence.issuedAmount || 0))), 0);
  const qrShortfall = accountableBalance.balance == null ? null : Math.max(0, plannedQr - accountableBalance.balance);
  const groupTitle = (key: string) =>
    key < todayKey
      ? `Просрочено · ${date(key)}`
      : key === todayKey
        ? "Сегодня"
        : key === nextDayKey(todayKey)
          ? "Завтра"
          : date(key);
  const methodLabel = (plan: Plan) =>
    plan.paymentMethod === "USDT"
      ? "Оплата в USDT"
      : plan.paymentMethod === "CASH"
        ? "Наличные"
        : plan.paymentMethod === "ACCOUNTABLE_QR"
          ? "Оплата по QR"
          : "Перевод поставщику";
  const amountLabel = (plan: Plan) =>
    plan.paymentMethod === "USDT" && Number(plan.foreignAmount || 0) > 0
      ? `${Number(plan.foreignAmount).toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT`
      : rub.format(Number(plan.plannedAmount));
  const estimatedUsdtForPlan = (plan: Plan) =>
    estimatedUsdtPlanIds.has(plan.id) ? Number(plan.plannedAmount) / referenceUsdtRate : 0;
  const usdtEstimateNote = (plan: Plan) => {
    const amount = estimatedUsdtForPlan(plan);
    if (!amount) return "Сумма USDT и курс уточняются";
    return `Примерно ${amount.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} USDT · последний курс ${referenceUsdtRate.toLocaleString("ru-RU")} ₽${rateDateLabel ? ` от ${rateDateLabel}` : ""} в 1С`;
  };
  const orderLabel = (plan: Plan) =>
    plan.orderNumbers?.filter(Boolean).length
      ? plan.orderNumbers.filter(Boolean).join(", ")
      : "Без номера";
  const planComment = (plan: Plan) =>
    plan.condition && plan.condition !== "Оплата по выбранным заказам"
      ? plan.condition
      : "";

  async function act(id: string, action: "APPROVE" | "RETURN" | "CANCEL") {
    if (action === "CANCEL" && !window.confirm("Отменить эту оплату? Она исчезнет из рабочего календаря.")) return;
    if (action === "RETURN" && returnReason.trim().length < 3) {
      setActionMessage("Коротко укажите, что Астемиру нужно исправить.");
      return;
    }
    setBusy(id);
    setActionMessage("");
    const response = await fetch(`/api/admin/procurement/payment-plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: action === "RETURN" ? returnReason : undefined }),
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
    } else {
      const payload = await response.json().catch(() => ({}));
      setActionMessage(payload.error || "Не удалось выполнить действие.");
    }
    setBusy("");
  }

  return (
    <div className="space-y-5">
      {sourceWarnings.length ? (
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          Часть данных 1С сейчас недоступна: {sourceWarnings.join(", ")}.
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(170px,.65fr))]">
        <div className="admin-material-card rounded-2xl bg-white p-5">
          <div className="flex items-start gap-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${sourceWarnings.length ? "bg-amber-50 text-amber-700" : nextDate ? "bg-[#eef2f8] text-[#263b5c]" : "bg-green-50 text-green-700"}`}>
              <Banknote className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Ближайшая подготовка</p>
              {nextDate ? (
                <>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <p className="text-2xl font-black text-slate-950">{nextAmountEstimated ? "≈ " : ""}{rub.format(nextAmount)}</p>
                    <p className="text-base font-extrabold text-slate-700">к {date(nextDate)}</p>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {nextPreparationLabel} · {nextPlans.length} {nextPlans.length === 1 ? "оплата" : "оплаты"}
                    {nextAmountEstimated ? " · сумма ориентировочная" : ""}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-2xl font-black text-slate-950">Пока ничего готовить не нужно</p>
                  <p className="mt-1 text-sm font-medium text-slate-500">Нет будущих оплат, требующих наличных.</p>
                </>
              )}
            </div>
          </div>
        </div>
        <div className={`admin-material-card rounded-2xl bg-white p-5 ${submitted.length ? "ring-2 ring-amber-200" : ""}`}>
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Ждут решения</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{submitted.length}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">заявок Астемира</p>
          {urgentSubmitted.length ? <p className="mt-1 text-xs font-black text-red-700">Из них срочно сегодня: {urgentSubmitted.length}</p> : null}
        </div>
        <div className="admin-material-card rounded-2xl bg-white p-5">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Осталось оплатить по заказам</p>
          <p className="mt-1 text-xl font-black text-slate-950">{orderPaymentGapTotal == null ? "—" : rub.format(orderPaymentGapTotal)}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">{openOrderCount == null ? "Нет данных" : `${openOrderCount} заказов · не включено в календарь: ${unplannedOrderCount ?? "—"}`}</p>
        </div>
        <div className="admin-material-card rounded-2xl bg-white p-5">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Долг за полученный товар</p>
          <p className="mt-1 text-xl font-black text-slate-950">{supplierDebtTotal == null ? "—" : rub.format(supplierDebtTotal)}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">По взаиморасчётам с поставщиками Астемира в 1С</p>
        </div>
      </section>

      {unplannedCashCount && unplannedCashCount > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Найдено выдач вне календаря: {unplannedCashCount}. Проверьте проведённые РКО.
        </div>
      ) : null}

      <section className="admin-material-card rounded-2xl bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Остатки для оплат</h2>
            <p className="text-sm font-medium text-slate-500">Фактические остатки и уже запланированные суммы.</p>
          </div>
          <ProcurementDataRefresh checkedAt={sourceCheckedAt} />
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2">
              <WalletCards className="h-4 w-4 text-slate-500" />
              <h3 className="font-extrabold text-slate-900">Деньги на карте Астемира для QR</h3>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div><p className="text-xs font-bold text-slate-500">Доступно</p><p className="mt-1 font-black text-slate-950">{accountableBalance.balance == null ? "—" : rub.format(accountableBalance.balance)}</p></div>
              <div><p className="text-xs font-bold text-slate-500">Запланировано</p><p className="mt-1 font-black text-slate-950">{rub.format(plannedQr)}</p></div>
              <div><p className="text-xs font-bold text-slate-500">Нужно перевести</p><p className={`mt-1 font-black ${qrShortfall && qrShortfall > 0 ? "text-red-700" : "text-slate-950"}`}>{qrShortfall == null ? "—" : rub.format(qrShortfall)}</p></div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2">
              <WalletCards className="h-4 w-4 text-slate-500" />
              <h3 className="font-extrabold text-slate-900">Деньги для оплат в USDT</h3>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div><p className="text-xs font-bold text-slate-500">Доступно</p><p className="mt-1 font-black text-slate-950">{usdtBalance.balance == null ? "—" : `${usdtBalance.balance.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT`}</p></div>
              <div><p className="text-xs font-bold text-slate-500">Запланировано</p><p className="mt-1 font-black text-slate-950">{plannedUsdt > 0 ? `${estimatedUsdtCount > 0 ? "≈ " : ""}${plannedUsdt.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} USDT` : unknownUsdtCount > 0 ? "Уточняется" : "0 USDT"}</p>{unknownUsdtCount > 0 ? <p className="mt-0.5 text-xs font-semibold text-violet-700">Оплат без суммы: {unknownUsdtCount}</p> : estimatedUsdtCount > 0 ? <p className="mt-0.5 text-xs font-semibold text-violet-700">По последнему курсу из 1С</p> : null}</div>
              <div><p className="text-xs font-bold text-slate-500">{unknownUsdtCount > 0 ? "Расчёт остатка" : usdtDeficit && usdtDeficit > 0 ? "Не хватает" : "Останется"}</p><p className={`mt-1 font-black ${usdtDeficit && usdtDeficit > 0 ? "text-red-700" : "text-slate-950"}`}>{usdtDeficit == null || usdtRemainder == null ? "—" : `${estimatedUsdtCount > 0 ? "≈ " : ""}${(usdtDeficit > 0 ? usdtDeficit : usdtRemainder).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} USDT`}</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-material-card rounded-2xl bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">Нужно согласовать</h2>
            <p className="text-sm font-medium text-slate-500">Проверьте дату, сумму и заказы. Затем согласуйте или отмените.</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-900">{submitted.length}</span>
        </div>
        <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200">
          {submitted.length ? submitted.map((plan) => (
            <article key={plan.id} className="p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(190px,1.35fr)_minmax(130px,.8fr)_minmax(140px,.85fr)_minmax(150px,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <p className="font-black text-slate-950">{plan.supplierPartner}</p>
                  <p className="mt-0.5 text-xs font-semibold leading-relaxed text-slate-500">Заказы: {orderLabel(plan)}</p>
                </div>
                <div><p className="text-xs font-bold text-slate-400">Подготовить к</p><p className="mt-0.5 font-extrabold text-slate-800">{date(plan.plannedDate)}</p></div>
                <div><p className="text-xs font-bold text-slate-400">Сумма</p><p className="mt-0.5 font-extrabold text-slate-950">{amountLabel(plan)}</p>{plan.paymentMethod === "USDT" ? <p className="text-xs font-semibold text-violet-700">{Number(plan.foreignAmount || 0) > 0 ? `Ориентир: ${rub.format(Number(plan.plannedAmount))}` : usdtEstimateNote(plan)}</p> : null}</div>
                <div><p className="text-xs font-bold text-slate-400">Способ</p><p className="mt-0.5 font-extrabold text-slate-800">{methodLabel(plan)}</p></div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button disabled={busy === plan.id} onClick={() => act(plan.id, "APPROVE")} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-white transition hover:bg-[#1d304e] disabled:opacity-50"><Check className="h-4 w-4" />Согласовать</button>
                  <button disabled={busy === plan.id} onClick={() => { setReturningId(plan.id); setReturnReason(""); setActionMessage(""); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-50 px-3 text-sm font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"><Undo2 className="h-4 w-4" />Исправить</button>
                  <button disabled={busy === plan.id} onClick={() => act(plan.id, "CANCEL")} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50" aria-label={`Отменить оплату ${plan.supplierPartner}`}><X className="h-4 w-4" />Отменить</button>
                </div>
              </div>
              <p className={`mt-2 text-xs font-black ${paymentPlanLeadTime(plan.createdAt, plan.plannedDate).state === "ADVANCE" ? "text-green-700" : "text-red-700"}`}>
                {paymentPlanLeadTime(plan.createdAt, plan.plannedDate).state === "SAME_DAY" ? "Срочно: заявка внесена в день оплаты" : paymentPlanLeadTime(plan.createdAt, plan.plannedDate).state === "NEXT_DAY" ? "Заявка внесена за один день" : paymentPlanLeadTime(plan.createdAt, plan.plannedDate).state === "LATE" ? "Дата оплаты уже прошла" : `Внесено заранее: за ${paymentPlanLeadTime(plan.createdAt, plan.plannedDate).days} дн.`}
              </p>
              {planComment(plan) || plan.supplierConfirmation || (plan.paymentMethod === "USDT" && plan.exchangeRate) ? (
                <p className="mt-2 text-sm font-medium text-slate-600">
                  {plan.paymentMethod === "USDT" && plan.exchangeRate ? `Курс: ${plan.exchangeRate} ₽. ` : ""}
                  {planComment(plan)}{planComment(plan) && plan.supplierConfirmation ? " · " : ""}
                  {plan.supplierConfirmation || ""}
                </p>
              ) : null}
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
              {returningId === plan.id ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <label className="block text-sm font-bold text-amber-950">Что исправить
                    <input autoFocus value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder="Например: выбери оплату в USDT" maxLength={300} className="mt-1.5 w-full rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-slate-950" />
                  </label>
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" onClick={() => { setReturningId(""); setReturnReason(""); }} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600">Отмена</button>
                    <button type="button" disabled={busy === plan.id || returnReason.trim().length < 3} onClick={() => act(plan.id, "RETURN")} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40">Вернуть Астемиру</button>
                  </div>
                </div>
              ) : null}
            </article>
          )) : <p className="p-6 text-center text-sm font-semibold text-slate-500">Новых заявок нет.</p>}
        </div>
        {actionMessage ? <p className="mt-3 text-sm font-bold text-red-700">{actionMessage}</p> : null}
      </section>

      <section className="admin-material-card rounded-2xl bg-white p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-black text-slate-950">Календарь согласованных оплат</h2>
          <p className="text-sm font-medium text-slate-500">Факт выдачи появится автоматически после проведения расходного документа в 1С.</p>
        </div>
        <div className="mt-4 space-y-5">
          {groupedPlans.length ? groupedPlans.map(([key, datePlans]) => (
            <div key={key}>
              <div className="mb-2 flex items-center gap-2">
                <CalendarCheck className={`h-4 w-4 ${key < todayKey ? "text-red-600" : "text-primary"}`} />
                <h3 className={`text-sm font-black uppercase tracking-wide ${key < todayKey ? "text-red-700" : "text-slate-700"}`}>{groupTitle(key)}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{datePlans.length}</span>
              </div>
              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                {datePlans.map((plan) => (
                  <article key={plan.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(180px,1.25fr)_minmax(150px,.8fr)_minmax(150px,1fr)_auto] sm:items-center">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-950">{plan.supplierPartner}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${plan.evidence.state === "MISMATCH" ? "bg-red-100 text-red-800" : plan.evidence.state === "PARTIALLY_PAID_BY_ONE_C" ? "bg-blue-100 text-blue-800" : plan.evidence.state === "ISSUED_BY_ONE_C" ? "bg-blue-100 text-blue-800" : plan.evidence.state === "PARTIALLY_ISSUED" ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-800"}`}>{plan.evidence.state === "MISMATCH" ? "НЕ СОВПАДАЕТ С 1С" : plan.evidence.state === "ISSUED_BY_ONE_C" ? "ОПЛАЧЕНО ПО 1С" : plan.evidence.state === "PARTIALLY_PAID_BY_ONE_C" ? "ЧАСТИЧНО ОПЛАЧЕНО" : plan.evidence.state === "PARTIALLY_ISSUED" ? "ЧАСТИЧНО ПО 1С" : "СОГЛАСОВАНО"}</span></div><p className="mt-0.5 text-xs font-semibold leading-relaxed text-slate-500">Заказы: {orderLabel(plan)}</p>{plan.evidence.state === "MISMATCH" ? <p className="mt-1 text-xs font-black text-red-700">В заявке: {plan.supplierPartner} · в 1С: {plan.evidence.actualSupplier || "другой поставщик"}</p> : plan.evidence.state === "PARTIALLY_ISSUED" ? <p className="mt-1 text-xs font-bold text-amber-800">По 1С оплачено {rub.format(plan.evidence.issuedAmount)} из {rub.format(Number(plan.plannedAmount))}</p> : plan.evidence.state === "PARTIALLY_PAID_BY_ONE_C" ? <p className="mt-1 text-xs font-bold text-blue-800">Оплачено {plan.evidence.paidForeignAmount.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT · осталось {plan.evidence.remainingForeignAmount != null ? `${plan.evidence.remainingForeignAmount.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT` : rub.format(plan.evidence.remainingAmount)}</p> : null}</div>
                    <div><p className="text-xs font-bold text-slate-400">Сумма</p><p className="mt-0.5 font-extrabold text-slate-950">{amountLabel(plan)}</p>{plan.paymentMethod === "USDT" && !Number(plan.foreignAmount || 0) ? <p className="text-xs font-semibold text-violet-700">{usdtEstimateNote(plan)}</p> : null}{planComment(plan) ? <p className="mt-1 text-xs font-medium text-slate-600">{planComment(plan)}</p> : null}</div>
                    <div><p className="text-xs font-bold text-slate-400">Способ</p><p className="mt-0.5 font-extrabold text-slate-800">{methodLabel(plan)}</p></div>
                    <div className="text-left sm:text-right"><p className="text-xs font-bold text-slate-400">Ответственный</p><p className="mt-0.5 text-sm font-extrabold text-slate-700">{plan.manager.name}</p></div>
                  </article>
                ))}
              </div>
            </div>
          )) : <p className="rounded-xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">Текущих согласованных оплат нет.</p>}
        </div>
        {completedPlans.length ? (
          <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer font-black text-slate-800">История оплаченных · {completedPlans.length}{completedPlans.some(isCurrencyPaid) ? ` · ${completedPlans.find(isCurrencyPaid)?.supplierPartner}: ${Number(completedPlans.find(isCurrencyPaid)?.evidence.paidForeignAmount || 0).toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT` : ""}</summary>
            <div className="mt-3 divide-y divide-slate-200">
            {completedPlans.map((plan) => <div key={plan.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-extrabold text-slate-950">{plan.supplierPartner}</p><p className="text-xs font-semibold text-slate-500">Заказы: {orderLabel(plan)}</p></div><div className="sm:text-right"><p className="font-black text-blue-800">{isCurrencyPaid(plan) ? `Оплачено по 1С · ${plan.evidence.paidForeignAmount.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT${plan.evidence.actualExchangeRate ? ` · курс ${plan.evidence.actualExchangeRate.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽` : ""}${plan.evidence.paidAmount > 0 ? ` · ≈ ${rub.format(plan.evidence.paidAmount)} по курсу конвертации` : ""}` : `Оплачено по 1С · ${rub.format(plan.evidence.issuedAmount)}`}</p><p className="text-xs font-semibold text-slate-500">{plan.manager.name}</p></div></div>)}
            </div>
          </details>
        ) : null}
      </section>
    </div>
  );
}
