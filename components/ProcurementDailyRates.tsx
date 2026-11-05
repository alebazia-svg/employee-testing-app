'use client';
import React,{useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {X} from 'lucide-react';
import type {DailyCurrency,DailyQuote,DailyRateRow} from '@/lib/procurement-daily-rate';
import './procurement-daily-rates.css';
import {useProcurementDailyQuotes} from './useProcurementDailyQuotes';

type Preview={day:string;currency:DailyCurrency;rate:number;fingerprint:string;rows:DailyRateRow[];excluded:DailyRateRow[]};
type Props={day:string;admin?:boolean;currencies?:string[];referenceRates?:Partial<Record<DailyCurrency,number|null>>};
const fmt=(n:number)=>n.toLocaleString('ru-RU',{maximumFractionDigits:6});
const rub=(n:number)=>n.toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽';
export function ProcurementDailyRates({day,admin=false,currencies=['USDT','CNY'],referenceRates={}}:Props){
 const {quotes,state}=useProcurementDailyQuotes(day),[selected,select]=useState<DailyCurrency|null>(null);
 const router=useRouter();
 const visible=(['USDT','CNY'] as const).filter(c=>currencies.includes(c));
 if(!visible.length)return null;
 return <div className="procurement-day-rates" aria-label="Курсы на день">
  {visible.map(currency=>{const q=quotes.find(q=>q.currency===currency),rate=q?.rate??referenceRates[currency];return <button type="button" key={currency} className="procurement-rate-quote" data-currency={currency} data-confirmed={state==='ready'&&!!q} onClick={()=>select(currency)} aria-label={`${currency}: ${rate?fmt(rate)+' рублей':'курс не задан'}, ${state==='error'?'не удалось проверить':q?'утверждён':'не утверждён'}`}>
   <span className="procurement-currency-logo" aria-hidden="true">{currency==='USDT'?'₮':'¥'}</span><span>{currency} <strong>{rate?fmt(rate)+' ₽':'—'}</strong></span>
  </button>;})}
  {state==='error'?<span className="procurement-rate-load-error">Курсы не проверены</span>:null}
  {selected?<DailyRateDialog day={day} currency={selected} quote={quotes.find(q=>q.currency===selected)??null} reference={referenceRates[selected]} admin={admin&&state==='ready'} close={()=>select(null)} onSaved={()=>{select(null);window.dispatchEvent(new Event('procurement-rates-changed'));router.refresh();}}/>:null}
 </div>;
}
export function DailyRateDialog({day,currency,quote,reference,admin,close,onSaved}:{day:string;currency:DailyCurrency;quote:DailyQuote|null;reference?:number|null;admin:boolean;close:()=>void;onSaved:(quote?:DailyQuote)=>void}){
 const ref=useRef<HTMLDialogElement>(null),[rate,setRate]=useState(String(quote?.rate??reference??'')),[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const d=ref.current!,opener=document.activeElement as HTMLElement|null;d.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{d.close();document.body.style.overflow=overflow;opener?.focus();};},[]);
 async function submit(action:'PREVIEW'|'CONFIRM'){
  setBusy(true);setError('');
  try{const r=await fetch('/api/admin/procurement/daily-rates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,day,currency,rate:Number(rate.replace(',','.')),...(action==='CONFIRM'?{fingerprint:preview?.fingerprint}:{})})});const b=await r.json();if(!r.ok)throw Error(b.error||'Не удалось сохранить курс.');if(action==='PREVIEW')setPreview(b);else onSaved(b.quote);}
  catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить курс.');if(action==='CONFIRM')setPreview(null);}finally{setBusy(false);}
 }
 return <dialog ref={ref} className="procurement-rate-dialog" aria-labelledby="daily-rate-title" onCancel={e=>{e.preventDefault();if(!busy)close();}}>
  <header><div><h2 id="daily-rate-title">Курс {currency}</h2><p>{new Date(day+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}</p></div><button type="button" onClick={close} disabled={busy} aria-label="Закрыть курс"><X size={22}/></button></header>
  <div className="procurement-rate-dialog-body">
   {quote?<p className="procurement-rate-confirmation">Курс утверждён<br/><span>{new Date(quote.createdAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})}</span></p>:<p>Курс не утверждён</p>}
   {admin?<label className="procurement-rate-input">Рублей за 1 {currency}<input autoFocus inputMode="decimal" value={rate} disabled={busy} onChange={e=>{setRate(e.target.value);setPreview(null);}}/></label>:<strong>{quote?.rate?fmt(quote.rate)+' ₽':reference?fmt(reference)+' ₽ · ориентир':'—'}</strong>}
   {preview?<><h3>Пересчёт заявок</h3>{preview.rows.length?<div className="procurement-rate-preview">{preview.rows.map(row=><div key={row.id}><div><strong>{row.supplier}</strong><small>{row.foreignAmount!==null?`${fmt(row.foreignAmount)} ${currency}`:'Сумма задана в рублях'}</small></div><div><span>{rub(row.before)}</span><strong>→ {rub(row.after)}</strong></div></div>)}</div>:<p>Заявок для обновления нет. Будет сохранён только курс.</p>}
    <p className="procurement-rate-preview-note">Согласование заявок сохраняется. Оплаченные и частично оплаченные заявки не меняются.</p>
    {preview.excluded.length?<details><summary>Без изменений · {preview.excluded.length}</summary>{preview.excluded.map(row=><p key={row.id}><strong>{row.supplier}</strong> · {row.reason}</p>)}</details>:null}
   </>:null}
   {error?<p role="alert" className="procurement-rate-error">{error}</p>:null}
  </div>
  <footer><button type="button" className="procurement-rate-secondary" disabled={busy} onClick={close}>{admin?'Отмена':'Закрыть'}</button>{admin?<button type="button" className="procurement-rate-primary" disabled={busy||!rate.trim()} onClick={()=>void submit(preview?'CONFIRM':'PREVIEW')}>{busy?'Проверяем…':preview?'Подтвердить':'Показать пересчёт'}</button>:null}</footer>
 </dialog>;
}
