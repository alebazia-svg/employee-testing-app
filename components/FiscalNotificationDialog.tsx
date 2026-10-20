'use client';
import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import type {FiscalReviewData} from '@/lib/fiscal-review-data';
import type {NotificationSelection} from './NotificationRecordDialog';
import {FiscalReviewContent} from './FiscalReviewContent';
import './procurement-admin-list.css';
export function FiscalNotificationDialog({item,onClose,onViewed}:{item:NotificationSelection;onClose:()=>void;onViewed?:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLElement|null>(null),viewed=useRef(false),callback=useRef(onViewed);callback.current=onViewed;
 const [detail,setDetail]=useState<FiscalReviewData|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[busy,setBusy]=useState(false);
 useEffect(()=>{const el=dialog.current!;opener.current=document.activeElement as HTMLElement;const overflow=document.body.style.overflow;el.showModal();document.body.style.overflow='hidden';return()=>{el.close();document.body.style.overflow=overflow;requestAnimationFrame(()=>opener.current?.isConnected&&opener.current.focus());};},[]);
 useEffect(()=>{const abort=new AbortController();setError('');setDetail(null);fetch(`/api/notification-details/admin/${encodeURIComponent(item.id)}`,{cache:'no-store',signal:abort.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(data.kind!=='fiscal'||!data.detail)throw Error();if(!abort.signal.aborted){setDetail(data.detail);if(!viewed.current){viewed.current=true;callback.current?.();}}}).catch(()=>{if(!abort.signal.aborted)setError('Не удалось загрузить проверку. Уведомление сохранено.');});return()=>abort.abort();},[item.id,retry]);
 return <dialog ref={dialog} className="pam-dialog fiscal-notification-dialog" aria-label="Проверка чека" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <header className="pam-dialog-heading"><h2>Проверка чека</h2><button aria-label="Закрыть проверку" disabled={busy} onClick={onClose}><X size={20}/></button></header>
  <div className="pam-dialog-content">{detail?<FiscalReviewContent detail={detail} onChanged={()=>setRetry(n=>n+1)} onBusyChange={setBusy}/>:!error?<p role="status" className="py-3 text-sm text-stone-500">Загружаем проверку…</p>:null}{error&&<div role="alert" className="mt-4 text-sm text-red-700"><p>{error}</p><button className="pam-button mt-3" onClick={()=>setRetry(n=>n+1)}>Повторить</button></div>}</div>
 </dialog>;
}
