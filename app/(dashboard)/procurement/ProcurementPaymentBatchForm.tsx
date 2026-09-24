"use client";

import React, { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import type { SupplierBalance } from "@/lib/procurement-supplier-settlements";
import { buyerOrderPurpose, supplierPosition } from '@/lib/procurement-supplier-position';
import { procurementOrderCommentText } from "@/lib/procurement-order-comment";
import { summarizeDraftUsdt } from '@/lib/procurement-draft-summary';
import { matchesPaymentOrderSearch, sortPaymentPickerOrders, isRecentPaymentOrder, isSmallPaymentSuggestion } from '@/lib/procurement-payment-priority';
import { mixedPaymentBasisSuppliers, mixedPaymentBasisMessage } from '@/lib/procurement-payment-basis';
import { hasRecordedPaidClosure, hasCurrentPaymentClosure as closureIsFresh, type OrderPaymentClosure } from '@/lib/procurement-order-payment-closure';
import { ProcurementReceiptEvidence } from '@/components/ProcurementReceiptEvidence';

type Order = {
  amount?: number;
  noAcquisitions?: { checkedAt: string };
  receiptSettlement?: import('@/lib/procurement-planning-verification').OrderReceiptSettlement;
  paymentClosure?: OrderPaymentClosure;
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
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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
  initialSelectedRefs,
  onCreated,
  onCancel,
  usdtRateReference,
  basisPreview = false,
  submissionBlocked = false,
  supplierDebtError = false,
  todayKey = '',
  activeOrderRefs = [],
  activeSupplierNames = [],
}: {
  orders: Order[];
  supplierBalances: Record<string, SupplierBalance>;
  initialSelectedRefs: string[];
  onCreated: (plans: CreatedPlan[]) => void;
  onCancel: () => void;
  usdtRateReference?: { rate: number | null; checkedAt: string; sourceLabel: string; conversionAt?: string };
  basisPreview?: boolean;
  submissionBlocked?: boolean;
  supplierDebtError?: boolean;
  todayKey?: string;
  activeOrderRefs?: string[];
  activeSupplierNames?: string[];
}) {
  const orders: Order[] = useMemo(() => [...sourceOrders, ...Object.entries(supplierDebtError ? {} : supplierBalances)
    .filter(([supplier, balance]) => supplierPosition(balance) === 'debt' && !activeSupplierNames.includes(supplier))
    .map(([supplierPartner, balance]) => ({ref: `debt:${supplierPartner}`, number: '', supplierPartner, supplierCounterparty: '', orderPaymentGap: 0, supplierDebt: balance.debt, plannedActiveAmount: 0, unplannedAmount: balance.debt, orderComment: ''}))], [sourceOrders, supplierBalances, supplierDebtError, activeSupplierNames]);
  const [pickerBasis, setPickerBasis] = useState<'ORDER' | 'DEBT'>(initialSelectedRefs.some(ref=>ref.startsWith('debt:')) ? 'DEBT' : 'ORDER');
  const [showEarlier, setShowEarlier] = useState(false);
  const displayToday = todayKey || new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Moscow'}).format(new Date());
  const purpose = (order: Order) => order.ref.startsWith('debt:') ? 'order' : buyerOrderPurpose(order, supplierDebtError ? undefined : supplierBalances[order.supplierPartner]);
  const selectable = (order: Order) => !activeOrderRefs.includes(order.ref) && ['order','prepayment'].includes(purpose(order));
  const supplierBalanceText = (supplier: string) => {
    const balance = supplierBalances[supplier];
    if (supplierDebtError || supplierPosition(balance) === 'review') return "Долг по 1С недоступен";
    if (balance.debt > 0.009) return `Долг поставщику по 1С: ${rub.format(balance.debt)}`;
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
          selected: initialSelectedRefs.includes(order.ref) && selectable(order),
          plannedAmount: '',
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
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);
  const pickerResultsId = useId();
  useEffect(() => {
    if (!pickerOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) setPickerOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [pickerOpen]);
  const archived = sourceOrders.filter(order=>!selectable(order));
  const matchingHistory = sortPaymentPickerOrders(archived.filter(order => matchesPaymentOrderSearch(order, query)));
  const historyVisible = Boolean(query.trim()) && matchingHistory.length > 0;
  const selectedOrders = orders.filter((order) => rows[order.ref]?.selected && selectable(order));
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
      .filter(order => order.ref.startsWith('debt:') === (pickerBasis === 'DEBT'))
      .filter(selectable))
      .filter(order => query.trim() || !isSmallPaymentSuggestion(order))
      .filter(order => pickerBasis === 'DEBT' || query.trim() || showEarlier || isRecentPaymentOrder(order, displayToday))
      .filter(order => matchesPaymentOrderSearch(order, query));
  }, [orders, query, pickerBasis, showEarlier, displayToday, activeOrderRefs, supplierBalances, supplierDebtError]);
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
    if (submissionBlocked) { setMessage('Данные не загружены полностью. Обновите страницу перед отправкой.'); return; }
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
        <span className="mt-1 block text-xs font-normal text-slate-500">Для всех выбранных оплат.</span>
      </label>

      <div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-black text-slate-950">Выберите оплаты</h3>
            {pickerBasis === 'DEBT' ? <p className="text-sm text-slate-500">Без привязки к заказу.</p> : null}
          </div>
          <p className="text-sm font-extrabold text-slate-600">Выбрано: {selected.length}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Что добавить"><button type="button" aria-pressed={pickerBasis === 'ORDER'} onClick={() => {setPickerBasis('ORDER'); setQuery('');}} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${pickerBasis === 'ORDER' ? 'border-slate-700 bg-slate-100' : 'border-slate-200'}`}>По заказу</button><button type="button" aria-pressed={pickerBasis === 'DEBT'} onClick={() => {setPickerBasis('DEBT'); setQuery('');}} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${pickerBasis === 'DEBT' ? 'border-slate-700 bg-slate-100' : 'border-slate-200'}`}>В счёт долга поставщику</button></div>
        {pickerBasis === 'DEBT' && supplierDebtError ? <p role="status" className="mt-2 text-sm text-amber-800">Долги из 1С пока недоступны. Выбор поставщика появится после обновления.</p> : null}
        <div ref={pickerRef} data-payment-picker className="relative mt-3"
          onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPickerOpen(false); }}
          onKeyDown={event => {
            if (event.key === 'Escape' && pickerOpen) {
              event.preventDefault();
              event.stopPropagation();
              pickerInputRef.current?.focus();
              setPickerOpen(false);
            }
          }}>
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            ref={pickerInputRef}
            value={query}
            onFocus={() => setPickerOpen(true)}
            onClick={() => setPickerOpen(true)}
            onChange={(event) => {setQuery(event.target.value); setPickerOpen(true);}}
            placeholder={pickerBasis === 'DEBT' ? 'Название поставщика' : 'Поставщик или последние 3 цифры заказа'}
            aria-label="Поставщик или номер заказа"
            aria-expanded={pickerOpen}
            aria-controls={pickerOpen ? pickerResultsId : undefined}
            className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-20 font-semibold"
          />
          {query ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {setQuery(""); setPickerOpen(true);}}
              className="absolute right-10 top-2 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Очистить поиск"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <button type="button" aria-label={pickerOpen ? 'Свернуть список' : 'Показать список'}
            aria-expanded={pickerOpen} aria-controls={pickerOpen ? pickerResultsId : undefined}
            onMouseDown={event => event.preventDefault()}
            onClick={() => setPickerOpen(value => !value)}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
            <ChevronDown className={`h-4 w-4 ${pickerOpen ? 'rotate-180' : ''}`} />
          </button>
          {pickerOpen ? <div id={pickerResultsId}>
            <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white" aria-label={pickerBasis === 'DEBT' ? 'Поставщики с задолженностью' : 'Заказы для оплаты'}>
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
              {candidates.length ? <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500"><tr>
                  <th scope="col" className="px-3 py-3 font-medium">{pickerBasis === 'ORDER' ? 'Заказ' : 'Поставщик'}</th>
                  {pickerBasis === 'ORDER' ? <th scope="col" className="hidden px-3 py-3 font-medium sm:table-cell">Поставщик</th> : null}
                  <th scope="col" className="px-2 py-3 text-right font-medium">{pickerBasis === 'ORDER' ? 'Сумма заказа' : 'Долг'}</th>
                  <th scope="col" className="px-2 py-3 font-medium"><span className="sr-only">Выбрать</span></th>
                </tr></thead>
                <tbody>{candidates.map((order, index) => <Fragment key={order.ref}>
                  <tr className={`border-t border-slate-100 ${rows[order.ref]?.selected ? 'procurement-order-selected' : ''}`}>
                  <td className="px-3 py-3"><label htmlFor={`pick-${order.ref}`} className="cursor-pointer break-words font-bold text-slate-900">{pickerBasis === 'ORDER' ? `№ ${order.number || 'без номера'}` : order.supplierPartner}</label>{pickerBasis === 'ORDER' && order.date ? <span className="mt-1 block text-xs font-normal text-slate-500">{order.date.slice(0, 10)}</span> : null}{pickerBasis === 'ORDER' ? <span className="mt-1 block text-xs text-slate-600 sm:hidden">{order.supplierPartner}</span> : null}</td>
                  {pickerBasis === 'ORDER' ? <td className="hidden px-3 py-3 text-slate-600 sm:table-cell">{order.supplierPartner}</td> : null}
                  <td className="px-2 py-3 text-right font-semibold tabular-nums text-slate-800">{pickerBasis === 'ORDER' ? (typeof order.amount === 'number' && Number.isFinite(order.amount) ? rub.format(order.amount) : '—') : rub.format(order.unplannedAmount)}</td>
                  <td className="px-2 py-3"><label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center"><input id={`pick-${order.ref}`} type="checkbox" className="h-4 w-4 accent-slate-700" aria-label={`Выбрать ${order.number ? `заказ ${order.number} · ` : ''}${order.supplierPartner}`} checked={Boolean(rows[order.ref]?.selected)} onChange={event => change(order.ref, {selected:event.target.checked})} /></label></td>
                </tr></Fragment>)}</tbody>
              </table> : (
                <p className="px-3 py-3 text-sm font-semibold text-slate-500">{pickerBasis === 'ORDER' && historyVisible ? 'Заказ не предлагается для новой оплаты. Подробнее — ниже.' : pickerBasis === 'ORDER' && query.trim() ? 'Заказ не найден. В поиске — новые заказы за 90 дней и старые с непогашенными приобретениями.' : 'Ничего не найдено'}</p>
              )}
            </div>
        {pickerBasis === 'ORDER' && !query.trim() ? <button type="button" className="mt-2 text-sm font-semibold text-slate-600" onClick={()=>setShowEarlier(value=>!value)}>{showEarlier ? 'Только недавние заказы' : 'Показать более ранние'}</button> : null}
        {!query.trim() ? <p className="mt-2 text-xs text-slate-500">Остатки меньше 1 000 ₽ — через поиск.</p> : null}
        {pickerBasis === 'ORDER' && historyVisible ? <div className="mt-3 max-w-2xl divide-y divide-slate-100 rounded-xl border border-slate-200">
          {matchingHistory.map(order => <details key={order.ref} className="p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">{order.supplierPartner} · №{order.number} · {order.date?.slice(0,10)} — {activeOrderRefs.includes(order.ref) ? 'Заявка уже в календаре' : purpose(order)==='review' ? 'Новая оплата недоступна' : supplierPosition(supplierBalances[order.supplierPartner])==='no-debt' ? 'Долга поставщику нет' : hasRecordedPaidClosure(order) ? 'Оплачен' : 'По приобретениям долга нет'}</summary>
            {order.paymentClosure && !closureIsFresh(order) ? <p className="mt-1 text-xs text-amber-800">Данные от {new Date(order.paymentClosure.checkedAt).toLocaleString('ru-RU', {timeZone:'Europe/Moscow'})}. Ожидается обновление 1С.</p> : null}
            {order.receiptSettlement ? <ProcurementReceiptEvidence evidence={order.receiptSettlement} paymentClosure={order.paymentClosure} inline/> : <div className="mt-2 space-y-2 text-xs text-slate-600">{order.paymentClosure?.receipts.map(receipt => <div key={receipt.ref || receipt.number}><p className="font-semibold">Приобретение №{receipt.number} · {rub.format(receipt.amountRub)}</p>{receipt.payments.map(payment => <p key={`${payment.ref || payment.number}:${payment.method}`}>РКО №{payment.number} · {payment.date.split(' ')[0]} · {payment.amount.toLocaleString('ru-RU')} {payment.currency} · {payment.method === 'advance' ? 'зачёт аванса' : 'оплата приобретения'} {rub.format(payment.appliedRub)}</p>)}</div>)}</div>}
          </details>)}
        </div> : null}
          </div> : null}
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
                  <div>{!debtBasis ? <span className="block text-sm font-semibold text-slate-700">Заказ № {order.number || 'без номера'}{order.date ? ` · ${order.date.slice(0,10)}` : ''}</span> : <span className="text-sm font-semibold text-slate-700">В счёт долга поставщику</span>}</div>
                  </div>
                  {!debtBasis && order.plannedActiveAmount > 0 ? <span className="block text-xs font-semibold text-amber-700">Уже в заявках: {rub.format(order.plannedActiveAmount)}</span> : null}
                  {!debtBasis ? <p className="text-sm text-slate-700">Сумма заказа: {typeof order.amount === 'number' && Number.isFinite(order.amount) ? rub.format(order.amount) : '—'}</p> : null}
                  {!debtBasis ? <ProcurementReceiptEvidence evidence={order.receiptSettlement} paymentClosure={order.paymentClosure} noAcquisitions={order.noAcquisitions} /> : null}
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
                      {row.paymentMethod === 'USDT' ? 'Ориентир в рублях' : 'Сколько перечислить сейчас, ₽'}
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
                  <p className="mt-1 text-xs text-slate-500 sm:col-span-2">Укажите сумму, согласованную с поставщиком.</p>
                  {!debtBasis && order.planningState !== 'needs_review' && Number(row.plannedAmount || 0) > order.unplannedAmount + 0.009 ? (
                    <p className="text-xs font-bold text-red-700 sm:col-span-2">Сумма больше незапланированного остатка на {rub.format(Number(row.plannedAmount) - order.unplannedAmount)}. Проверьте сумму перед отправкой.</p>
                  ) : null}
                  {debtBasis && (Number(row.plannedAmount) || Number(row.foreignAmount) * Number(usdtRateReference?.rate)) > order.supplierDebt + 0.009 ? <p className="text-xs font-semibold text-amber-800 sm:col-span-3">Сумма выше текущего долга в 1С. Проверьте её перед отправкой.</p> : null}
                </div>
                {!debtBasis && orderComment ? orderComment.length > 100 ? <details className="group min-w-0 text-xs text-slate-600 sm:col-span-3">
                  <summary className="flex cursor-pointer items-baseline gap-2"><span className="shrink-0 font-semibold">Комментарий 1С</span><span className="min-w-0 truncate group-open:hidden">{orderComment}</span><span className="shrink-0 underline group-open:hidden">Полностью</span><span className="hidden underline group-open:inline">Свернуть</span></summary>
                  <p className="mt-2 whitespace-pre-wrap break-words">{orderComment}</p>
                </details> : <p className="break-words text-xs text-slate-600 sm:col-span-3"><span className="font-semibold">Комментарий 1С: </span>{orderComment}</p> : null}
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
            <p className="py-2 text-sm text-slate-500">Отметьте оплаты галочками — здесь появятся поля для суммы.</p>
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
        <button disabled={saving || submissionBlocked || !plannedDate || !selected.length || mixedBasisSuppliers.length > 0} className="admin-material-primary rounded-xl px-5 py-3 font-black text-white disabled:opacity-40">
          {saving ? "Сохраняю…" : `Передать на согласование · ${selected.length}`}
        </button>
      </div>
    </form>
  );
}
