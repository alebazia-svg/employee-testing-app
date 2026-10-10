'use client';

import React,{useEffect,useId,useRef,useState,type ComponentProps} from 'react';
import {Search} from 'lucide-react';
import type {ProcurementPaymentBatchForm} from './ProcurementPaymentBatchForm';
import {buyerOrderPurpose,supplierPosition,buyerAdvanceOffsetPending} from '@/lib/procurement-supplier-position';
import {matchesPaymentOrderSearch,sortPaymentPickerOrders,isRecentPaymentOrder,isSmallPaymentSuggestion} from '@/lib/procurement-payment-priority';
import {procurementPaymentCommentText} from '@/lib/procurement-order-comment';
import {ProcurementReceiptEvidence} from '@/components/ProcurementReceiptEvidence';
import {ProcurementPaymentDebtSummary} from '@/components/ProcurementPaymentDebtSummary';
import {ProcurementCnyFields} from '@/components/ProcurementCnyFields';
import {ProcurementUsdtFields} from '@/components/ProcurementUsdtFields';
import {ProcurementCargoPaymentForm} from '@/components/ProcurementCargoPaymentForm';
import {ProcurementDiscardDraftDialog} from '@/components/ProcurementDiscardDraftDialog';
import {cnyCommentDraftPatch,cnyRateFromComment} from '@/lib/procurement-planned-fx';
import {singlePaymentRequest,paymentOrderExcess} from '@/lib/procurement-single-payment';

type Props=ComponentProps<typeof ProcurementPaymentBatchForm>;
type Order=Props['orders'][number];
const rub=(value:number)=>value.toLocaleString('ru-RU',{style:'currency',currency:'RUB'});
const orderDate=(value:string)=>/^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10).split('-').reverse().join('.'):value.slice(0,10);
const empty=()=>({plannedAmount:'',paymentMethod:'CASH',foreignAmount:'',exchangeRate:'',fundingSource:'',condition:''});
const input='mt-1.5 w-full rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-sm font-semibold';

