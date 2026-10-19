'use client';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';
import {useEffect,useRef,useState} from 'react';
import {PROCUREMENT_CARGO} from '@/lib/procurement-cargo';
import {ProcurementCnyFields} from './ProcurementCnyFields';
import {ProcurementUsdtFields} from './ProcurementUsdtFields';
import {cnyCommentDraftPatch,cnyRateFromComment,plannedFxRubles,type PlannedRateReference} from '@/lib/procurement-planned-fx';

const input='mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold';
export function ProcurementCargoPaymentForm({preview=false,blocked=false,onCancel,onCreated,onDraftStateChange,cnyRateReference,usdtRateReference,availableUsdt=null}:{
  availableUsdt?:number|null;
  preview?:boolean;blocked?:boolean;onCancel:()=>void;onCreated:(plans:{id:string;plannedDate:string;[key:string]:unknown}[])=>void;
  onDraftStateChange:(state:{hasDraft:boolean;saving:boolean})=>void;
  cnyRateReference?:PlannedRateReference;usdtRateReference?:{rate:number|null;conversionAt?:string};
}){
  const inspection = useEmployeePreview();
  const [date,setDate]=useState(''),[method,setMethod]=useState('CASH'),[amount,setAmount]=useState(''),[rate,setRate]=useState(''),[comment,setComment]=useState('');
  const [saving,setSaving]=useState(false),[error,setError]=useState('');
  const [fundingSource,setFundingSource]=useState('');
  const [usdtRubles,setUsdtRubles]=useState('');
  const [cnyRubles,setCnyRubles]=useState('');
  const previousCommentRate=useRef<number|null>(null);
  const fx=method==='CNY'||method==='USDT';
  const total=method==='USDT'?Number(usdtRubles):method==='CNY'?(amount?plannedFxRubles(amount,rate):Number(cnyRubles)):Number(amount);
  const hasDraft=Boolean(date||amount||usdtRubles||comment||method!=='CASH');
  useEffect(()=>{onDraftStateChange({hasDraft,saving})},[hasDraft,saving,onDraftStateChange]);
  async function submit(event:React.FormEvent){
    event.preventDefault();setError('');
    if(inspection){setError('Режим проверки: заявка не отправлена.');return;}
    if(preview){setError('Проверка интерфейса: отправка отключена.');return;}
    if(blocked||!date||!total||total<=0){setError('Проверьте дату, сумму и доступность данных.');return;}
    setSaving(true);
    try{
      const response=await fetch('/api/procurement/payment-plans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        paymentPurpose:'DELIVERY',supplierPartner:PROCUREMENT_CARGO.supplierPartner,orderRefs:[],orderNumbers:[],plannedDate:date,
        plannedAmount:total,paymentMethod:method,currency:fx?method:'RUB',foreignAmount:fx?amount:null,exchangeRate:fx?rate:null,condition:comment,
        fundingSource:null,
      })});
      const body=await response.json();
      if(!response.ok){setError(body.error||'Не удалось создать заявку.');return;}
      onCreated([body]);
    }catch{setError('Не удалось подтвердить отправку. Проверьте календарь перед повторной попыткой.');}
    finally{setSaving(false);}
  }
  return <form onSubmit={submit} className="space-y-3 p-4 sm:px-5">
    <div><p className="text-xs font-bold text-slate-500">Перевозчик</p><p className="mt-1 text-base font-semibold">Юра Карго</p></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-bold">Подготовить к<input className={input} type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>
      <label className="text-sm font-bold">Способ оплаты<select className={input} value={method} onChange={e=>{setMethod(e.target.value);setAmount('');setUsdtRubles('');setCnyRubles('');setRate(String(e.target.value==='CNY'?cnyRateReference?.rate??'':e.target.value==='USDT'?usdtRateReference?.rate??'':''));previousCommentRate.current=null;}}>
        <option value="CASH">Наличные</option><option value="BANK">Перевод на карту</option><option value="ACCOUNTABLE_QR">Оплата по QR</option><option value="CNY">Перевод в юанях</option><option value="USDT">Перевод в USDT</option>
      </select></label>
    </div>
    {method==='CNY'?<ProcurementCnyFields amount={amount} rate={rate} reference={cnyRateReference} onChange={p=>{setAmount(p.foreignAmount);setRate(p.exchangeRate);setCnyRubles(p.plannedAmount)}}/>:method==='USDT'?<ProcurementUsdtFields amount={amount} rate={rate} source={fundingSource} available={availableUsdt} reference={usdtRateReference} onChange={p=>{setAmount(p.foreignAmount);setRate(p.exchangeRate);setUsdtRubles(p.plannedAmount);setFundingSource(p.fundingSource)}}/>:<>
      <label className="block text-sm font-bold">Сумма, ₽<input className={input} type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    </>}
    <label className="block text-sm font-bold">Комментарий <span className="font-normal text-slate-500">· необязательно</span><textarea className={input} rows={2} value={comment} onChange={e=>setComment(e.target.value)} onBlur={()=>{
      if(method!=='CNY')return;const patch=cnyCommentDraftPatch(comment,amount,rate,cnyRateReference?.rate,previousCommentRate.current);
      previousCommentRate.current=cnyRateFromComment(comment,true);if(patch?.exchangeRate!==undefined)setRate(patch.exchangeRate);
    }}/></label>
    {method!=='CASH'?<p className="text-xs text-slate-500">После перевода прикрепите чек.</p>:null}
    {error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}
    <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:-mx-5 sm:px-5">
      <button type="button" disabled={saving} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" onClick={onCancel}>Отмена</button>
      <button disabled={saving||blocked||!date||!total||total<=0} className="admin-material-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{saving?'Отправка…':'Отправить заявку'}</button>
    </div>
  </form>;
}
