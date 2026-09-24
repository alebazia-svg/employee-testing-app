"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import type { SupplierBalance } from "@/lib/procurement-supplier-settlements";
import { procurementOrderCommentText } from "@/lib/procurement-order-comment";
import { summarizeDraftUsdt } from '@/lib/procurement-draft-summary';
import { matchesPaymentOrderSearch, sortPaymentPickerOrders } from '@/lib/procurement-payment-priority';
import { mixedPaymentBasisSuppliers, mixedPaymentBasisMessage } from '@/lib/procurement-payment-basis';

type Order = {
  planningState?: string;
  planningReason?: string;
  date?: string;
  controlGroup?: string;
  ref: string;
  number: string;
  supplierPartner: string;
  supplierCounterparty: string;
  orderPaymentGap: number;
  supplierDebt: number;
  plannedActiveAmount: number;
  unplannedAmount: number;
  orderComment: string;
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
    ? "Например: курс уточняется"
    : method === "ACCOUNTABLE_QR"
      ? "QR пришлют после 15:00"
      : method === "BANK"
        ? "Реквизиты пришлют завтра"
        : "42 112 юаней по курсу 13,55 ₽";

function OrderComment({ value, compact = false }: { value: string; compact?: boolean }) {
  const comment = procurementOrderCommentText(value);
  if (!comment) return null;
  return (
    <span
      className={`mt-1 block text-xs font-semibold text-slate-700 ${compact ? "max-w-xl truncate" : "line-clamp-2"}`}
      title={comment}
    >
      Комментарий из 1С: {comment}
    </span>
  );
}

export function ProcurementPaymentBatchForm({
  orders: sourceOrders,
  supplierBalances,
  supplierOrderGapTotals,
  initialSelectedRefs,
  onCreated,
  onCancel,
  usdtRateReference,
  basisPreview = false,
  supplierDebtError = false,
  todayKey = '',
  activeOrderRefs = [],
}: {
  orders: Order[];
  supplierBalances: Record<string, SupplierBalance>;
  supplierOrderGapTotals: Record<string, number>;
  initialSelectedRefs: string[];
  onCreated: (plans: CreatedPlan[]) => void;
  onCancel: () => void;
  usdtRateReference?: { rate: number | null; checkedAt: string; sourceLabel: string; conversionAt?: string };
  basisPreview?: boolean;
  supplierDebtError?: boolean;
  todayKey?: string;
  activeOrderRefs?: string[];
}) {
  const orders: Order[] = useMemo(() => [...sourceOrders, ...Object.entries(supplierDebtError ? {} : supplierBalances)
    .filter(([, balance]) => balance.debt > 500)
    .map(([supplierPartner, balance]) => ({ref: `debt:${supplierPartner}`, number: '', supplierPartner, supplierCounterparty: '', orderPaymentGap: 0, supplierDebt: balance.debt, plannedActiveAmount: 0, unplannedAmount: balance.debt, orderComment: ''}))], [sourceOrders, supplierBalances, supplierDebtError]);
  const [pickerBasis, setPickerBasis] = useState<'ORDER' | 'DEBT'>('ORDER');
  const supplierBalanceText = (supplier: string) => {
    const balance = supplierBalances[supplier];
    if (!balance) return "Взаиморасчёты: нет данных из 1С";
    if (balance.debt > 0.009) return `Задолженность перед поставщиком: ${rub.format(balance.debt)}`;
    if (balance.advance > 0.009) return `Аванс поставщику: ${rub.format(balance.advance)}`;
    return "Задолженности перед поставщиком нет";
  };
  const [plannedDate, setPlannedDate] = useState("");
  const [commentFields, setCommentFields] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Record<string, RowDraft>>(() =>
    Object.fromEntries(
      orders.map((order) => [
        order.ref,
        {
          selected: initialSelectedRefs.includes(order.ref),
          plannedAmount: order.ref.startsWith('debt:') || order.planningState === 'needs_review' ? '' : String(Math.max(0, order.unplannedAmount) || ""),
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
  const selectedOrders = orders.filter((order) => rows[order.ref]?.selected);
  const selected = Array.from(new Set(selectedOrders.map(order => order.supplierPartner)))
    .flatMap(supplier => selectedOrders.filter(order => order.supplierPartner === supplier));
  const mixedBasisSuppliers = mixedPaymentBasisSuppliers(selected.map(order => ({
    supplierPartner: order.supplierPartner, basis: order.ref.startsWith('debt:') ? 'DEBT' : 'ORDER',
  })));
  useEffect(() => {
    if (!selected.length && !plannedDate) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [selected.length, plannedDate]);
  const candidates = useMemo(() => {
    return sortPaymentPickerOrders(orders
      .filter(order => order.ref.startsWith('debt:') === (pickerBasis === 'DEBT')))
      .filter(order => matchesPaymentOrderSearch(order, query));
  }, [orders, query, pickerBasis]);
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
      usdtRub: selected
        .filter((order) => rows[order.ref].paymentMethod === "USDT")
        .reduce((sum, order) => sum + Number(rows[order.ref].plannedAmount || 0), 0),
      usdtKnown: selected
        .filter((order) => rows[order.ref].paymentMethod === "USDT")
        .reduce((sum, order) => sum + Number(rows[order.ref].foreignAmount || 0), 0),
      usdtUnknown: selected
        .filter((order) => rows[order.ref].paymentMethod === "USDT" && !Number(rows[order.ref].foreignAmount || 0))
        .length,
      usdtEstimatedRub: selected
        .filter((order) => rows[order.ref].paymentMethod === "USDT")
        .reduce((sum, order) => sum + (Number(rows[order.ref].plannedAmount || 0) || Number(rows[order.ref].foreignAmount || 0) * Number(usdtRateReference?.rate || 0)), 0),
    }),
    [orders, rows, selected, usdtRateReference?.rate],
  );

  function change(ref: string, patch: Partial<RowDraft>) {
    setRows((current) => ({
      ...current,
      [ref]: { ...current[ref], ...patch },
    }));
    setMessage("");
  }

  const usdtSummary = summarizeDraftUsdt(selected.map(order => rows[order.ref]), usdtRateReference?.rate ?? null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mixedBasisSuppliers.length) {
      setMessage(mixedPaymentBasisMessage(mixedBasisSuppliers));
      return;
    }
    if (basisPreview) {
      setMessage('Проверка интерфейса: отправка отключена.');
      return;
    }
    if (!plannedDate || !selected.length) {
      setMessage("Укажите дату и добавьте хотя бы одну оплату.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
    const response = await fetch("/api/procurement/payment-plans/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plannedDate,
        rows: selected.map((order) => ({
          basis: order.ref.startsWith('debt:') ? 'DEBT' : 'ORDER',
          supplierPartner: order.supplierPartner,
          orderRef: order.ref.startsWith('debt:') ? '' : order.ref,
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
    } catch {
      setMessage('Не удалось подтвердить отправку. Введённые данные сохранены в форме. Проверьте календарь перед повторной отправкой, чтобы не создать дубликат.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4 border-t border-slate-100 p-4 sm:p-5" onSubmit={submit}
      onFocusCapture={event => { if (!(event.target as HTMLElement).closest('[data-payment-picker]')) setPickerOpen(false); }}>
      <label className="block max-w-sm text-sm font-bold">
        Когда подготовить деньги
        <input
          value={plannedDate}
          onChange={(event) => setPlannedDate(event.target.value)}
          type="date"
          required
          className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-3"
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">Одна дата для всех оплат в этом списке.</span>
      </label>

      <div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-black text-slate-950">Кому запланировать оплату</h3>
            <p className="text-sm text-slate-500">{pickerBasis === 'DEBT' ? 'Если платите поставщику без конкретного заказа.' : 'Можно выбрать несколько заказов и поставщиков.'}</p>
          </div>
          <p className="text-sm font-extrabold text-slate-600">Выбрано: {selected.length}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Что добавить"><button type="button" aria-pressed={pickerBasis === 'ORDER'} onClick={() => {setPickerBasis('ORDER'); setQuery(''); setPickerOpen(true);}} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${pickerBasis === 'ORDER' ? 'border-slate-700 bg-slate-100' : 'border-slate-200'}`}>По заказу</button><button type="button" aria-pressed={pickerBasis === 'DEBT'} onClick={() => {setPickerBasis('DEBT'); setQuery(''); setPickerOpen(true);}} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${pickerBasis === 'DEBT' ? 'border-slate-700 bg-slate-100' : 'border-slate-200'}`}>В счёт долга поставщику</button></div>
        {pickerBasis === 'DEBT' && supplierDebtError ? <p role="status" className="mt-2 text-sm text-amber-800">Долги из 1С пока недоступны. Выбор поставщика появится после обновления.</p> : null}
        {pickerBasis === 'ORDER' ? <p className="mt-3 text-xs text-slate-500">Заказы за 90 дней · {sourceOrders.length}. Сначала — больший неоплаченный остаток.</p> : null}
        <div data-payment-picker className="relative mt-3 max-w-2xl" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPickerOpen(false); }}>
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setPickerOpen(true)}
            placeholder={pickerBasis === 'DEBT' ? 'Название поставщика' : 'Поставщик или последние 3 цифры заказа'}
            aria-label="Поставщик или номер заказа"
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
                  className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-slate-50 ${rows[order.ref]?.selected ? "procurement-order-selected" : ""}`}
                >
                  <span className="min-w-0 flex-1 break-words"><span className="block font-black text-slate-950">{order.supplierPartner}</span><span className="block text-xs font-semibold text-slate-500">{order.ref.startsWith('debt:') ? 'В счёт долга · заказ не нужен' : `Заказ № ${order.number || 'без номера'}`}</span><OrderComment value={order.orderComment} compact /><span className="block text-[11px] font-semibold text-slate-400">{supplierBalanceText(order.supplierPartner)}</span></span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-700">{order.planningState === 'needs_review' ? 'Укажите сумму' : rub.format(order.unplannedAmount)}</span>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${rows[order.ref]?.selected ? "procurement-order-check" : "bg-slate-100 text-slate-700"}`} aria-hidden="true">
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
        <div className="mt-3">
          {selected.length ? selected.map((order, index) => {
            const row = rows[order.ref];
            const debtBasis = order.ref.startsWith('debt:');
            const orderComment = procurementOrderCommentText(order.orderComment);
            const groupStart = index === 0 || selected[index - 1].supplierPartner !== order.supplierPartner;
            const groupEnd = index === selected.length - 1 || selected[index + 1].supplierPartner !== order.supplierPartner;
            return (
              <Fragment key={order.ref}>
              {groupStart ? <div className="mt-4 flex flex-wrap items-baseline justify-between gap-1 rounded-t-2xl border border-b-0 border-slate-200 bg-slate-50 px-4 pb-2 pt-3"><span className="font-black text-slate-950">{order.supplierPartner}</span><span className="text-xs text-slate-500">{supplierBalanceText(order.supplierPartner)}</span></div> : null}
              <div
                id={`payment-row-${encodeURIComponent(order.ref)}`}
                className={`relative grid items-start gap-x-4 gap-y-2 border border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-3 ${groupEnd ? 'rounded-b-2xl' : 'border-b-0'}`}
              >
                <div className="min-w-0 sm:col-span-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pr-9">
                  <div>{!debtBasis ? <><span className="block text-sm font-semibold text-slate-700">Заказ № {order.number || 'без номера'}</span><span className="text-xs text-slate-500">{order.planningState === 'needs_review' ? 'Сумму заявки укажите вручную' : `Осталось: ${rub.format(order.orderPaymentGap)}`}</span></> : <span className="text-sm font-semibold text-slate-700">Оплата долга без привязки к заказу</span>}</div>
                  </div>
                  {!debtBasis && order.plannedActiveAmount > 0 ? <span className="block text-xs font-semibold text-amber-700">Уже в заявках: {rub.format(order.plannedActiveAmount)}</span> : null}
                </div>
                <label className="block text-xs font-bold text-slate-600">
                      Способ оплаты
                      <select
                        value={row.paymentMethod}
                        onChange={(event) => change(order.ref, { paymentMethod: event.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900"
                      >
                        <option value="CASH">Наличные</option>
                        <option value="ACCOUNTABLE_QR">QR</option>
                        <option value="USDT">Оплата в USDT</option>
                        <option value="BANK">Перевод поставщику</option>
                      </select>
                </label>
                <div className={row.paymentMethod === "USDT" ? "grid items-start gap-x-4 gap-y-2 sm:col-span-2 sm:grid-cols-2" : "sm:col-span-2"}>
                  <label className="block text-xs font-bold text-slate-600">
                      {row.paymentMethod === 'USDT' ? 'Ориентир в рублях' : 'Сумма этой оплаты, ₽'}
                      <input
                        value={row.plannedAmount}
                        onChange={(event) => change(order.ref, { plannedAmount: event.target.value })}
                        type="number"
                        min="0.01"
                        step="0.01"
                        required={row.paymentMethod !== "USDT"}
                        placeholder={row.paymentMethod === "USDT" ? "Если известна" : undefined}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold"
                      />
                  </label>
                  {row.paymentMethod === "USDT" ? (
                    <>
                      <label className="block text-xs font-bold text-slate-600">
                        Отправить USDT
                        <input
                          value={row.foreignAmount}
                          onChange={(event) => change(order.ref, { foreignAmount: event.target.value })}
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          placeholder="Если известно"
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-900"
                        />
                      </label>
                      <div className="sm:col-span-2">
                      <p className="text-xs font-medium text-slate-600">Достаточно указать рубли или USDT.</p>
                      {Number(usdtRateReference?.rate || 0) > 0 && (Number(row.plannedAmount || 0) > 0 || Number(row.foreignAmount || 0) > 0) ? (
                        <p className="mt-1.5 text-xs font-semibold leading-relaxed text-slate-600">
                          {Number(row.foreignAmount || 0) > 0
                            ? `≈ ${rub.format(Number(row.foreignAmount) * Number(usdtRateReference?.rate))}`
                            : `≈ ${(Number(row.plannedAmount) / Number(usdtRateReference?.rate)).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} USDT`} по последнему курсу {Number(usdtRateReference?.rate).toLocaleString("ru-RU")} ₽ в 1С
                        </p>
                      ) : null}
                      </div>
                    </>
                  ) : null}
                  {!debtBasis && order.planningState !== 'needs_review' && Number(row.plannedAmount || 0) > order.unplannedAmount + 0.009 ? (
                    <p className="text-xs font-bold text-red-700 sm:col-span-2">Сумма больше незапланированного остатка на {rub.format(Number(row.plannedAmount) - order.unplannedAmount)}. Проверьте сумму перед отправкой.</p>
                  ) : null}
                  {debtBasis && (Number(row.plannedAmount) || Number(row.foreignAmount) * Number(usdtRateReference?.rate)) > order.supplierDebt + 0.009 ? <p className="text-xs font-semibold text-amber-800 sm:col-span-3">Сумма выше текущего долга в 1С. Проверьте её перед отправкой.</p> : null}
                </div>
                {!debtBasis && orderComment ? orderComment.length > 100 ? <details className="group min-w-0 text-xs text-slate-600 sm:col-span-3">
                  <summary className="flex cursor-pointer items-baseline gap-2"><span className="shrink-0 font-semibold">Комментарий 1С</span><span className="min-w-0 truncate group-open:hidden">{orderComment}</span><span className="shrink-0 underline group-open:hidden">Полностью</span><span className="hidden underline group-open:inline">Свернуть</span></summary>
                  <p className="mt-2 whitespace-pre-wrap break-words">{orderComment}</p>
                </details> : <p className="break-words text-xs text-slate-600 sm:col-span-3"><span className="font-semibold">Комментарий 1С: </span>{orderComment}</p> : null}
                {order.planningState === 'needs_review' ? <p className="text-xs text-amber-800 sm:col-span-3">{order.planningReason || 'Расчёты требуют сверки'}. Заказ будет прикреплён к заявке; руководитель проверит сумму.</p> : null}
                {commentFields[order.ref] || row.condition ? <label className="text-xs font-bold text-slate-600 sm:col-span-3">
                      Комментарий (необязательно)
                      <input
                        value={row.condition}
                        onChange={(event) => change(order.ref, { condition: event.target.value })}
                        placeholder={commentHint(row.paymentMethod)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                      />
                </label> : <button type="button" onClick={() => setCommentFields(current => ({...current, [order.ref]: true}))} className="justify-self-start text-xs font-semibold text-slate-600 underline sm:col-span-3">Добавить комментарий</button>}
                <button
                  type="button"
                  onClick={() => change(order.ref, { selected: false })}
                  className="admin-material-control absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500"
                  aria-label={debtBasis ? `Убрать оплату ${order.supplierPartner}` : `Убрать заказ ${order.number}`}
                >
                  <X className="m-auto h-4 w-4" />
                </button>
              </div>
              </Fragment>
            );
          }) : (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm font-semibold text-slate-500">
              Нажмите на поле выше или начните вводить поставщика.
            </div>
          )}
        </div>
      </div>

      {selected.length > 1 ? <section className="rounded-xl border border-slate-200 p-4">
        <h3 className="mb-2 font-bold">Проверьте перед отправкой</h3>
        {mixedBasisSuppliers.length > 0 ? <p role="alert" className="mb-3 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-900">{mixedPaymentBasisMessage(mixedBasisSuppliers)}</p> : null}
        <p className="mb-2 text-xs text-slate-500">Нажмите на поставщика, чтобы изменить оплату.</p>
        <p className="mb-3 text-xs text-slate-600">{plannedDate ? `Подготовить деньги: ${plannedDate.split('-').reverse().join('.')}` : 'Дата подготовки денег ещё не указана'}</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="pb-2">Поставщик / основание</th><th className="pb-2">Способ</th><th className="pb-2 text-right">Сумма заявки</th></tr></thead><tbody>{selected.map(order => {
          const row = rows[order.ref];
          return <tr key={order.ref} className="border-b border-slate-100 last:border-0"><td className="py-2 pr-3"><button type="button" className="text-left font-semibold underline decoration-slate-300 underline-offset-4" aria-label={`Изменить оплату ${order.supplierPartner} ${order.number || 'в счёт долга'}`} onClick={() => {const target = document.getElementById(`payment-row-${encodeURIComponent(order.ref)}`); target?.scrollIntoView({block:'center', behavior:'smooth'}); target?.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});}}>{order.supplierPartner}</button><span className="block text-xs text-slate-500">{order.ref.startsWith('debt:') ? 'В счёт долга' : `Заказ ${order.number}`}</span></td><td className="py-2 pr-3">{{CASH:'Наличные',BANK:'Перевод',ACCOUNTABLE_QR:'QR',USDT:'USDT'}[row.paymentMethod]}</td><td className="py-2 text-right font-semibold">{row.paymentMethod === 'USDT' && Number(row.foreignAmount) > 0 ? `${Number(row.foreignAmount).toLocaleString('ru-RU')} USDT` : Number(row.plannedAmount) > 0 ? `${rub.format(Number(row.plannedAmount))}${row.paymentMethod === 'USDT' ? ' · оплата в USDT' : ''}` : 'Укажите сумму'}</td></tr>;
        })}</tbody></table></div>
      </section> : null}
      {selected.length > 1 ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
          <p className="text-sm font-black text-slate-950">Итого по списку</p>
          {totals.cash > 0 ? <p className="text-sm font-semibold text-slate-700">Наличными: <span className="font-black text-slate-950">{rub.format(totals.cash)}</span></p> : null}
          {totals.qr > 0 ? <p className="text-sm font-semibold text-slate-700">По QR: <span className="font-black text-slate-950">{rub.format(totals.qr)}</span></p> : null}
          {totals.bank > 0 ? <p className="text-sm font-semibold text-slate-700">Перевод поставщику: <span className="font-black text-slate-950">{rub.format(totals.bank)}</span></p> : null}
          {usdtSummary.exactUsdt > 0 ? <p className="text-sm font-semibold text-slate-700">Отправить: {usdtSummary.exactUsdt.toLocaleString('ru-RU')} USDT</p> : null}
          {usdtSummary.rublesAwaitingUsdt > 0 ? <p className="text-sm font-semibold text-slate-700">{usdtSummary.exactUsdt > 0 ? 'Дополнительно на оплату в USDT' : 'На оплату в USDT'}: ≈ {rub.format(usdtSummary.rublesAwaitingUsdt)}</p> : null}
        </div>
      ) : null}
      {message ? <p className="text-sm font-bold text-red-600">{message}</p> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="rounded-xl bg-slate-100 px-5 py-3 font-black text-slate-700">Отмена</button>
        <button disabled={saving || !plannedDate || !selected.length || mixedBasisSuppliers.length > 0} className="admin-material-primary rounded-xl px-5 py-3 font-black text-white disabled:opacity-40">
          {saving ? "Сохраняю…" : `Передать на согласование · ${selected.length}`}
        </button>
      </div>
    </form>
  );
}
