'use client';
import React,{useRef,useState} from 'react';
import {plannedFxRubles,plannedFxFromRubles,type PlannedRateReference} from '@/lib/procurement-planned-fx';

export function ProcurementCnyFields({amount,rate,reference,legacyRubles,multipleOrders=false,onChange}:{amount:string;rate:string;reference?:PlannedRateReference;legacyRubles?:string;multipleOrders?:boolean;onChange:(patch:{foreignAmount:string;exchangeRate:string;plannedAmount:string})=>void}) {
  const [rublesOnly,setRublesOnly]=useState(()=>!amount&&Number(legacyRubles)>0);
  const [rubles,setRubles]=useState(()=>!amount?legacyRubles||'':'');
  const foreignDraft=useRef({foreignAmount:amount,exchangeRate:rate,plannedAmount:''});
  const rublesEdited=useRef(false);
  const total=plannedFxRubles(amount,rate);
  const change=(foreignAmount:string,exchangeRate:string)=>{setRubles('');onChange({foreignAmount,exchangeRate,plannedAmount:String(plannedFxRubles(foreignAmount,exchangeRate)??'')});};
  const toggle=()=>{
    if(rublesOnly)onChange(rublesEdited.current||!foreignDraft.current.foreignAmount
      ? plannedFxFromRubles(rubles,foreignDraft.current.exchangeRate||rate||String(reference?.rate??''),2) : foreignDraft.current);
    else{
      foreignDraft.current={foreignAmount:amount,exchangeRate:rate,plannedAmount:String(total??'')};
      const next=total==null?rubles:String(total);setRubles(next);rublesEdited.current=false;
      onChange({foreignAmount:'',exchangeRate:'',plannedAmount:next});
    }
    setRublesOnly(!rublesOnly);
  };
  const input='mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900';
  return <div className="space-y-3">
    {rublesOnly?<div><label className="block text-sm font-bold">Сумма заявки, ₽<input className={input} type="number" required min="0.01" step="0.01" value={rubles} onChange={e=>{setRubles(e.target.value);rublesEdited.current=true;onChange({foreignAmount:'',exchangeRate:'',plannedAmount:e.target.value})}}/></label><button type="button" className="mt-1.5 text-xs font-semibold text-[#785537] underline underline-offset-4" onClick={toggle}>Указать в юанях</button></div>:<>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="text-sm font-bold">{multipleOrders?'Общая сумма перевода, CNY':'Сумма перевода, CNY'}<input className={input} type="number" required min="0.01" step="0.01" value={amount} onChange={e=>change(e.target.value,rate)}/></label><button type="button" className="mt-1.5 text-xs font-semibold text-[#785537] underline underline-offset-4" onClick={toggle}>Указать в рублях</button></div>
      <label className="text-sm font-bold">Курс, ₽ / CNY<input aria-label="Курс, ₽ / CNY" className={input} type="number" required min="0.000001" step="0.000001" value={rate} onChange={e=>change(amount,e.target.value)}/>
        {reference?.rate?<span className="mt-1.5 block text-xs font-normal text-slate-500">{reference.sourceLabel==='Комментарий заявки'?'Последний курс из заявки':'Последний курс из 1С'}{reference.conversionAt?' · '+new Date(reference.conversionAt).toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'}):''}{Number(rate)!==reference.rate?` · ${reference.rate.toLocaleString('ru-RU')} ₽ / CNY`:''}</span>:null}
      </label>
    </div>
    <div className="rounded-xl border border-[#dfcfbe] bg-[#faf5ef] px-3 py-2.5"><div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><p className="text-xs text-[#785537]">Ориентировочно в рублях</p><p className="font-bold tabular-nums">{total==null?'Укажите сумму и курс':total.toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽'}</p></div></div>
    </>}
  </div>;
}
