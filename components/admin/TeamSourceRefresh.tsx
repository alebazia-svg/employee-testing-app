'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { startVisibleSync } from '@/lib/visible-sync';
export function TeamSourceRefresh(){
 const router=useRouter();
 useEffect(()=>{ let lastRefresh=Date.now(); return startVisibleSync(()=>{
  if(Date.now()-lastRefresh<30_000)return;
  // Never refresh over an open correction or an unsaved text field.
  const active=document.activeElement;
  if(document.querySelector('[role="dialog"],dialog[open]')||active?.matches('input,textarea,select'))return;
  lastRefresh=Date.now();
  router.refresh();
 },60_000); },[router]);
 return null;
}
