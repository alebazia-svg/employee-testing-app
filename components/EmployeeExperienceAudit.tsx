'use client';
import { useEffect, useRef } from 'react';
import { useEmployeePreview } from './EmployeePreviewProvider';
import { sendEmployeeActivity } from './EmployeeActivityTracker';
import type { ExperienceContext } from '@/lib/employee-experience-policy';

export function auditExperience(context:ExperienceContext) {
 try { sendEmployeeActivity({kind:'experience',context}); } catch { /* Observation must never interrupt work. */ }
}
export function experienceAttempt() { try { return crypto.randomUUID(); } catch { return `unavailable-${Date.now()}`; } }
/** Record a known element only once it is actually visible and not behind a modal. */
export function ExperienceShown({context,onShown}:{context:ExperienceContext;onShown?:()=>void}) {
 const anchor=useRef<HTMLSpanElement>(null),preview=useEmployeePreview();
 const shown=useRef(onShown);shown.current=onShown;
 const signature=JSON.stringify(context);
 useEffect(()=>{
  if(preview)return;
  const el=anchor.current?.parentElement;if(!el)return;
  let sent=false;
  const observe=()=>{
   if(sent||document.visibilityState!=='visible')return;
   const box=el.getBoundingClientRect();if(!box.width||!box.height||box.bottom<=0||box.top>=innerHeight)return;
   const top=[...document.querySelectorAll('dialog[open], [role=dialog][aria-modal=true]')].at(-1);
   if(top&&!top.contains(el))return;
   sent=true;intersection.disconnect();mutation.disconnect();document.removeEventListener('visibilitychange',observe);auditExperience(JSON.parse(signature));shown.current?.();
  };
  const intersection=new IntersectionObserver(observe);intersection.observe(el);
  const mutation=new MutationObserver(observe);mutation.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
  document.addEventListener('visibilitychange',observe);observe();
  return()=>{intersection.disconnect();mutation.disconnect();document.removeEventListener('visibilitychange',observe);};
 },[signature,Boolean(preview)]);
 return <span ref={anchor} hidden aria-hidden='true'/>;
}
