'use client';
import {useEffect,useState} from 'react';
import {paymentDeferral} from '@/lib/procurement-schedule';

type Plan={id:string;plannedDate:string;updatedAt?:string;oneCCashEvidence?:unknown};
const displayDate=(value:string)=>value&&Number.isFinite(Date.parse(value+'T12:00:00Z'))?new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z')):'выберите дату';
export function ProcurementFundingSchedule({plan,today,beforeApproval=false,onClose,onSaved,onStateChange}:{plan:Plan;today:string;beforeApproval?:boolean;onClose:()=>void;onSaved:(plan:Plan)=>void;onStateChange:(state:{dirty:boolean;busy:boolean;editing?:boolean})=>void}) {
 const previous=paymentDeferral(plan.oneCCashEvidence);
 const [date,setDate]=useState(previous?.date||''),[comment,setComment]=useState(previous?.comment||'');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[discard,setDiscard]=useState(false);
 const [resuming,setResuming]=useState(false),[resumeDate,setResumeDate]=useState(plan.plannedDate.slice(0,10)<today?today:plan.plannedDate.slice(0,10));
 const changed=!previous||date!==(previous.date||'')||comment!==previous.comment;
 const dirty=resuming||date!==(previous?.date||'')||comment!==(previous?.comment||'');
 useEffect(()=>{onStateChange({dirty,busy,editing:true});},[dirty,busy,onStateChange]);
 useEffect(()=>()=>onStateChange({dirty:false,busy:false}),[onStateChange]);
 async function save(action:'DEFER'|'RESUME') {
  if(busy)return;setBusy(true);setError('');
  try {
   const response=await fetch(`/api/procurement/payment-plans/${plan.id}/schedule`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,version:plan.updatedAt,...(action==='DEFER'?{date,comment}:{date:resumeDate})})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Не удалось сохранить отсрочку.');
   onSaved(data);
  }catch(e){setError(e instanceof Error?e.message:'Нет связи с порталом. Проверьте заявку перед повтором.');}finally{setBusy(false);}
 }
 const input='mt-1 block min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-normal';
 return <form aria-label="Отложить оплату" className="space-y-3 rounded-xl border border-stone-200 p-4" style={{gridColumn:'1 / -1'}} onSubmit={e=>{e.preventDefault();void save(resuming?'RESUME':'DEFER');}}>
  <h3 className="font-bold">{resuming?'Отменить отсрочку':previous?'Изменить отсрочку':'Отложить оплату'}</h3>
  {resuming?<fieldset disabled={busy}><label className="text-sm font-semibold">Подготовить к<input type="date" required min={today} value={resumeDate} onChange={e=>setResumeDate(e.target.value)} className={input}/></label><p className="mt-2 text-xs text-slate-600">После подтверждения заявка вернётся в план на выбранную дату.</p></fieldset>:<fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
   <label className="text-sm font-semibold">Когда будут деньги<input type="date" min={today} value={date} onChange={e=>setDate(e.target.value)} className={input}/><span className="mt-1 block text-xs font-normal text-slate-500">Не знаете дату — оставьте пустой</span></label>
   <label className="text-sm font-semibold">Комментарий Астемиру<textarea rows={2} maxLength={500} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Необязательно" className={input}/></label>
  </fieldset>}
  {!resuming&&date&&date<plan.plannedDate.slice(0,10)?<p className="text-xs text-slate-600">В календаре — {new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(plan.plannedDate))}: дата заявки позже.</p>:null}
  <p role="status" className="text-sm font-semibold">{resuming?'После сохранения: срок заявки — '+displayDate(resumeDate):date?'После сохранения: деньги будут готовы '+displayDate(date):'После сохранения: оплата отложена · дата уточняется'}</p>
  <p className="text-xs text-slate-600">{beforeApproval?'Заявка останется на согласовании.':'Согласование и уже оплаченная сумма сохранятся.'} Астемир получит уведомление.</p>
  {error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}
  {discard?<div role="alert" className="flex flex-wrap items-center gap-2 text-sm"><span>Отменить несохранённые изменения?</span><button type="button" className="pam-button" onClick={()=>setDiscard(false)}>Продолжить</button><button type="button" className="pam-button" onClick={onClose}>Не сохранять</button></div>:<div className="flex flex-wrap justify-end gap-2">
   {previous&&!resuming?<button type="button" className="pam-button mr-auto" disabled={busy} onClick={()=>{setResuming(true);setError('');}}>Отменить отсрочку</button>:null}
   <button type="button" className="pam-button" disabled={busy} onClick={()=>resuming?setResuming(false):dirty?setDiscard(true):onClose()}>{resuming?'Назад':'Отмена'}</button>
   <button type="submit" className="pam-button pam-primary" disabled={busy||(!resuming&&!changed)||!plan.updatedAt}>{busy?'Сохраняем…':resuming?'Вернуть в план':'Сохранить'}</button>
  </div>}
 </form>;
}