export function ProcurementPaymentForm({orders:sourceOrders,supplierBalances,initialSelectedRefs,onCreated,onCancel,onDraftStateChange,usdtRateReference,cnyRateReference,basisPreview=false,submissionBlocked=false,supplierDebtError=false,todayKey='',activeOrderRefs=[],activeSupplierNames=[],cargoAllowed=false,availableUsdt=null}:Props){
  const orders:Order[]=[...sourceOrders,...Object.entries(supplierDebtError?{}:supplierBalances)
    .filter(([name,b])=>supplierPosition(b)==='debt'&&!activeSupplierNames.includes(name))
    .map(([supplierPartner,b])=>({ref:'debt:'+supplierPartner,number:'',supplierPartner,supplierCounterparty:'',orderPaymentGap:0,supplierDebt:b.debt,plannedActiveAmount:0,unplannedAmount:b.debt,orderComment:''}))];
  const purpose=(o:Order)=>o.ref.startsWith('debt:')?'order':buyerOrderPurpose(o,supplierDebtError?undefined:supplierBalances[o.supplierPartner]);
  const selectable=(o:Order)=>!activeOrderRefs.includes(o.ref)&&['order','prepayment'].includes(purpose(o));
  const [refs,setRefs]=useState(()=>{
    const candidates=orders.filter(o=>initialSelectedRefs.includes(o.ref)&&selectable(o));
    return candidates.slice(0,1).map(o=>o.ref);
  });
  const selected=refs.flatMap(ref=>{const o=orders.find(o=>o.ref===ref);return o?[o]:[];});
  const first=selected[0];
  const ordersWithDetails=selected.filter(o=>!o.ref.startsWith('debt:')&&(o.receiptSettlement?.receipts.length||o.paymentClosure?.receipts.length||procurementPaymentCommentText(o.orderComment)));
  const [draft,setDraft]=useState(empty),[date,setDate]=useState('');
  const [basis,setBasis]=useState<'ORDER'|'DEBT'>(first?.ref.startsWith('debt:')?'DEBT':'ORDER');
  const [choosing,setChoosing]=useState(!first);
  const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[earlier,setEarlier]=useState(false);
  const [category,setCategory]=useState<'GOODS'|'DELIVERY'>('GOODS');
  const [pendingCategory,setPendingCategory]=useState<'GOODS'|'DELIVERY'|null>(null),[pendingOrder,setPendingOrder]=useState<Order|null>(null);
  const [cargoKey,setCargoKey]=useState(0),[cargoDraft,setCargoDraft]=useState({hasDraft:false,saving:false});
  const [saving,setSaving]=useState(false),[message,setMessage]=useState('');
  const picker=useRef<HTMLDivElement>(null),search=useRef<HTMLInputElement>(null),dateInput=useRef<HTMLInputElement>(null);
  const resultId=useId(),previousCommentRate=useRef<number|null>(null);
  const hasDraft=Boolean(refs.length||date||draft.plannedAmount||draft.foreignAmount||draft.condition);
  useEffect(()=>{onDraftStateChange?.({hasDraft:hasDraft||cargoDraft.hasDraft,saving:saving||cargoDraft.saving})},[hasDraft,saving,cargoDraft,onDraftStateChange]);
  useEffect(()=>{
    if(!hasDraft)return;
    const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[hasDraft]);
  useEffect(()=>{
    if(!open)return;
    const close=(e:PointerEvent)=>{if(e.target instanceof Node&&!picker.current?.contains(e.target))setOpen(false);};
    document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);
  },[open]);
  const today=todayKey||new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(new Date());
  const candidates=sortPaymentPickerOrders(orders.filter(selectable)
    .filter(o=>o.ref.startsWith('debt:')===(basis==='DEBT')))
    .filter(o=>query.trim()||!isSmallPaymentSuggestion(o))
    .filter(o=>basis==='DEBT'||query.trim()||earlier||isRecentPaymentOrder(o,today))
    .filter(o=>matchesPaymentOrderSearch(o,query));
  const history=query.trim()?sortPaymentPickerOrders(sourceOrders.filter(o=>!selectable(o)&&matchesPaymentOrderSearch(o,query))):[];
  function applyChoice(order:Order){
    setRefs([order.ref]);if(first?.ref!==order.ref)setDraft(empty());
    setChoosing(false);setQuery('');setOpen(false);setMessage('');
    requestAnimationFrame(()=>dateInput.current?.focus({preventScroll:true}));
  }
  function choose(order:Order){
    if(first&&first.ref!==order.ref&&(draft.plannedAmount||draft.foreignAmount||draft.condition))setPendingOrder(order);
    else applyChoice(order);
  }
  function openPicker(){setChoosing(true);setBasis(first?.ref.startsWith('debt:')?'DEBT':'ORDER');setQuery('');setOpen(true);requestAnimationFrame(()=>search.current?.focus());}
  const selectionInvalid=selected.length!==refs.length||selected.some(o=>!selectable(o));
  const positive=(value:string)=>Number.isFinite(Number(value))&&Number(value)>0;
  const validAmount=positive(draft.plannedAmount)&&(!['CNY','USDT'].includes(draft.paymentMethod)||!draft.foreignAmount||(positive(draft.foreignAmount)&&positive(draft.exchangeRate)));
  const excess=first?paymentOrderExcess(first,draft.plannedAmount):0;
  async function submit(event:React.FormEvent){
    event.preventDefault();setMessage('');
    if(!first||!date||!validAmount||selectionInvalid||submissionBlocked){setMessage('Проверьте дату, сумму и доступность выбранной оплаты.');return;}
    if(basisPreview){setMessage('Проверка интерфейса: заявка не отправляется.');return;}
    setSaving(true);
    try{
      const request=singlePaymentRequest(selected,{...draft,plannedDate:date});
      const response=await fetch(request.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request.body)});
      const body=await response.json();
      if(!response.ok){setMessage(body.error||'Не удалось отправить заявку.');return;}
      onCreated(Array.isArray(body.plans)?body.plans:[body]);
    }catch{setMessage('Отправка не подтверждена. Проверьте календарь перед повторной попыткой. Введённые данные сохранены.');}
    finally{setSaving(false);}
  }
  return <div className="procurement-single-payment">
    {cargoAllowed?<div className="flex gap-1 border-b border-[var(--portal-border)] px-4 pt-3 sm:px-5" role="group" aria-label="Назначение оплаты">
      {(['GOODS','DELIVERY'] as const).map(value=><button key={value} type="button" disabled={saving||cargoDraft.saving} aria-pressed={category===value} onClick={()=>{if(value===category)return;if(hasDraft||cargoDraft.hasDraft)setPendingCategory(value);else setCategory(value)}} className={`procurement-form-tab border-b-2 px-4 py-2.5 text-sm font-semibold ${category===value?'border-[#9a6d46] text-[#785537]':'border-transparent text-slate-500'}`}>{value==='GOODS'?'За товары':'За доставку'}</button>)}
    </div>:null}
    <div hidden={category!=='GOODS'}><form className="space-y-3 p-4 sm:px-5" onSubmit={submit}>
      {choosing||!first?<section className="space-y-3" aria-label="Выбор оплаты">
        <div className="flex items-end justify-between gap-3">
          <label className="block w-full text-sm font-bold">Основание оплаты<select className={input} value={basis} onChange={e=>{setBasis(e.target.value as 'ORDER'|'DEBT');setQuery('');setOpen(true)}}><option value="ORDER">По заказу</option><option value="DEBT">В счёт долга поставщику</option></select></label>
          {first?<button type="button" className="shrink-0 text-sm underline" onClick={()=>{setChoosing(false);setOpen(false)}}>Вернуться к оплате</button>:null}
        </div>
        <div ref={picker} onBlurCapture={e=>{if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget))setOpen(false)}} onKeyDown={e=>{if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();search.current?.focus();setOpen(false);}}}>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"/>
            <input ref={search} value={query} aria-label="Поставщик или номер заказа" aria-expanded={open} aria-controls={open?resultId:undefined} onFocus={()=>setOpen(true)} onClick={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true)}} placeholder={basis==='ORDER'?'Поставщик или номер заказа':'Название поставщика'} className="w-full rounded-xl border border-[var(--portal-border)] bg-white py-2.5 pl-10 pr-24 text-sm"/>
            <button type="button" className="absolute right-3 top-2.5 text-xs font-semibold text-[#785537]" onMouseDown={e=>e.preventDefault()} onClick={()=>setOpen(v=>!v)}>{open?'Свернуть':'Показать'}</button>
          </div>
          {open?<div id={resultId} className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-[var(--portal-border)] bg-white" aria-label={basis==='ORDER'?'Заказы для оплаты':'Поставщики с задолженностью'}>
            {candidates.map(o=><button key={o.ref} type="button" onClick={()=>choose(o)} aria-label={`Выбрать ${o.supplierPartner}${o.number?' · заказ '+o.number:''}`} className="procurement-choice flex w-full items-start justify-between gap-4 border-b border-[var(--portal-border)] px-3 py-3 text-left last:border-b-0 hover:bg-[#faf5ef]">
              <span className="min-w-0"><span className="block text-sm font-semibold">{o.supplierPartner}</span><span className="mt-1 block text-xs text-slate-500">{o.number?'Заказ № '+o.number+(o.date?' · '+o.date.slice(0,10):''):'В счёт долга поставщику'}</span></span>
              <span className="shrink-0 text-right"><span className="block text-sm font-semibold">{basis==='DEBT'?rub(o.supplierDebt):o.amount!=null?rub(o.amount):'—'}</span><span className="mt-1 block text-xs text-slate-500">{basis==='DEBT'?'Долг по 1С':'Сумма заказа'}</span></span>
            </button>)}
            {!candidates.length&&!history.length?<p className="p-3 text-sm text-slate-500">{supplierDebtError?'Данные поставщиков пока недоступны.':basis==='ORDER'&&query.trim()?'Заказ не найден. Попробуйте номер или название поставщика.':'Подходящих оплат не найдено.'}</p>:null}
            {basis==='ORDER'&&!query.trim()?<button type="button" className="p-3 text-xs underline" onClick={()=>setEarlier(v=>!v)}>{earlier?'Только недавние заказы':'Показать более ранние'}</button>:null}
            {basis==='ORDER'?history.map(o=><details key={o.ref} className="border-t border-[var(--portal-border)] p-3 text-sm"><summary>{o.supplierPartner} · №{o.number} — {activeOrderRefs.includes(o.ref)?'Заявка уже в календаре':purpose(o)==='review'?'Новая оплата недоступна':buyerAdvanceOffsetPending(o,supplierBalances[o.supplierPartner])?'У поставщика есть аванс':'Не предлагается для оплаты'}</summary><ProcurementReceiptEvidence evidence={o.receiptSettlement} paymentClosure={o.paymentClosure} noAcquisitions={o.noAcquisitions}/></details>):null}
          </div>:null}
        </div>
      </section>:null}
      {first?<>
        <section className="rounded-xl border border-[var(--portal-border)] bg-white p-3" aria-label="Выбранная оплата">
          <div className="flex items-start justify-between gap-4"><div><p className="text-base font-bold">{first.supplierPartner}</p><p className="mt-1 text-sm text-slate-600">{first.ref.startsWith('debt:')?'В счёт долга поставщику':'Заказ № '+first.number+(first.date?' · '+orderDate(first.date):'')}</p></div><button type="button" disabled={saving} onClick={()=>openPicker()} className="text-sm font-semibold text-[#785537] underline underline-offset-4">Изменить</button></div>
          <ProcurementPaymentDebtSummary balance={supplierBalances[first.supplierPartner]} unavailable={supplierDebtError} orders={selected} disabled={saving} onRemoveOrder={ref=>setRefs(current=>current.filter(value=>value!==ref))}/>
          {first.plannedActiveAmount>0?<p className="mt-2 text-xs font-semibold text-amber-800">Уже в заявках: {rub(first.plannedActiveAmount)}</p>:null}
          {ordersWithDetails.length?<details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer">Документы и комментарии</summary><div className="mt-2 space-y-3">
            {ordersWithDetails.map(o=><div key={o.ref}>
              {selected.length>1?<p className="font-semibold">Заказ №{o.number}</p>:null}
              {o.receiptSettlement?.receipts.length||o.paymentClosure?.receipts.length?<ProcurementReceiptEvidence evidence={o.receiptSettlement} paymentClosure={o.paymentClosure} inline/>:null}
              {procurementPaymentCommentText(o.orderComment)?<p className="mt-2">{procurementPaymentCommentText(o.orderComment)}</p>:null}
            </div>)}
          </div></details>:null}
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold">Подготовить к<input ref={dateInput} className={input} type="date" value={date} required onChange={e=>setDate(e.target.value)}/></label>
          <label className="text-sm font-bold">Способ оплаты<select className={input} value={draft.paymentMethod} onChange={e=>{const method=e.target.value;setDraft(current=>({...current,paymentMethod:method,plannedAmount:'',foreignAmount:'',exchangeRate:String((method==='CNY'?(cnyRateFromComment(current.condition,true)??cnyRateReference?.rate):method==='USDT'?usdtRateReference?.rate:null)??''),fundingSource:''}))}}>
            <option value="CASH">Наличные</option><option value="ACCOUNTABLE_QR">Оплата по QR</option><option value="USDT">Перевод в USDT</option><option value="CNY">Перевод в юанях</option><option value="BANK">Перевод на карту</option>
          </select></label>
        </div>
        {draft.paymentMethod==='USDT'?<ProcurementUsdtFields multipleOrders={selected.length>1} amount={draft.foreignAmount} rate={draft.exchangeRate} source={draft.fundingSource} available={availableUsdt} reference={usdtRateReference} onChange={patch=>setDraft(current=>({...current,...patch}))}/>:draft.paymentMethod==='CNY'?<ProcurementCnyFields multipleOrders={selected.length>1} amount={draft.foreignAmount} rate={draft.exchangeRate} reference={cnyRateReference} onChange={patch=>setDraft(current=>({...current,...patch}))}/>:<label className="block text-sm font-bold">{selected.length>1?'Общая сумма оплаты, ₽':'Сумма, ₽'}<input className={input} type="number" min="0.01" step="0.01" required value={draft.plannedAmount} onChange={e=>setDraft(current=>({...current,plannedAmount:e.target.value}))}/></label>}
        {first.ref.startsWith('debt:')&&Number(draft.plannedAmount)>first.supplierDebt+0.009?<p className="text-xs text-amber-800">Сумма выше текущего долга в 1С. Проверьте её перед отправкой.</p>:null}
        {excess>0?<p role="status" className="text-xs text-amber-800">Сумма превышает остаток по заказу на {rub(excess)}. Проверьте сумму перед отправкой.</p>:null}
        <label className="block text-sm font-bold">Комментарий <span className="font-normal text-slate-500">· необязательно</span><textarea className={input} rows={2} value={draft.condition} onFocus={()=>{previousCommentRate.current=cnyRateFromComment(draft.condition,true)}} onChange={e=>setDraft(current=>({...current,condition:e.target.value}))} onBlur={()=>{if(draft.paymentMethod==='CNY')setDraft(current=>({...current,...cnyCommentDraftPatch(current.condition,current.foreignAmount,current.exchangeRate,cnyRateReference?.rate,previousCommentRate.current)}))}}/></label>
      </>:null}
      {message?<p role="status" className="text-sm text-amber-800">{message}</p>:null}
      {selectionInvalid?<p role="alert" className="text-sm text-amber-800">Выбранная оплата больше недоступна. Измените выбор.</p>:null}
      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t border-[var(--portal-border)] bg-white px-4 py-3 sm:-mx-5 sm:px-5">
        <button type="button" disabled={saving} onClick={onCancel} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Отмена</button>
        <button disabled={saving||!first||!date||!validAmount||selectionInvalid||submissionBlocked} className="admin-material-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{saving?'Отправка…':'Отправить заявку'}</button>
      </div>
    </form></div>
    {cargoAllowed?<div hidden={category!=='DELIVERY'}><ProcurementCargoPaymentForm key={cargoKey} preview={basisPreview} blocked={submissionBlocked} onCancel={onCancel} onCreated={onCreated} onDraftStateChange={setCargoDraft} cnyRateReference={cnyRateReference} usdtRateReference={usdtRateReference} availableUsdt={availableUsdt}/></div>:null}
    <ProcurementDiscardDraftDialog open={pendingCategory!==null||pendingOrder!==null} editing={false} onKeep={()=>{setPendingCategory(null);setPendingOrder(null)}} onDiscard={()=>{
      if(pendingOrder){applyChoice(pendingOrder);setPendingOrder(null);return;}
      setRefs([]);setDraft(empty());setDate('');setChoosing(true);setOpen(false);setQuery('');setMessage('');setCargoDraft({hasDraft:false,saving:false});setCargoKey(k=>k+1);
      if(pendingCategory)setCategory(pendingCategory);setPendingCategory(null);
    }}/>
  </div>;
}
