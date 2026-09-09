"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";

type Order = {
  ref: string;
  number: string;
  supplierPartner: string;
  supplierCounterparty: string;
  orderPaymentGap: number;
};

type CreatedPlan = {
  id: string;
  plannedDate: string;
  [key: string]: unknown;
};

type RowDraft = {
  selected: boolean;
  plannedAmount: string;
  paymentMethod: string;
  foreignAmount: string;
  condition: string;
};

const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const commentHint = (method: string) =>
  method === "USDT"
    ? "Курс валютчика 89 ₽"
    : method === "ACCOUNTABLE_QR"
      ? "QR пришлют после 15:00"
      : method === "BANK"
        ? "Реквизиты пришлют завтра"
        : "42 112 юаней по курсу 13,55 ₽";

export function ProcurementPaymentBatchForm({
  orders,
  initialSelectedRefs,
  onCreated,
  onCancel,
}: {
  orders: Order[];
  initialSelectedRefs: string[];
  onCreated: (plans: CreatedPlan[]) => void;
  onCancel: () => void;
}) {
  const [plannedDate, setPlannedDate] = useState("");
  const [rows, setRows] = useState<Record<string, RowDraft>>(() =>
    Object.fromEntries(
      orders.map((order) => [
        order.ref,
        {
          selected: initialSelectedRefs.includes(order.ref),
          plannedAmount: String(Math.max(0, order.orderPaymentGap) || ""),
          paymentMethod: "CASH",
          foreignAmount: "",
          condition: "",
        },
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const selected = orders.filter((order) => rows[order.ref]?.selected);
  const candidates = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru-RU");
    return orders
      .filter(
        (order) =>
          !needle ||
            `${order.supplierPartner} ${order.number}`
              .toLocaleLowerCase("ru-RU")
              .includes(needle),
      );
  }, [orders, query, rows]);
  const totals = useMemo(
    () => ({
      cash: selected
        .filter((order) => rows[order.ref].paymentMethod === "CASH")
        .reduce((sum, order) => sum + Number(rows[order.ref].plannedAmount || 0), 0),
      bank: selected
        .filter((order) => rows[order.ref].paymentMethod === "BANK")
        .reduce((sum, order) => sum + Number(rows[order.ref].plannedAmount || 0), 0),
      qr: selected
        .filter((order) => rows[order.ref].paymentMethod === "ACCOUNTABLE_QR")
        .reduce((sum, order) => sum + Number(rows[order.ref].plannedAmount || 0), 0),
      usdt: selected
        .filter((order) => rows[order.ref].paymentMethod === "USDT")
        .reduce((sum, order) => sum + Number(rows[order.ref].foreignAmount || 0), 0),
    }),
    [orders, rows, selected],
  );

  function change(ref: string, patch: Partial<RowDraft>) {
    setRows((current) => ({
      ...current,
      [ref]: { ...current[ref], ...patch },
    }));
    setMessage("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!plannedDate || !selected.length) {
      setMessage("Укажите дату и выберите хотя бы один заказ.");
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/procurement/payment-plans/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plannedDate,
        rows: selected.map((order) => ({
          orderRef: order.ref,
          plannedAmount: rows[order.ref].plannedAmount,
          paymentMethod: rows[order.ref].paymentMethod,
          foreignAmount: rows[order.ref].foreignAmount,
          condition: rows[order.ref].condition,
        })),
      }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Не удалось сохранить список оплат.");
      return;
    }
    onCreated(data.plans || []);
  }

  return (
    <form className="space-y-4 border-t border-slate-100 p-4 sm:p-5" onSubmit={submit}>
      <label className="block max-w-sm text-sm font-bold">
        Когда подготовить деньги
        <input
          value={plannedDate}
          onChange={(event) => setPlannedDate(event.target.value)}
          type="date"
          required
          className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3"
        />
      </label>

      <div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-black text-slate-950">Добавьте заказы</h3>
            <p className="text-sm text-slate-500">Найдите поставщика или номер заказа.</p>
          </div>
          <p className="text-sm font-extrabold text-slate-600">Выбрано: {selected.length}</p>
        </div>
        <div className="relative mt-3 max-w-2xl">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setPickerOpen(true)}
            onBlur={() => window.setTimeout(() => setPickerOpen(false), 100)}
            placeholder="Поставщик или номер заказа"
            className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-11 font-semibold"
          />
          {query ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setQuery("")}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Очистить поиск"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          {pickerOpen ? (
            <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-20 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
              {query.trim() && candidates.length > 1 ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    const shouldSelect = candidates.some(
                      (order) => !rows[order.ref]?.selected,
                    );
                    setRows((current) => ({
                      ...current,
                      ...Object.fromEntries(
                        candidates.map((order) => [
                          order.ref,
                          { ...current[order.ref], selected: shouldSelect },
                        ]),
                      ),
                    }));
                    setMessage("");
                  }}
                  className="sticky top-0 z-10 flex w-full items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm font-black text-slate-700"
                >
                  <span>
                    {candidates.every((order) => rows[order.ref]?.selected)
                      ? "Снять все найденные"
                      : "Выбрать все найденные"}
                  </span>
                  <span>{candidates.length}</span>
                </button>
              ) : null}
              {candidates.length ? candidates.map((order) => (
                <button
                  key={order.ref}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    change(order.ref, {
                      selected: !rows[order.ref]?.selected,
                    });
                  }}
                  aria-pressed={rows[order.ref]?.selected}
                  className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-slate-50 ${rows[order.ref]?.selected ? "bg-green-50/60" : ""}`}
                >
                  <span><span className="block font-black text-slate-950">{order.supplierPartner}</span><span className="block text-xs font-semibold text-slate-500">Заказ № {order.number || "без номера"}</span></span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-700">{rub.format(order.orderPaymentGap)}</span>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${rows[order.ref]?.selected ? "bg-green-600 text-white" : "bg-slate-100 text-slate-700"}`} aria-hidden="true">
                      {rows[order.ref]?.selected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </span>
                  </span>
                </button>
              )) : (
                <p className="px-3 py-3 text-sm font-semibold text-slate-500">Ничего не найдено</p>
              )}
            </div>
          ) : null}
        </div>
        <div className="mt-3 space-y-2">
          {selected.length ? selected.map((order) => {
            const row = rows[order.ref];
            return (
              <div
                key={order.ref}
                className="relative grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[minmax(190px,0.9fr)_minmax(140px,0.65fr)_minmax(180px,0.8fr)_minmax(220px,1.2fr)_32px] lg:items-end"
              >
                <div className="min-w-0 pr-9 lg:pr-0">
                  <span className="block font-black text-slate-950">{order.supplierPartner}</span>
                  <span className="block text-sm font-semibold text-slate-600">Заказ № {order.number || "без номера"}</span>
                  <span className="block text-xs font-semibold text-slate-500">Остаток в 1С: {rub.format(order.orderPaymentGap)}</span>
                </div>
                <label className="text-xs font-bold text-slate-600">
                      Способ
                      <select
                        value={row.paymentMethod}
                        onChange={(event) => change(order.ref, { paymentMethod: event.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900"
                      >
                        <option value="CASH">Наличные</option>
                        <option value="ACCOUNTABLE_QR">QR</option>
                        <option value="USDT">USDT</option>
                        <option value="BANK">Перевод поставщику</option>
                      </select>
                </label>
                <label className="text-xs font-bold text-slate-600">
                      {row.paymentMethod === "USDT" ? "Сколько USDT отправить" : "Сколько подготовить, ₽"}
                      <input
                        value={row.paymentMethod === "USDT" ? row.foreignAmount : row.plannedAmount}
                        onChange={(event) => change(order.ref, row.paymentMethod === "USDT" ? { foreignAmount: event.target.value } : { plannedAmount: event.target.value })}
                        type="number"
                        min="0.01"
                        step={row.paymentMethod === "USDT" ? "0.0001" : "0.01"}
                        required
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold"
                      />
                </label>
                <label className="text-xs font-bold text-slate-600">
                      Комментарий <span className="font-medium text-slate-400">(необязательно)</span>
                      <input
                        value={row.condition}
                        onChange={(event) => change(order.ref, { condition: event.target.value })}
                        placeholder={commentHint(row.paymentMethod)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                      />
                </label>
                <button
                  type="button"
                  onClick={() => change(order.ref, { selected: false })}
                  className="admin-material-control absolute mr-3 mt-3 flex h-8 w-8 justify-self-end rounded-full bg-white text-slate-500 lg:static lg:mr-0 lg:mt-0 lg:items-center lg:justify-center"
                  aria-label={`Убрать заказ ${order.number}`}
                >
                  <X className="m-auto h-4 w-4" />
                </button>
              </div>
            );
          }) : (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm font-semibold text-slate-500">
              Нажмите на поле выше или начните вводить поставщика.
            </div>
          )}
        </div>
      </div>

      {selected.length ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
          <p className="text-sm font-black text-slate-950">Итого по списку</p>
          {totals.cash > 0 ? <p className="text-sm font-semibold text-slate-700">Наличными: <span className="font-black text-slate-950">{rub.format(totals.cash)}</span></p> : null}
          {totals.qr > 0 ? <p className="text-sm font-semibold text-slate-700">По QR: <span className="font-black text-slate-950">{rub.format(totals.qr)}</span></p> : null}
          {totals.bank > 0 ? <p className="text-sm font-semibold text-slate-700">Перевод поставщику: <span className="font-black text-slate-950">{rub.format(totals.bank)}</span></p> : null}
          {totals.usdt > 0 ? <p className="text-sm font-semibold text-slate-700">В USDT: <span className="font-black text-slate-950">{totals.usdt.toLocaleString("ru-RU")} USDT</span></p> : null}
        </div>
      ) : null}
      {message ? <p className="text-sm font-bold text-red-600">{message}</p> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="rounded-xl bg-slate-100 px-5 py-3 font-black text-slate-700">Отмена</button>
        <button disabled={saving || !plannedDate || !selected.length} className="admin-material-primary rounded-xl bg-green-600 px-5 py-3 font-black text-white disabled:opacity-40">
          {saving ? "Сохраняю…" : `Передать на согласование · ${selected.length}`}
        </button>
      </div>
    </form>
  );
}
