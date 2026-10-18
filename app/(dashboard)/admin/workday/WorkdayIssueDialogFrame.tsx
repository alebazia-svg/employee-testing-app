'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
export function WorkdayIssueDialogFrame({children,closeHref,title}:{children:ReactNode;closeHref:string;title:string}) {
 const dialog=useRef<HTMLDialogElement>(null),router=useRouter();
 const [discard,setDiscard]=useState(false),[destination,setDestination]=useState(closeHref);
 const close=()=>{
  if(dialog.current?.querySelector<HTMLTextAreaElement>('textarea')?.value.trim()){setDestination(closeHref);setDiscard(true);return;}
  router.replace(closeHref,{scroll:false});
 };
 useEffect(()=>{
  const el=dialog.current!,opener=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  el.showModal();document.body.style.overflow='hidden';
  return()=>{el.close();document.body.style.overflow=overflow;requestAnimationFrame(()=>{if(opener?.isConnected)opener.focus();});};
 },[]);
 return <dialog ref={dialog} className="workday-issue-dialog" aria-label={title} onClickCapture={e=>{
   const link=(e.target as HTMLElement).closest('a');
   if(link?.getAttribute('href')?.includes('&issue=') && dialog.current?.querySelector<HTMLTextAreaElement>('textarea')?.value.trim()){
    e.preventDefault();setDestination(link.getAttribute('href')!);setDiscard(true);
   }
  }} onCancel={e=>{e.preventDefault();close();}}>
  <header><h2>{title}</h2><button type="button" className="team-button" aria-label="Закрыть замечание" onClick={close}><X size={18}/></button></header>
  {discard&&<div className="workday-issue-discard" role="alert"><b>Сообщение не отправлено</b><p>Перейти без отправки? Черновик будет удалён.</p><button className="team-button" onClick={()=>setDiscard(false)}>Продолжить</button> <button className="team-button" onClick={()=>router.replace(destination,{scroll:false})}>Продолжить без отправки</button></div>}
  <div className="workday-issue-body" hidden={discard}>{children}</div>
 </dialog>;
}
