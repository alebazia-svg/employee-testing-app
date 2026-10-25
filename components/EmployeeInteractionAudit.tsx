 'use client';
import { useEffect, useRef } from 'react';
import { useEmployeePreview } from './EmployeePreviewProvider';
import { sendEmployeeActivity } from './EmployeeActivityTracker';
import type { InteractionContext } from '@/lib/employee-interaction-policy';
export function useInteractionAudit() {
 const preview=useEmployeePreview();
 return (context: InteractionContext) => { if(!preview) sendEmployeeActivity({kind:'interaction',context}); };
}
/** Observe one explicitly instrumented visible element; never inspect arbitrary page text. */
export function InteractionShown({context}:{context:InteractionContext}) {
 const anchor=useRef<HTMLSpanElement>(null), preview=useEmployeePreview();
 const signature=JSON.stringify(context);
 useEffect(()=>{
  if(preview||typeof IntersectionObserver==='undefined')return;
  const el=anchor.current?.parentElement;if(!el)return;
  let sent=false;
  const record=()=>{if(sent||document.visibilityState!=='visible')return;const b=el.getBoundingClientRect();if(!b.width||!b.height||b.bottom<=0||b.top>=innerHeight)return;
   // A background page behind another modal is not evidence of a shown message.
   const modals=[...document.querySelectorAll('dialog[open], [role=dialog][aria-modal=true]')];const modal=modals.at(-1);if(modal&&!modal.contains(el))return;
   sent=true;sendEmployeeActivity({kind:'interaction',context:JSON.parse(signature)});
  };
  const observer=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))record();});observer.observe(el);
  document.addEventListener('visibilitychange',record);
  return()=>{observer.disconnect();document.removeEventListener('visibilitychange',record);};
 },[signature,preview]);
 return <span ref={anchor} hidden aria-hidden="true"/>;
}
