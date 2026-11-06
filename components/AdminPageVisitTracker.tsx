'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { adminPageRoute, type AdminPage } from '@/lib/admin-page-policy';

/** Visible route transitions only. Independent of refreshes and all business requests. */
export function AdminPageVisitTracker() {
  const path=usePathname(), search=useSearchParams();
  const page=adminPageRoute(path,search);
  const previous=useRef<AdminPage | undefined>(undefined);
  const last=useRef<{page:AdminPage;at:number}|null>(null);
  useEffect(()=>{
    if (!page) return;
    let disposed=false, timer:ReturnType<typeof setTimeout>;
    const controllers=new Set<AbortController>();
    function schedule() {
      clearTimeout(timer);
      if(document.visibilityState!=='visible') return;
      timer=setTimeout(()=>{
        if(disposed||document.visibilityState!=='visible'||last.current?.page===page&&Date.now()-last.current.at<30000)return;
        const input={key:crypto.randomUUID(),page,previous:previous.current};
        last.current={page:page!,at:Date.now()}; previous.current=page!;
        async function send(attempt=0):Promise<void> {
          if(disposed)return;
          const controller=new AbortController();controllers.add(controller);
          const timeout=setTimeout(()=>controller.abort(),6000);
          try {
            const res=await fetch('/api/admin/employees/access/pages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:controller.signal,keepalive:true});
            if((res.status===409||res.status===503)&&attempt<3&&!disposed)timer=setTimeout(()=>void send(attempt+1),[1500,4000,8000][attempt]);
          } catch {if(attempt<3&&!disposed)timer=setTimeout(()=>void send(attempt+1),[1500,4000,8000][attempt]);}
          finally{clearTimeout(timeout);controllers.delete(controller);}
        }
        void send();
      },350);
    }
    schedule(); document.addEventListener('visibilitychange',schedule);
    return()=>{disposed=true;clearTimeout(timer);controllers.forEach(c=>c.abort());document.removeEventListener('visibilitychange',schedule);};
  },[page]);
  return null;
}
