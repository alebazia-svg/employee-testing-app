"use client";

import React, { useState } from "react";
import { ProcurementChangeHistory, type PlanChangeEvent } from './ProcurementChangeHistory';

type HistoryPlan = {
  id: string; supplierPartner: string; orderNumbers: string[]; plannedAmount: string | number;
  manager?: { name: string };
  events?: PlanChangeEvent[];
  evidence?: {
    issuedAmount: number; paidAmount: number; paidForeignAmount: number;
    actualExchangeRate: number | null; manualPaymentCount?: number;
    cashOrders?: { ref?: string; number: string; date?: string }[];
    currencyPayments?: { ref?: string; number: string; date: string }[];
  };
};
const rub = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 2 });
function stamp(value?: string) {
  const m = value?.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

export function ProcurementPaymentHistory({ plans, hidden = false, showManager = false }: { plans: HistoryPlan[]; hidden?: boolean; showManager?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const dated = plans.map(plan => ({ plan, date: [...(plan.evidence?.cashOrders || []), ...(plan.evidence?.currencyPayments || [])].map(row => stamp(row.date)).sort().at(-1) || "" })).sort((a, b) => b.date.localeCompare(a.date));
  if (!plans.length) return null;
  return <section aria-hidden={hidden || undefined} inert={hidden || undefined} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-black text-slate-900">История оплат</h2><span className="text-xs font-semibold text-slate-500">Всего: {plans.length}</span></div>
    <div className="space-y-3">{(expanded ? dated : dated.slice(0, 3)).map(({ plan, date }) => {
      const evidence = plan.evidence;
      const usdt = Number(evidence?.paidForeignAmount) > 0;
      const documents = usdt ? evidence?.currencyPayments || [] : evidence?.cashOrders || [];
      return <article key={plan.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl border border-slate-200 p-4">
        <div className="min-w-0"><h3 className="font-black text-slate-950">{plan.supplierPartner}</h3><p className="mt-0.5 text-xs font-semibold text-slate-500">Заказ: {plan.orderNumbers.filter(Boolean).join(", ") || "без номера"}</p><p className="mt-2 text-xs text-slate-500">{usdt ? "Оплата в USDT" : `Запрошено: ${rub.format(Number(plan.plannedAmount))}`}</p>{showManager && plan.manager ? <p className="mt-1 text-xs text-slate-500">{plan.manager.name}</p> : null}</div>
        <div className="text-right"><p className="text-lg font-black tabular-nums text-slate-950 sm:text-xl">{usdt ? `${Number(evidence?.paidForeignAmount).toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT` : rub.format(Number(evidence?.issuedAmount || 0))}</p><p className="mt-1 text-xs font-bold text-green-800">Оплачено полностью</p><p className="mt-1 text-xs text-slate-500">{date ? new Date(`${date}T12:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : "Подтверждено в 1С"}</p></div>
        {Number(evidence?.manualPaymentCount) > 0 ? <p className="col-span-2 text-xs text-slate-600">Оплата по договору учтена в этой заявке.</p> : null}
        <details className="col-span-2 text-xs text-slate-500"><summary className="cursor-pointer">Подробности оплаты</summary><div className="mt-2 space-y-1">
          {documents.map((row, index) => <p key={row.ref || `${row.number}-${index}`}>Расходник №{row.number || "без номера"}{row.date ? ` · ${row.date}` : ""}</p>)}
          {usdt && evidence?.actualExchangeRate ? <p>Курс: {rub.format(evidence.actualExchangeRate)} · Рублёвый эквивалент: ≈ {rub.format(evidence.paidAmount)}</p> : null}
          <p>Заявка оплачена полностью. Остаток по заказу учитывается отдельно.</p>
        </div></details>
        <div className="col-span-2"><ProcurementChangeHistory events={plan.events} /></div>
      </article>;
    })}</div>
    {plans.length > 3 ? <button type="button" onClick={() => setExpanded(!expanded)} className="mt-3 text-sm font-bold text-slate-600">{expanded ? "Свернуть историю" : `Показать все (${plans.length})`}</button> : null}
  </section>;
}
