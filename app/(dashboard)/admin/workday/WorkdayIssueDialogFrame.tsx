'use client';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
export function WorkdayIssueDialogFrame({children,title,onClose,dialogRef,loading=false}:{children:ReactNode;title:string;onClose:()=>void;dialogRef:RefObject<HTMLDialogElement>;loading?:boolean}) {
 const [showLoading,setShowLoading]=useState(false);
 useEffect(()=>{
  setShowLoading(false);
  if(!loading)return;
  const timer=setTimeout(()=>setShowLoading(true),150);
  return()=>clearTimeout(timer);
 },[loading]);
 const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const el=dialogRef.current!,opener=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  el.showModal();document.body.style.overflow='hidden';
  return()=>{el.close();document.body.style.overflow=overflow;requestAnimationFrame(()=>{if(opener?.isConnected&&!document.querySelector('dialog[open],[role="dialog"]'))opener.focus({preventScroll:true});});};
 },[dialogRef]);
 return <dialog ref={dialogRef} className="workday-issue-dialog" aria-label={title} aria-busy={loading} onCancel={e=>{e.preventDefault();close.current();}}>
  <header><h2>{title}</h2><button type="button" className="team-button" aria-label="Закрыть замечание" onClick={()=>close.current()}><X size={18}/></button>{showLoading&&loading&&<span role="status" className="absolute right-3 top-full rounded-b-md border border-t-0 border-stone-200 bg-white px-3 py-1 text-xs text-stone-600">Открываем следующий чек…</span>}</header>
  <div className="workday-issue-body">{children}</div>
 </dialog>;
}
