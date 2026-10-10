'use client';
import React,{useRef,useState} from 'react';
import {plannedFxRubles,plannedFxFromRubles} from '@/lib/procurement-planned-fx';

export function ProcurementUsdtFields({amount,rate,reference,legacyRubles,multipleOrders=false,onChange}:{
  amount:string;rate:string;source:string;available:number|null;
  reference?:{rate:number|null;conversionAt?:string};legacyRubles?:string;multipleOrders?:boolean;
  onChange:(patch:{foreignAmount:string;exchangeRate:string;plannedAmount:string;fundingSource:string})=>void;
}) {
  const [rateEdited,setRateEdited]=useState(false);
  const [financialEdited,setFinancialEdited]=useState(false);
  const [rublesOnly,setRublesOnly]=useState(()=>!amount&&Number(legacyRubles)>0);
  const [rubles,setRubles]=useState(()=>!amount?legacyRubles||'':'');
  const displayRate=rate||(!rateEdited?String(reference?.rate??''):'');
  const savedAmount=legacyRubles?.trim()?Number(legacyRubles):null;
  const preserveSaved=!financialEdited&&savedAmount!=null&&Number.isFinite(savedAmount);
  const total=preserveSaved?savedAmount:plannedFxRubles(amount,displayRate);
  const legacy=preserveSaved;
  const foreignDraft=useRef({foreignAmount:amount,exchangeRate:rate,plannedAmount:legacyRubles||'',preserveSaved:false});
  const rublesEdited=useRef(false);
  const toggle=()=>{
    if(rublesOnly){
      const convert=rublesEdited.current||!foreignDraft.current.foreignAmount;
      setFinancialEdited(convert||!foreignDraft.current.preserveSaved);
      const {foreignAmount,exchangeRate,plannedAmount}=convert
        ? plannedFxFromRubles(rubles,foreignDraft.current.exchangeRate||displayRate,4) : foreignDraft.current;
      onChange({foreignAmount,exchangeRate,plannedAmount,fundingSource:''});
    }else{
      foreignDraft.current={foreignAmount:amount,exchangeRate:displayRate,plannedAmount:String(total??''),preserveSaved};
      const next=total==null?rubles:String(total);setRubles(next);rublesEdited.current=false;
      onChange({foreignAmount:'',exchangeRate:'',plannedAmount:next,fundingSource:''});
    }
    setRublesOnly(!rublesOnly);
  };
  // The buyer requests a transfer; the owner decides how to fund it.
  const change=(foreignAmount:string,exchangeRate:string)=>{setFinancialEdited(true);setRubles('');onChange({foreignAmount,exchangeRate,fundingSource:'',plannedAmount:String(plannedFxRubles(foreignAmount,exchangeRate)??'')});};
  const input='mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold';
  return <div className="space-y-3">
    {rublesOnly?<div><label className="block text-sm font-bold">Сумма заявки, ₽<input className={input} type="number" min="0.01" step="0.01" required value={rubles} onChange={e=>{setRubles(e.target.value);rublesEdited.current=true;setFinancialEdited(true);onChange({plannedAmount:e.target.value,foreignAmount:'',exchangeRate:'',fundingSource:''})}}/></label><button type="button" className="mt-1.5 text-xs font-semibold text-[#785537] underline underline-offset-4" onClick={toggle}>Указать в USDT</button></div>:<>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="text-sm font-bold">{multipleOrders?'Общая сумма перевода, USDT':'Сумма перевода, USDT'}<input className={input} type="number" min="0.0001" step="0.0001" required={!legacy} value={amount} onChange={e=>change(e.target.value,displayRate)}/></label><button type="button" className="mt-1.5 text-xs font-semibold text-[#785537] underline underline-offset-4" onClick={toggle}>Указать в рублях</button></div>
      <label className="text-sm font-bold">Курс, ₽ / USDT<input aria-label="Курс, ₽ / USDT" className={input} type="number" min="0.000001" step="0.000001" required={!legacy} value={displayRate} onChange={e=>{setRateEdited(true);change(amount,e.target.value)}}/>
        {reference?.rate?<span className="mt-1.5 block text-xs font-normal text-slate-500">Последний курс из 1С{reference.conversionAt?' · '+new Date(reference.conversionAt).toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'}):''}{Number(displayRate)!==reference.rate?` · ${reference.rate.toLocaleString('ru-RU')} ₽`:''}</span>:null}
      </label>
    </div>
    <div className="rounded-xl border border-[#dfcfbe] bg-[#faf5ef] px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><p className="text-xs text-[#785537]">{preserveSaved?'Сумма из заявки':'Ориентировочно в рублях'}</p>
      <p className="font-bold tabular-nums">{total==null?'Укажите сумму и курс':total.toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽'}</p></div>
    </div>
    </>}
  </div>;
}
