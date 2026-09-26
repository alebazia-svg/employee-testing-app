'use client';
import React,{useEffect,useId,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
type Quote={quote:string;remainingAmount:number;remainingForeignAmount:number|null};
export function ProcurementCompletionAction({id,supplier,reopen=false,preview}:{id:string;supplier:string;reopen?:boolean;preview?:{quote:Quote;onSave:(reason:string)=>void}}){
  const router=useRouter(),dialog=useRef<HTMLDialogElement>(null),title=useId();
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[quote,setQuote]=useState<Quote|null>(null),[reason,setReason]=useState('');
  const action=reopen?'REOPEN':'COMPLETE';
  useEffect(()=>{const d=dialog.current;if(open&&!d?.open)d?.showModal();if(!open&&d?.open)d.close();return()=>{if(d?.open)d.close();};},[open]);
  async function start(){setOpen(true);setQuote(null);setError('');setReason('');setBusy(true);
    if(preview){setQuote(preview.quote);setBusy(false);return;}
    try{const r=await fetch(`/api/admin/procurement/payment-plans/${id}/completion?action=${action}`,{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error);setQuote(data);}catch(e){setError(e instanceof Error?e.message:'Не удалось проверить оплату.');}finally{setBusy(false);}}
  async function save(){if(!quote)return;setBusy(true);setError('');
    if(preview){preview.onSave(reason);setOpen(false);setBusy(false);return;}
    try{const r=await fetch(`/api/admin/procurement/payment-plans/${id}/completion`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,quote:quote.quote,reason})});const data=await r.json();if(!r.ok)throw Error(data.error);setOpen(false);router.refresh();}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить.');setQuote(null);}finally{setBusy(false);}}
  return <>
    <button type="button" onClick={start} className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">{reopen?'Вернуть в активные':'Завершить без доплаты'}</button>
    <dialog ref={dialog} aria-labelledby={title} onCancel={e=>{e.preventDefault();if(!busy)setOpen(false);}} className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl backdrop:bg-slate-900/40">
      <h2 id={title} className="text-xl font-black">{reopen?'Вернуть заявку в активные?':'Завершить без доплаты?'}</h2>
      <p className="mt-2 text-sm font-bold">{supplier}</p>
      {quote?<><p className="mt-4 text-sm">{reopen?'Остаток при завершении':'Не доплачивать'}: <strong>{quote.remainingForeignAmount!=null?`${quote.remainingForeignAmount.toLocaleString('ru-RU',{maximumFractionDigits:4})} USDT`:quote.remainingAmount.toLocaleString('ru-RU',{style:'currency',currency:'RUB'})}</strong></p><p className="mt-2 text-sm text-slate-600">{reopen?'Заявка снова появится в календаре.':'Заявка уйдёт в историю у вас и Астемира. Долг в 1С не изменится.'}</p><label className="mt-4 block text-sm font-semibold">Причина<textarea autoFocus maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal" placeholder={reopen?'Почему нужна доплата':'Например: окончательная сумма согласована с поставщиком'}/></label></>:null}
      {busy?<p role="status" className="mt-3 text-sm text-slate-600">Проверяем оплаты и сохраняем данные…</p>:null}
      {error?<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>:null}
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={()=>setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-50">Отмена</button><button type="button" disabled={busy||!quote||reason.trim().length<3} onClick={save} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{reopen?'Вернуть в активные':'Завершить заявку'}</button></div>
    </dialog>
  </>;
}
