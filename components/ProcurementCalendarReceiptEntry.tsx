'use client';
import React,{useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {Paperclip} from 'lucide-react';
import type {ReceiptEntryView} from './ProcurementReceipts';
import './procurement-calendar-tools.css';
const subscribe=(notify:()=>void)=>{const q=window.matchMedia('(min-width:901px)');q.addEventListener('change',notify);return()=>q.removeEventListener('change',notify);};
const desktop=()=>window.matchMedia('(min-width:901px)').matches;
/** Move only the entry button; the original document workspace remains mounted. */
export function ProcurementCalendarReceiptEntry({target,pending,ready,loadError,open}:{target:HTMLElement|null}&ReceiptEntryView){
 const wide=useSyncExternalStore(subscribe,desktop,()=>false);
 const entry=<button type="button" className="procurement-receipt-button procurement-receipts-entry procurement-calendar-receipt-entry" data-actionable={ready&&!loadError&&pending.length>0||undefined} onClick={()=>open()}><span className="procurement-receipt-entry-icon"><Paperclip size={18}/></span>{loadError?'Чеки · не удалось обновить':ready?<><span>Нужны чеки</span><span className="procurement-receipt-entry-count">{pending.length}</span></>:'Чеки · загрузка'}</button>;
 return wide&&target?createPortal(entry,target):entry;
}
