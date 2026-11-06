"use client";
import {procurementHistoryRate,procurementHistorySummary,procurementHistoryListMoney} from '@/lib/procurement-history-rate';

import {needsProcurementReceipt,receiptPaymentDate} from '@/lib/procurement-receipt-policy';
import { ProcurementSplitList } from "./ProcurementSplitList";
import {supplierOnlyPaymentLabel} from '@/lib/procurement-supplier-advance';
import { ProcurementAdminList } from "./ProcurementAdminList";
import { ProcurementAdminComment } from "./ProcurementAdminComment";
import { adminPaymentComment } from "@/lib/procurement-admin-comment";
import React, { useState } from "react";
import { ProcurementChangeHistory, type PlanChangeEvent } from './ProcurementChangeHistory';
import { COMPLETED_WITHOUT_TOPUP, paymentCompletion } from '@/lib/procurement-payment-completion';
import { ProcurementCompletionAction } from './ProcurementCompletionAction';
import { SMALL_REMAINDER_COMPLETED } from '@/lib/procurement-small-remainder';
import { useProcurementVisualPreview } from './ProcurementVisualPreview';
import { ProcurementReceipts } from './ProcurementReceipts';
import {fundingSourceLabel} from '@/lib/procurement-usdt-funding';

type HistoryPlan = {
  fundingSource?:string|null;
  condition?: string;
  paymentMethod?:string;foreignAmount?:string|number|null;exchangeRate?:string|number|null;
  status?:string;oneCCashEvidence?:unknown;
  id: string; supplierPartner: string; orderNumbers: string[]; plannedAmount: string | number; paymentPurpose?:string;
  manager?: { name: string };
  events?: PlanChangeEvent[];
  evidence?: {
    verification?: 'current' | 'last-confirmed' | 'unavailable';
    verifiedAt?: string;
    state?: string; remainingAmount?: number;
    issuedAmount: number; paidAmount: number; paidForeignAmount: number;
    actualExchangeRate: number | null; manualPaymentCount?: number;
    cashOrders?: { ref?: string; number: string; date?: string }[];
    currencyPayments?: { ref?: string; number: string; date: string; foreignAmount?: number; documentForeignAmount?: number; unallocatedForeignAmount?: number }[];
  };
};
const rub = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0, maximumFractionDigits: 2 });
function stamp(value?: string) {
  if(value&&/^\d{4}-\d{2}-\d{2}/.test(value))return value.slice(0,10);
  const m = value?.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

export function ProcurementPaymentHistory({ plans, hidden = false, showManager = false, splitView = false, compactBuyer = false, adminDialogs = false, searchQuery, receiptCounts={}, receiptLoadState='loading' }: { plans: HistoryPlan[]; hidden?: boolean; showManager?: boolean; splitView?: boolean; compactBuyer?: boolean;adminDialogs?:boolean;searchQuery?:string;receiptCounts?:Record<string,number>;receiptLoadState?:'loading'|'ready'|'error' }) {
  const dialogList=adminDialogs||compactBuyer;
  const List=dialogList?ProcurementAdminList:ProcurementSplitList;
  const compact = compactBuyer && !showManager;
  const visualPreview = useProcurementVisualPreview();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [documentBusy,setDocumentBusy]=useState(false);
  const dated = plans.map(plan => ({ plan, date: (plan.status===COMPLETED_WITHOUT_TOPUP?paymentCompletion(plan.oneCCashEvidence)?.at.slice(0,10):null) || [...(plan.evidence?.cashOrders || []), ...(plan.evidence?.currencyPayments || [])].map(row => stamp(row.date)).sort().at(-1) || "" })).sort((a, b) => b.date.localeCompare(a.date));

  const renderPlan = ({plan, date}: typeof dated[number]) => {
      if (visualPreview?.historyDetail) return visualPreview.historyDetail(plan.id);
      const evidence = plan.evidence;
      const historicalMoney=procurementHistoryListMoney(plan,plan.status===COMPLETED_WITHOUT_TOPUP?paymentCompletion(plan.oneCCashEvidence):null);
      const desktopSecondary=plan.paymentMethod==='USDT'?historicalMoney.secondary:undefined;
      const completed = plan.status===COMPLETED_WITHOUT_TOPUP;
      const completion = completed ? paymentCompletion(plan.oneCCashEvidence) : null;
      const smallRemainder = evidence?.state === SMALL_REMAINDER_COMPLETED;
      const paidForeign=completion?.paidForeignAmount??evidence?.paidForeignAmount??0;
      const usdt = paidForeign > 0;
      const documents = usdt ? evidence?.currencyPayments || [] : evidence?.cashOrders || [];
      const unallocated = (evidence?.currencyPayments || []).reduce((sum,row)=>sum+(row.unallocatedForeignAmount||0),0);
      const plainDetails = dialogList || splitView || Boolean(visualPreview?.plainPaymentDetails);
      const PaymentDetails = plainDetails ? 'div' : 'details';
      const historicalComment=adminPaymentComment(plan.condition||'',true);
      const historicalContext=dialogList&&(historicalComment.warning||smallRemainder)?<>{historicalComment.warning?<p>{historicalComment.warning}</p>:null}{smallRemainder?<p>Завершена автоматически: недоплата не больше 500 ₽ и 2% заявки. Долг в 1С не изменён.</p>:null}</>:undefined;
      const rate=procurementHistoryRate(plan);
      const savedRate=Number(plan.exchangeRate);
      const separateSavedRate=usdt&&savedRate>0&&rate!==procurementHistoryRate({...plan,evidence:undefined});
      const changeHistory = <div className="col-span-2"><ProcurementChangeHistory events={plan.events} buyerView={!showManager} conciseAdmin={splitView} context={historicalContext}/></div>;
      return <article key={plan.id} className={splitView || dialogList ? "payment-history-detail grid grid-cols-[minmax(0,1fr)_auto] gap-3" : "grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl border border-slate-200 p-4"}>
        <div className="min-w-0"><h3 className="font-black text-slate-950">{plan.supplierPartner}</h3><p className="mt-0.5 text-sm text-slate-600">{plan.paymentPurpose==='DELIVERY'?'Доставка':plan.orderNumbers.length ? `Заказ: ${plan.orderNumbers.filter(Boolean).join(", ") || "без номера"}` : supplierOnlyPaymentLabel(plan)}</p>{showManager && plan.manager ? <p className="mt-1 text-sm text-slate-600">{plan.manager.name}</p> : null}</div>
        <div className="text-right"><p className="mt-1 text-sm font-bold text-green-800">{completed||smallRemainder?'Завершена без доплаты':'Оплачено полностью'}</p>{smallRemainder ? <p className="mt-1 text-xs text-slate-600">Недоплата: {rub.format(evidence?.remainingAmount ?? 0)}</p> : null}</div>
        {dialogList?<div className="col-span-2 payment-history-summary" aria-label="Суммы и курс оплаты">
          <div><span>Сумма заявки</span><strong>{['USDT','CNY'].includes(plan.paymentMethod||'')&&Number(plan.foreignAmount)>0?`${Number(plan.foreignAmount).toLocaleString('ru-RU',{maximumFractionDigits:4})} ${plan.paymentMethod==='CNY'?'¥':'USDT'}`:rub.format(Number(plan.plannedAmount))}</strong>{['USDT','CNY'].includes(plan.paymentMethod||'')&&Number(plan.foreignAmount)>0?<small>≈ {rub.format(Number(plan.plannedAmount))}</small>:null}</div>
          <div><span>Оплачено</span><strong>{usdt?`${paidForeign.toLocaleString('ru-RU',{maximumFractionDigits:4})} USDT`:rub.format(completion?.paidAmount??Number(evidence?.issuedAmount||evidence?.paidAmount||0))}</strong>{usdt?<small>{rub.format(completion?.paidAmount??Number(evidence?.paidAmount||0))}</small>:null}</div>
          {rate?<div className="payment-history-course"><span>Курс</span><strong>{rate.replace('Курс: ','')}</strong>{separateSavedRate?<small>В заявке: {savedRate.toLocaleString('ru-RU')} ₽ / USDT</small>:null}</div>:null}
        </div>:<div className="col-span-2 payment-history-money"><div><span>Сумма заявки</span><strong>{['USDT','CNY'].includes(plan.paymentMethod||'')&&Number(plan.foreignAmount)>0?`${Number(plan.foreignAmount).toLocaleString('ru-RU',{maximumFractionDigits:4})} ${plan.paymentMethod==='CNY'?'¥':'USDT'}`:rub.format(Number(plan.plannedAmount))}</strong>{['USDT','CNY'].includes(plan.paymentMethod||'')&&Number(plan.foreignAmount)>0?<p>≈ {rub.format(Number(plan.plannedAmount))}{Number(plan.exchangeRate)>0?` · курс ${Number(plan.exchangeRate).toLocaleString('ru-RU')} ₽`:''}</p>:null}</div><div><span>Оплачено по расходнику</span><strong>{usdt ? `${paidForeign.toLocaleString('ru-RU',{maximumFractionDigits:4})} USDT` : rub.format(completion?.paidAmount??Number(evidence?.issuedAmount||0))}</strong><p>{date?new Date(`${date}T12:00:00Z`).toLocaleDateString('ru-RU',{day:'numeric',month:'long'}):'Подтверждено в 1С'}</p>{desktopSecondary?<p>{desktopSecondary}</p>:null}</div></div>}
        {evidence?.verification === 'last-confirmed' ? <p className="col-span-2 text-xs text-slate-500">Последняя проверка{evidence.verifiedAt ? `: ${new Date(evidence.verifiedAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} МСК` : ''}. Показан результат последней подтверждённой сверки.</p> : null}
        {Number(evidence?.manualPaymentCount) > 0 ? <p className="col-span-2 text-xs text-slate-600">Оплата по договору учтена в этой заявке.</p> : null}
        {unallocated>0 && !compact ? <p className="col-span-2 text-sm text-amber-800">В заявку зачтено {paidForeign.toLocaleString('ru-RU',{maximumFractionDigits:4})} USDT. Ещё {unallocated.toLocaleString('ru-RU',{maximumFractionDigits:4})} USDT не распределено по заявкам.</p> : null}
        <PaymentDetails {...(plainDetails?{}:{open:(splitView && !compact) || undefined})} className={`col-span-2 text-sm text-slate-600${plainDetails?' pd-payment-facts':''}${dialogList?' payment-history-documents':''}`}>{!plainDetails&&<summary className="cursor-pointer">Подробности оплаты</summary>}<div className="mt-2 space-y-1">
          {!dialogList&&plan.paymentMethod==='CNY'&&Number(plan.foreignAmount)>0?<p>По заявке: {Number(plan.foreignAmount).toLocaleString('ru-RU')} CNY{Number(plan.exchangeRate)>0?` · плановый курс ${Number(plan.exchangeRate).toLocaleString('ru-RU')} ₽ / CNY`:''}. Фактическая сумма — по рублёвому расходнику.</p>:null}
          {plan.paymentMethod==='USDT'&&plan.fundingSource?<p>Источник по заявке: {fundingSourceLabel(plan.fundingSource)}.</p>:null}
          {dialogList&&!documents.length?<p>{date?new Date(`${date}T12:00:00Z`).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'}):'Дата оплаты не подтверждена'}</p>:null}
          {documents.map((row, index) => <p key={row.ref || `${row.number}-${index}`} title={row.date}>Расходник №{row.number || "без номера"}{row.date ? ` · ${dialogList&&stamp(row.date)?new Date(stamp(row.date)+"T12:00:00Z").toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"}):row.date}` : ""}</p>)}
          {(evidence?.currencyPayments||[]).filter(row=>(row.unallocatedForeignAmount||0)>0).map(row=><p key={`amount-${row.ref||row.number}`}>Сумма расходника: {row.documentForeignAmount?.toLocaleString('ru-RU',{maximumFractionDigits:4})} USDT.</p>)}
          {compact && unallocated>0 ? <p>Переплата по заявке: {unallocated.toLocaleString('ru-RU',{maximumFractionDigits:4})} USDT.</p> : null}
          {!dialogList && usdt && evidence?.actualExchangeRate ? <p>Курс: {rub.format(evidence.actualExchangeRate)} · Рублёвый эквивалент: ≈ {rub.format(evidence.paidAmount)}</p> : null}
          {completion?<><p>Без доплаты: {completion.remainingForeignAmount!=null?`${completion.remainingForeignAmount.toLocaleString('ru-RU',{maximumFractionDigits:4})} USDT`:rub.format(completion.remainingAmount)}.</p><p>Причина: {completion.reason}</p>{!dialogList?<p>Оплата указана на дату завершения. Долг в 1С не изменён.</p>:null}</>:smallRemainder&&!dialogList?<><p>Завершена автоматически: недоплата не больше 500 ₽ и 2% заявки.</p><p>Долг в 1С не изменён.</p></>:!dialogList?<p>Заявка оплачена полностью. Общий долг поставщику учитывается отдельно.</p>:null}
        </div></PaymentDetails>
        {(splitView || dialogList) && plan.condition ? <div className="col-span-2"><ProcurementAdminComment value={dialogList?historicalComment.comment:plan.condition} historical /></div> : null}
        {!plainDetails&&changeHistory}
        {visualPreview?.detail ? <div className="col-span-2">{visualPreview.detail(plan.id)}</div> : null}
        {!visualPreview || visualPreview.persistedReceipts ? <div className="col-span-2"><ProcurementReceipts plans={[plan]} single inline={splitView||dialogList} admin={showManager} onBusyChange={setDocumentBusy}/></div> : null}
        {plainDetails&&changeHistory}
        {completed&&showManager?<div className="col-span-2"><ProcurementCompletionAction id={plan.id} supplier={plan.supplierPartner} reopen/></div>:null}
      </article>;

  };
  if (splitView || compactBuyer) return <List {...(dialogList?{busy:documentBusy}:{})} history={dialogList} searchQuery={searchQuery} items={dated.map(({plan,date})=>{
    const completion=plan.status===COMPLETED_WITHOUT_TOPUP?paymentCompletion(plan.oneCCashEvidence):null;
    const foreign=completion?.paidForeignAmount??plan.evidence?.paidForeignAmount??0;
    const paid=completion?.paidAmount??Number(plan.evidence?.issuedAmount||0);
    const difference=paid-Number(plan.plannedAmount);
    const unallocated=(plan.evidence?.currencyPayments||[]).reduce((sum,row)=>sum+(row.unallocatedForeignAmount||0),0);
    const money=procurementHistoryListMoney(plan,completion);
    const historyMoney=procurementHistorySummary(plan,completion);
    const count=receiptCounts[plan.id];
    const receiptState:'present'|'needed'|'loading'|'error'|undefined=receiptLoadState!=='ready'?receiptLoadState:count===undefined?'loading':count>0?'present':needsProcurementReceipt(plan,0,receiptPaymentDate(new Date().toISOString()))?'needed':undefined;
    return {historyMoney,receiptState,amountSecondary:money.secondary,id:plan.id,name:plan.supplierPartner,amount:money.amount,basis:plan.paymentPurpose==='DELIVERY'?'Доставка':plan.orderNumbers.length?'Заказ '+plan.orderNumbers.join(', '):supplierOnlyPaymentLabel(plan),method:plan.paymentMethod==='USDT'?'Перевод в USDT':plan.paymentMethod==='CNY'?'Перевод в юанях':plan.paymentMethod==='CASH'?'Наличные':plan.paymentMethod==='ACCOUNTABLE_QR'?'Оплата по QR':'Перевод на карту',dateLabel:dialogList&&date?new Date(date+"T12:00:00Z").toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"}).replace(/ г\.$/,""):undefined,meta:date?new Date(date+"T12:00:00Z").toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"}):"Дата не подтверждена",search:plan.orderNumbers.join(" "),warningTone:!compact&&completion&&unallocated<=0?"neutral" as const:undefined,warning:visualPreview?.historyWarnings?.[plan.id] ?? (compact?undefined:unallocated>0?`Вне заявок: ${unallocated.toLocaleString('ru-RU',{maximumFractionDigits:4})} USDT`:completion?"Завершена без доплаты":!foreign&&Math.abs(difference)>0.005?`Оплата ${difference>0?"больше":"меньше"} заявки на ${rub.format(Math.abs(difference))}`:undefined)};
  })} empty="Подтверждённых оплат пока нет." renderDetail={id=>renderPlan(dated.find(row=>row.plan.id===id)!)} />;
  if (!plans.length && !compact) return null;
  const matching = compact ? dated.filter(({plan}) => `${plan.supplierPartner} ${plan.orderNumbers.join(' ')}`.toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU'))) : dated;
  return <section aria-hidden={hidden || undefined} inert={hidden || undefined} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-black text-slate-900">История оплат</h2><span className="text-xs font-semibold text-slate-500">Всего: {plans.length}</span></div>
    {compact ? <label className="mb-4 block text-xs font-semibold text-slate-600">Найти поставщика или заказ<input type="search" value={query} onChange={event=>setQuery(event.target.value)} className="mt-1.5 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" /></label> : null}
    <div className="space-y-3">{(expanded || (compact && query.trim()) ? matching : matching.slice(0,compact ? 10 : 3)).map(renderPlan)}</div>
    {compact && !matching.length ? <p className="py-5 text-sm text-slate-500">{plans.length ? 'Оплаты не найдены.' : 'Подтверждённых оплат пока нет.'}</p> : null}
    {matching.length>(compact ? 10 : 3) && !(compact && query.trim())?<button type="button" onClick={()=>setExpanded(!expanded)} className="mt-3 text-sm font-bold text-slate-600">{expanded?"Свернуть историю":`Показать все (${matching.length})`}</button>:null}
  </section>;
}
