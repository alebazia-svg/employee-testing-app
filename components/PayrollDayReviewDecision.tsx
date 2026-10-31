'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Check,X} from 'lucide-react';
import './procurement-admin-list.css';
type Data={request:{id:string;payrollName:string;periodKey:string;dates:string[];status:string;decisionComment:string;employee:{name:string}};accessOnly?:boolean;fingerprint:string|null;rejectionFingerprint?:string;approvalBlocked?:string;additionalDays:number|null;amount:number|null};
export function PayrollDayReviewDecision({id,onClose,onViewed,readOnly=false}:{id:string;onClose?:()=>void;onViewed?:()=>void;readOnly?:boolean}){
 const [data,setData]=useState<Data|null>(null),[comment,setComment]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const modal=Boolean(onClose);
 const dialog=useRef<HTMLDialogElement>(null),viewed=useRef(false);const viewedCallback=useRef(onViewed);viewedCallback.current=onViewed;
 useEffect(()=>{const c=new AbortController();setError('');fetch('/api/admin/payroll/day-reviews/'+encodeURIComponent(id),{cache:'no-store',signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);return d;}).then(d=>{if(!c.signal.aborted){setData(d);if(!viewed.current){viewed.current=true;viewedCallback.current?.();}}}).catch(e=>{if(!c.signal.aborted)setError(e.message||'Не удалось открыть запрос.');});return()=>c.abort();},[id,refresh]);
 useEffect(()=>{if(!modal)return;const el=dialog.current!,opener=document.activeElement as HTMLElement;el.showModal();return()=>{el.close();opener?.focus();};},[modal]);
 async function decide(action:'approved'|'rejected'){
  const token=action==='rejected'?data?.rejectionFingerprint:data?.fingerprint;
  if(busy||readOnly||data?.request.status!=='pending'||!token)return;
  if(action==='rejected'&&!comment.trim()){setError('Напишите, что нужно уточнить.');return;}
  setBusy(true);setError('');try{const r=await fetch('/api/admin/payroll/day-reviews/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,comment,fingerprint:token})});const d=await r.json();if(!r.ok)throw Error(d.error);setComment('');setRefresh(v=>v+1);window.dispatchEvent(new Event('payroll-days-changed'));}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить решение.');}finally{setBusy(false);}
 }
 const monthLabel=data?new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(data.request.periodKey+'-01T12:00:00Z')):'';
 const content=<>
  <header className='pam-dialog-heading'><div><p className='text-xs font-semibold text-[#945c36]'>{monthLabel} · Выходы на подтверждение</p><h2 className='mt-1'>{data?.request.employee.name??'Запрос сотрудника'}</h2></div>{onClose&&<button aria-label='Закрыть запрос' disabled={busy} onClick={onClose}><X size={20}/></button>}</header>
  <div className='pam-dialog-content space-y-5'>
   {error&&<div role='alert'><p className='pam-error'>{error}</p><button className='pam-button' disabled={busy} onClick={()=>setRefresh(v=>v+1)}>Обновить запрос</button></div>}
   {!data?<p>Загружаем запрос…</p>:<>
    <div><h3 className='mb-2 text-sm font-semibold text-stone-500'>Заявленные дни</h3><p className='text-base'>{data.request.dates.map(d=>Number(d.slice(8))).join(', ')} · {monthLabel}</p></div>
    {data.accessOnly&&<p className='rounded-xl border border-stone-200 bg-[#faf8f4] p-4 text-sm leading-relaxed'>Месяц закрыт. Подтверждение восстановит доступ сотрудника к текущей зарплате. Утверждённый расчёт и выплаты не изменятся.</p>}
    {data.approvalBlocked&&<p role='status' className='text-sm text-amber-900'>{data.approvalBlocked}</p>}
    {['pending','approved'].includes(data.request.status)&&!data.approvalBlocked&&!data.accessOnly&&<div className='rounded-xl border border-stone-200 bg-[#faf8f4] p-4'><div className='flex justify-between gap-4 text-sm'><span>Дополнительно: {data.additionalDays??'—'} дн.</span><strong className='text-xl'>{data.amount===null?'—':'+ '+data.amount.toLocaleString('ru-RU')+' ₽'}</strong></div><p className='mt-2 text-sm text-stone-500'>Изменение начисления за выходы</p></div>}
    {data.request.status==='pending'?<>
     <p className='text-sm leading-relaxed text-stone-600'>Подтвердите фактически отработанные дни. {data.accessOnly?'':'Уже учтённые даты повторно не оплачиваются.'}</p>
     <label className='block text-sm font-semibold'>Комментарий<textarea rows={2} value={comment} disabled={busy||readOnly} maxLength={500} onChange={e=>setComment(e.target.value)} placeholder='При возврате укажите, что нужно исправить' className='mt-2 w-full rounded-xl border border-stone-300 p-3 text-base font-normal'/></label>
     {!readOnly&&<div className='grid gap-2 sm:grid-cols-2'><button disabled={busy||!!data.approvalBlocked} className='pam-button pam-primary' onClick={()=>void decide('approved')}><Check size={17}/>{busy?'Сохраняем…':'Подтвердить выходы'}</button><button disabled={busy} className='pam-button' onClick={()=>void decide('rejected')}>Вернуть на уточнение</button></div>}
    </>:<div role='status' className='rounded-xl bg-[#f5f4ef] p-4 text-sm'><strong>{data.request.status==='approved'?'Выходы подтверждены':data.request.status==='rejected'?'Запрос возвращён на уточнение':'Запрос отменён'}</strong>{data.request.decisionComment&&<p className='mt-2'>{data.request.decisionComment}</p>}<Link href={'/admin/payroll?month='+data.request.periodKey} className='mt-3 inline-block font-semibold text-[#945c36]'>Открыть расчёт зарплаты</Link></div>}
   </>}
  </div>
 </>;
 return onClose?<dialog ref={dialog} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} className='pam-dialog fiscal-notification-dialog' style={{height:'fit-content',maxWidth:560}} aria-label='Подтверждение выходов'>{content}</dialog>:<section className='mx-auto max-w-xl overflow-hidden rounded-2xl border border-stone-200 bg-white'>{content}</section>;
}
