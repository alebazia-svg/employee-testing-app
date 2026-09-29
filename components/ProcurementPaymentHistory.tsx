"use client";

import { ProcurementSplitList } from "./ProcurementSplitList";
import { ProcurementAdminComment } from "./ProcurementAdminComment";
import React, { useState } from "react";
import { ProcurementChangeHistory, type PlanChangeEvent } from './ProcurementChangeHistory';
import { COMPLETED_WITHOUT_TOPUP, paymentCompletion } from '@/lib/procurement-payment-completion';
import { ProcurementCompletionAction } from './ProcurementCompletionAction';

type HistoryPlan = {
  condition?: string;
  status?:string;oneCCashEvidence?:unknown;
  id: string; supplierPartner: string; orderNumbers: string[]; plannedAmount: string | number;
  manager?: { name: string };
  events?: PlanChangeEvent[];
  evidence?: {
    issuedAmount: number; paidAmount: number; paidForeignAmount: number;
    actualExchangeRate: number | null; manualPaymentCount?: number;
    cashOrders?: { ref?: string; number: string; date?: string }[];
    currencyPayments?: { ref?: string; number: string; date: string; foreignAmount?: number; documentForeignAmount?: number; unallocatedForeignAmount?: number }[];
  };
};
const rub = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 2 });
function stamp(value?: string) {
  const m = value?.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

export function ProcurementPaymentHistory({ plans, hidden = false, showManager = false, splitView = false }: { plans: HistoryPlan[]; hidden?: boolean; showManager?: boolean; splitView?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const dated = plans.map(plan => ({ plan, date: (plan.status===COMPLETED_WITHOUT_TOPUP?paymentCompletion(plan.oneCCashEvidence)?.at.slice(0,10):null) || [...(plan.evidence?.cashOrders || []), ...(plan.evidence?.currencyPayments || [])].map(row => stamp(row.date)).sort().at(-1) || "" })).sort((a, b) => b.date.localeCompare(a.date));

  const renderPlan = ({plan, date}: typeof dated[number]) => {
      const evidence = plan.evidence;
      const completed = plan.status===COMPLETED_WITHOUT_TOPUP;
      const completion = completed ? paymentCompletion(plan.oneCCashEvidence) : null;
      const paidForeign=completion?.paidForeignAmount??evidence?.paidForeignAmount??0;
      const usdt = paidForeign > 0;
      const documents = usdt ? evidence?.currencyPayments || [] : evidence?.cashOrders || [];
      const unallocated = (evidence?.currencyPayments || []).reduce((sum,row)=>sum+(row.unallocatedForeignAmount||0),0);
      return <article key={plan.id} className={splitView ? "grid grid-cols-[minmax(0,1fr)_auto] gap-3" : "grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl border border-slate-200 p-4"}>
        <div className="min-w-0"><h3 className="font-black text-slate-950">{plan.supplierPartner}</h3><p className="mt-0.5 text-xs font-semibold text-slate-500">{plan.orderNumbers.length ? `Заказ: ${plan.orderNumbers.filter(Boolean).join(", ") || "без номера"}` : "В счёт долга поставщику"}</p>{!splitView || usdt || Math.abs(Number(plan.plannedAmount) - (completion?.paidAmount ?? Number(evidence?.issuedAmount || 0))) > 0.005 ? <p className="mt-2 text-xs text-slate-500">{usdt ? "Оплата в USDT" : `Запрошено: ${rub.format(Number(plan.plannedAmount))}`}</p> : null}{showManager && plan.manager ? <p className="mt-1 text-xs text-slate-500">{plan.manager.name}</p> : null}</div>
        <div className="text-right"><p className="text-lg font-black tabular-nums text-slate-950 sm:text-xl">{usdt ? `${paidForeign.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} USDT` : rub.format(completion?.paidAmount??Number(evidence?.issuedAmount || 0))}</p><p className="mt-1 text-xs font-bold text-green-800">{completed?'Завершена без доплаты':'Оплачено полностью'}</p><p className="mt-1 text-xs text-slate-500">{date ? new Date(`${date}T12:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : "Подтверждено в 1С"}</p></div>
        {Number(evidence?.manualPaymentCount) > 0 ? <p className="col-span-2 text-xs text-slate-600">Оплата по договору учтена в этой заявке.</p> : null}
        {unallocated>0 ? <p className="col-span-2 text-sm text-amber-800">В заявку зачтено {paidForeign.toLocaleString('ru-RU',{maximumFractionDigits:4})} USDT. Ещё {unallocated.toLocaleString('ru-RU',{maximumFractionDigits:4})} USDT не распределено по заявкам.</p> : null}
        <details open={splitView || undefined} className="col-span-2 text-xs text-slate-500"><summary className="cursor-pointer">Подробности оплаты</summary><div className="mt-2 space-y-1">
          {documents.map((row, index) => <p key={row.ref || `${row.number}-${index}`}>Расходник №{row.number || "без номера"}{row.date ? ` · ${row.date}` : ""}</p>)}
          {(evidence?.currencyPayments||[]).filter(row=>(row.unallocatedForeignAmount||0)>0).map(row=><p key={`amount-${row.ref||row.number}`}>Сумма расходника: {row.documentForeignAmount?.toLocaleString('ru-RU',{maximumFractionDigits:4})} USDT.</p>)}
          {usdt && evidence?.actualExchangeRate ? <p>Курс: {rub.format(evidence.actualExchangeRate)} · Рублёвый эквивалент: ≈ {rub.format(evidence.paidAmount)}</p> : null}
          {completion?<><p>Без доплаты: {completion.remainingForeignAmount!=null?`${completion.remainingForeignAmount.toLocaleString('ru-RU',{maximumFractionDigits:4})} USDT`:rub.format(completion.remainingAmount)}.</p><p>Причина: {completion.reason}</p><p>Оплата указана на дату завершения. Долг в 1С не изменён.</p></>:<p>Заявка оплачена полностью. Общий долг поставщику учитывается отдельно.</p>}
        </div></details>
        {splitView && plan.condition ? <div className="col-span-2"><ProcurementAdminComment value={plan.condition} historical /></div> : null}
        <div className="col-span-2"><ProcurementChangeHistory events={plan.events} buyerView={!showManager} conciseAdmin={splitView} /></div>
        {completed&&showManager?<div className="col-span-2"><ProcurementCompletionAction id={plan.id} supplier={plan.supplierPartner} reopen/></div>:null}
      </article>;

  };
  if (splitView) return <ProcurementSplitList items={dated.map(({plan,date})=>{
    const completion=plan.status===COMPLETED_WITHOUT_TOPUP?paymentCompletion(plan.oneCCashEvidence):null;
    const foreign=completion?.paidForeignAmount??plan.evidence?.paidForeignAmount??0;
    const paid=completion?.paidAmount??Number(plan.evidence?.issuedAmount||0);
    const difference=paid-Number(plan.plannedAmount);
    const unallocated=(plan.evidence?.currencyPayments||[]).reduce((sum,row)=>sum+(row.unallocatedForeignAmount||0),0);
    return {id:plan.id,name:plan.supplierPartner,amount:foreign>0?foreign.toLocaleString("ru-RU",{maximumFractionDigits:4})+" USDT":rub.format(paid),meta:date?new Date(date+"T12:00:00Z").toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"}):"Дата не подтверждена",search:plan.orderNumbers.join(" "),warning:unallocated>0?`Вне заявок: ${unallocated.toLocaleString('ru-RU',{maximumFractionDigits:4})} USDT`:!foreign&&Math.abs(difference)>0.005?`Оплата ${difference>0?"больше":"меньше"} заявки на ${rub.format(Math.abs(difference))}`:undefined};
  })} empty="Подтверждённых оплат пока нет." renderDetail={id=>renderPlan(dated.find(row=>row.plan.id===id)!)} />;
  if (!plans.length) return null;
  return <section aria-hidden={hidden || undefined} inert={hidden || undefined} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-black text-slate-900">История оплат</h2><span className="text-xs font-semibold text-slate-500">Всего: {plans.length}</span></div>
    <div className="space-y-3">{(expanded ? dated : dated.slice(0,3)).map(renderPlan)}</div>
    {plans.length>3?<button type="button" onClick={()=>setExpanded(!expanded)} className="mt-3 text-sm font-bold text-slate-600">{expanded?"Свернуть историю":`Показать все (${plans.length})`}</button>:null}
  </section>;
}
