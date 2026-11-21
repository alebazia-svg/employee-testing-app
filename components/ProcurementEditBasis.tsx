'use client';
import {useState} from 'react';
import type {PaymentBasis} from '@/lib/procurement-debt-request';
export type BasisDraft={basis:PaymentBasis;orderRefs:string[]};
export const basisLabels={ORDER:'По заказу',DEBT:'В счёт долга поставщику',ADVANCE:'Аванс поставщику'};
export function ProcurementEditBasis({id,value,numbers,onChange,disabled}:{id:string;value:BasisDraft;numbers:Record<string,string>;onChange:(v:BasisDraft)=>void;disabled:boolean}) {
  const [choices,setChoices]=useState<{orders:{ref:string;number:string}[];debt:boolean}|null>(null);
  const [loading,setLoading]=useState(false),[error,setError]=useState('');
  async function load(){
    setLoading(true);setError('');
    try{
      const response=await fetch('/api/admin/procurement/payment-plans/'+id+'/edit',{cache:'no-store'});
      if(!response.ok)throw Error();
      setChoices(await response.json());
    }catch{setError('Заказы и долг пока недоступны. Попробуйте ещё раз.');}
    finally{setLoading(false);}
  }
  if(!choices)return <div><button className="pam-button" type="button" disabled={disabled||loading} onClick={load}>{loading?'Проверяем в 1С…':'Изменить основание'}</button>{error&&<p role="alert">{error}</p>}</div>;
  const selected=new Set(value.orderRefs);
  const orders=new Map(Object.entries(numbers));
  for(const o of choices.orders)orders.set(o.ref,o.number);
  return <fieldset disabled={disabled} className="space-y-2"><label className="block text-sm font-semibold">Основание оплаты
    <select className="mt-1 block min-h-11 w-full rounded-lg border px-3" value={value.basis} onChange={e=>onChange({basis:e.target.value as PaymentBasis,orderRefs:[]})}>
      {Object.entries(basisLabels).map(([k,label])=><option key={k} value={k} disabled={k==='DEBT'&&!choices.debt}>{label}</option>)}
    </select></label>{value.basis==='ORDER'&&<div className="max-h-44 overflow-auto">{[...orders].map(([ref,number])=><label key={ref} className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={selected.has(ref)} onChange={e=>onChange({...value,orderRefs:e.target.checked?[...selected,ref]:value.orderRefs.filter(r=>r!==ref)})}/>Заказ № {number}</label>)}{!orders.size&&'Нет доступных заказов'}</div>}</fieldset>;
}
