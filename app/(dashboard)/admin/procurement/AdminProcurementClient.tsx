"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarCheck,
  Check,
  Clock3,
  RefreshCw,
  ShieldAlert,
  WalletCards,
  X,
} from "lucide-react";
import { calculateCashPreparation } from "@/lib/procurement-payment-control";

type Plan = {
  id: string;
  planCode: string;
  supplierPartner: string;
  supplierCounterparty: string;
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
  manager: { name: string };
  evidence: {
    state: string;
    issuedAmount: number;
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
  unplannedCashCount,
  usdtBalance,
  accountableBalance,
  todayKey,
}: {
  initialPlans: Plan[];
  sourceCheckedAt: string;
  sourceWarnings: string[];
  unplannedOrderCount: number | null;
  unplannedCashCount: number | null;
  usdtBalance: UsdtBalance;
  accountableBalance: UsdtBalance;
  todayKey: string;
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [busy, setBusy] = useState("");
  const active = plans.filter((plan) => plan.status !== "CANCELLED");
  const submitted = active.filter((plan) => plan.status === "SUBMITTED");
  const groupedPlans = useMemo(() => {
    const ordered = [...active].sort(
      (a, b) =>
        (a.status === "SUBMITTED" ? -1 : 1) -
          (b.status === "SUBMITTED" ? -1 : 1) ||
        a.plannedDate.localeCompare(b.plannedDate),
    );
    const groups = new Map<string, Plan[]>();
    ordered.forEach((plan) => {
      const key = dateKey(plan.plannedDate);
      groups.set(key, [...(groups.get(key) || []), plan]);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [plans]);
  const preparation = calculateCashPreparation(
    active.map((plan) => ({
      id: plan.id,
      plannedDate: plan.plannedDate,
      plannedAmount: Number(plan.plannedAmount),
      paymentMethod: plan.paymentMethod,
      foreignAmount: Number(plan.foreignAmount || 0),
      exchangeRate: Number(plan.exchangeRate || 0),
      commissionAmount: Number(plan.commissionAmount || 0),
      issued: plan.evidence.state === "ISSUED_BY_ONE_C",
    })),
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
  const nextAmountEstimated = nextPlans.some((row) => row.estimated);
  const plannedUsdt = preparation.plannedUsdt;
  const usdtDeficit = preparation.usdtDeficit;
  const usdtRemainder =
    usdtBalance.balance == null
      ? null
      : Math.max(0, usdtBalance.balance - plannedUsdt);
  const plannedQr = active
    .filter((plan) => plan.paymentMethod === "ACCOUNTABLE_QR" && dateKey(plan.plannedDate) >= todayKey)
    .reduce((sum, plan) => sum + Number(plan.plannedAmount || 0), 0);
  const qrShortfall = accountableBalance.balance == null ? null : Math.max(0, plannedQr - accountableBalance.balance);
  const groupTitle = (key: string) =>
    key < todayKey
      ? `Просрочено · ${date(key)}`
      : key === todayKey
        ? "Сегодня"
        : key === nextDayKey(todayKey)
          ? "Завтра"
          : date(key);

  async function act(id: string, action: "APPROVE" | "CANCEL") {
    setBusy(id);
    const response = await fetch(`/api/admin/procurement/payment-plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (response.ok) {
      const updated = await response.json();
      setPlans((current) =>
        current.map((plan) =>
          plan.id === id ? { ...plan, ...updated } : plan,
        ),
      );
    }
    setBusy("");
  }

  return (
    <div className="space-y-5">
      {sourceWarnings.length ? (
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          Часть данных 1С недоступна: {sourceWarnings.join(", ")}. Решения лучше
          принимать после обновления.
        </div>
      ) : null}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl bg-slate-950 p-5 text-white">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">
            Следующий приезд
          </p>
          <p className="mt-2 text-2xl font-black">
            {nextDate ? date(nextDate) : "Не требуется"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {nextPlans.length
              ? `${nextPlans.length} оплат`
              : "Пополнение не требуется"}
          </p>
        </div>
        <div className="rounded-2xl bg-[#64c20b] p-5 text-slate-950">
          <p className="text-xs font-extrabold uppercase tracking-wide opacity-70">
            Потребуется наличными
          </p>
          <p className="mt-2 text-2xl font-black">
            {nextAmountEstimated ? "≈ " : ""}{rub.format(nextAmount)}
          </p>
          <p className="mt-1 text-xs font-bold opacity-70">
            {nextAmountEstimated ? "ориентир: точный курс ещё не указан" : "на ближайшую дату, включая заявки на согласовании"}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            Заказы без даты оплаты
          </p>
          <p className="mt-2 text-2xl font-black">
            {unplannedOrderCount == null ? "—" : unplannedOrderCount}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            остаток оплаты больше нуля в 1С
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            Ожидают согласования
          </p>
          <p className="mt-2 text-2xl font-black">{submitted.length}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            заявок от закупщика
          </p>
        </div>
        <div
          className={`rounded-2xl p-5 ring-1 ${unplannedCashCount && unplannedCashCount > 0 ? "bg-red-50 ring-red-200" : "bg-white ring-slate-200"}`}
        >
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            Выдачи вне плана
          </p>
          <p className="mt-2 text-2xl font-black">{unplannedCashCount == null ? "—" : unplannedCashCount}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            проверить по РКО 1С
          </p>
        </div>
      </section>
      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-blue-700">QR с карты Астемира · ₽</p><p className="mt-1 text-sm font-semibold text-blue-800">{accountableBalance.sourceLabel} · факт после проведённых расходов</p></div><div className="grid gap-2 sm:grid-cols-3 lg:min-w-[620px]"><div className="rounded-xl bg-white/75 p-3"><p className="text-xs font-bold text-blue-600">Сейчас по данным 1С</p><p className="mt-1 text-lg font-black text-blue-950">{accountableBalance.balance == null ? "Данные недоступны" : rub.format(accountableBalance.balance)}</p></div><div className="rounded-xl bg-white/75 p-3"><p className="text-xs font-bold text-blue-600">Будущие QR-планы</p><p className="mt-1 text-lg font-black text-blue-950">{rub.format(plannedQr)}</p></div><div className="rounded-xl bg-white/75 p-3"><p className="text-xs font-bold text-blue-600">Нужно дополнительно перевести</p><p className="mt-1 text-lg font-black text-blue-950">{qrShortfall == null ? "—" : rub.format(qrShortfall)}</p></div></div></div>
      </section>
      <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-violet-600">
              Деньги для оплат в USDT
            </p>
            <p className="mt-1 text-sm font-semibold text-violet-800">
              {usdtBalance.sourceLabel} · только просмотр
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[620px]">
            <div className="rounded-xl bg-white/75 p-3">
              <p className="text-xs font-bold text-violet-600">Сейчас есть</p>
              <p className="mt-1 text-lg font-black text-violet-950">
                {usdtBalance.balance == null
                  ? "Нет данных"
                  : `${usdtBalance.balance.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT`}
              </p>
            </div>
            <div className="rounded-xl bg-white/75 p-3">
              <p className="text-xs font-bold text-violet-600">
                Нужно на планы
              </p>
              <p className="mt-1 text-lg font-black text-violet-950">
                {plannedUsdt.toLocaleString("ru-RU")} USDT
              </p>
            </div>
            <div className="rounded-xl bg-white/75 p-3">
              <p className="text-xs font-bold text-violet-600">
                После оплат останется
              </p>
              <p className="mt-1 text-lg font-black text-violet-950">
                {usdtRemainder == null
                  ? "—"
                  : `${usdtRemainder.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT`}
              </p>
            </div>
          </div>
        </div>
        <p
          className={`mt-3 rounded-xl px-3 py-2.5 text-sm font-extrabold ${usdtDeficit && usdtDeficit > 0 ? "bg-red-100 text-red-900" : "bg-green-100 text-green-900"}`}
        >
          {usdtDeficit == null
            ? "Не удалось проверить, хватит ли USDT."
            : usdtDeficit > 0
              ? `Не хватает ${usdtDeficit.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT. Для пополнения нужно подготовить наличные.`
              : "USDT хватает на все внесённые планы. Для этих оплат наличные на пополнение не нужны."}
        </p>
      </section>
      <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black">Календарь и согласование</h2>
            <p className="text-sm text-slate-500">
              Сначала проверьте новые заявки, затем ориентируйтесь на ближайшие
              даты.
            </p>
          </div>
          <p className="text-xs font-semibold text-slate-500">
            <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
            Заказы 1С:{" "}
            {sourceCheckedAt
              ? new Date(sourceCheckedAt).toLocaleString("ru-RU")
              : "данные недоступны"}
          </p>
        </div>
        <div className="mt-5 space-y-6">
          {groupedPlans.length ? (
            groupedPlans.map(([key, datePlans]) => (
              <div key={key}>
                <div className="mb-2 flex items-center gap-2">
                  <CalendarCheck
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
                <div className="space-y-3">
                  {datePlans.map((plan) => (
                    <article
                      key={plan.id}
                      className={`rounded-2xl border p-4 ${key < todayKey ? "border-red-200 bg-red-50/40" : "border-slate-200"}`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-black">
                              {plan.supplierPartner}
                            </h3>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-black ${plan.status === "APPROVED" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}
                            >
                              {plan.status === "APPROVED"
                                ? "СОГЛАСОВАНО"
                                : "НА СОГЛАСОВАНИИ"}
                            </span>
                            {plan.evidence.state === "ISSUED_BY_ONE_C" ? (
                              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black text-blue-800">
                                ВЫДАНО ПО 1С
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {plan.manager.name} · {plan.planCode}
                          </p>
                          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                            <div>
                              <p className="text-xs font-bold text-slate-400">
                                Когда
                              </p>
                              <p className="font-extrabold">
                                {date(plan.plannedDate)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-400">
                                Сколько
                              </p>
                              <p className="font-extrabold">
                                {rub.format(Number(plan.plannedAmount))}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-400">
                                Как
                              </p>
                        <p className="font-extrabold">
                          {plan.paymentMethod === "USDT"
                            ? `USDT через ${plan.exchangerName || "валютчика"}`
                            : plan.paymentMethod === "CASH"
                              ? "Наличные из сейфа"
                              : plan.paymentMethod === "ACCOUNTABLE_QR"
                                ? "Оплата поставщику по QR с карты Астемира"
                                : "Безналично"}
                        </p>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-400">
                                Условия
                              </p>
                              <p className="font-extrabold">{plan.condition}</p>
                            </div>
                          </div>
                          {plan.paymentMethod === "USDT" ? (
                            <>
                              <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900">
                                {plan.foreignAmount} USDT ·{" "}
                                {plan.exchangeRate
                                  ? `плановый курс ${plan.exchangeRate} ₽`
                                  : "курс уточняется"}
                                {plan.commissionAmount
                                  ? ` · комиссия ${rub.format(Number(plan.commissionAmount))}`
                                  : ""}
                              </p>
                              {usdtBalance.balance != null &&
                              Number(plan.foreignAmount || 0) <=
                                usdtBalance.balance ? (
                                <p className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-extrabold text-green-800">
                                  USDT на эту оплату уже хватает. Наличные для
                                  покупки USDT не нужны.
                                </p>
                              ) : null}
                            </>
                          ) : null}
                          {plan.supplierConfirmation ? (
                            <p className="mt-2 text-sm text-slate-600">
                              <span className="font-extrabold">
                                Подтверждение:
                              </span>{" "}
                              {plan.supplierConfirmation}
                            </p>
                          ) : null}
                          {plan.evidence.state === "ISSUED_BY_ONE_C" ? (
                            <p className="mt-3 text-sm font-bold text-blue-800">
                              По проведённым РКО выдано:{" "}
                              {rub.format(plan.evidence.issuedAmount)}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {plan.status === "SUBMITTED" ? (
                            <>
                              <button
                                disabled={busy === plan.id}
                                onClick={() => act(plan.id, "APPROVE")}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#64c20b] px-4 py-2.5 text-sm font-black text-slate-950"
                              >
                                <Check className="h-4 w-4" />
                                Согласовать
                              </button>
                              <button
                                disabled={busy === plan.id}
                                onClick={() => act(plan.id, "CANCEL")}
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-black text-slate-700"
                              >
                                <X className="h-4 w-4" />
                                Отменить
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
              Астемир ещё не передал ни одного плана.
            </p>
          )}
        </div>
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <WalletCards className="h-5 w-5 text-[#58a908]" />
          <p className="mt-3 font-black">Заявка — от закупщика</p>
          <p className="mt-1 text-sm text-slate-500">
            Дата, сумма, способ и договорённость с поставщиком.
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <CalendarCheck className="h-5 w-5 text-[#58a908]" />
          <p className="mt-3 font-black">Согласование — в админке</p>
          <p className="mt-1 text-sm text-slate-500">
            После согласования оплату можно готовить к указанной дате.
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <Banknote className="h-5 w-5 text-[#58a908]" />
          <p className="mt-3 font-black">Факт выдачи — из 1С</p>
          <p className="mt-1 text-sm text-slate-500">
            Только проведённый РКО считается подтверждением выдачи.
          </p>
        </div>
      </section>
    </div>
  );
}
