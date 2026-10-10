'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Native modal keeps the calendar inert and supports the existing discard dialog. */
export function ProcurementPaymentDialog({editing,busy,onClose,returnFocus,children}:{editing:boolean;busy:boolean;onClose:()=>void;returnFocus?:HTMLElement|null;children:ReactNode}) {
  const dialogRef=useRef<HTMLDialogElement>(null);
  const headingRef=useRef<HTMLHeadingElement>(null);
  const titleId=useId();
  useEffect(()=>{
    const dialog=dialogRef.current;
    if(!dialog)return;
    const opener=returnFocus??(document.activeElement instanceof HTMLElement?document.activeElement:null);
    const overflow=document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow='hidden';
    headingRef.current?.focus({preventScroll:true});
    return ()=>{
      dialog.close();
      document.body.style.overflow=overflow;
      // A nested discard dialog closes in the same commit and can otherwise
      // restore focus to this removed dialog after our cleanup has run.
      requestAnimationFrame(()=>{
        if(opener?.isConnected&&!document.querySelector('dialog[open]'))opener.focus({preventScroll:true});
      });
    };
  },[]);
  return <dialog ref={dialogRef} aria-labelledby={titleId} aria-modal="true"
    onCancel={event=>{event.preventDefault();if(!busy)onClose();}}
    onClick={event=>{
      if(event.target!==event.currentTarget||busy)return;
      const rect=event.currentTarget.getBoundingClientRect();
      if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)onClose();
    }}
    className="procurement-payment-dialog m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-[760px] overflow-hidden rounded-2xl border border-[var(--portal-border)] bg-white p-0 text-[var(--portal-text)] shadow-xl backdrop:bg-black/40 [&[open]]:flex [&[open]]:flex-col">
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--portal-border)] px-4 py-2 sm:px-5">
      <h2 ref={headingRef} tabIndex={-1} id={titleId} className="text-lg font-bold outline-none">{editing?'Изменить оплату':'Добавить оплату'}</h2>
      <button type="button" aria-label="Закрыть форму" disabled={busy} onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X className="h-5 w-5"/></button>
    </header>
    <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
  </dialog>;
}
