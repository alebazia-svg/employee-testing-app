'use client';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useMemo, useState, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, RefreshCw } from 'lucide-react';
import { employeePreviewHref } from '@/lib/employee-navigation';
import { employeePreviewUrl } from '@/lib/employee-preview-request';
import type { InspectionDeviceSnapshot } from '@/lib/employee-inspection-state';
import { EmployeeInspectionDevice } from './EmployeeInspectionDevice';
import { startVisibleSync } from '@/lib/visible-sync';
type Preview = { connectionId: string; deviceSnapshot: InspectionDeviceSnapshot | null; href: (input: string) => string; readUrl: (input: string) => string; topInset: number; request: (input: string, init?: RequestInit) => Promise<Response>; blocked: () => void };
const Context = createContext<Preview | null>(null);
export const useEmployeePreview = () => useContext(Context);
export function EmployeePreviewProvider({ visitId, employeeName, expiresAt, children, procurement = false, frame, connection }: { visitId: string; employeeName: string; expiresAt: string; children: ReactNode; procurement?: boolean; frame?: 'phone' | 'desktop'; connection?: string }) {
  const banner = useRef<HTMLElement>(null);
  const [topInset, setTopInset] = useState(frame ? 0 : 64);
  useLayoutEffect(() => {
    if (!banner.current) return;
    const update = () => setTopInset(banner.current?.getBoundingClientRect().height ?? 64);
    const observer = new ResizeObserver(update); observer.observe(banner.current); update();
    return () => observer.disconnect();
  }, []);
  const [notice, setNotice] = useState(''), [expired, setExpired] = useState(false);
  const [requestedConnection,setRequestedConnection] = useState(connection ?? '');
  const [deviceSnapshot,setDeviceSnapshot] = useState<InspectionDeviceSnapshot | null>(null);
  const blocked = useCallback(() => setNotice('Режим проверки: изменения не сохранены, действие сотрудника не выполнено.'),[]);
  const request = useCallback(async (input: string,init?: RequestInit) => {
    const url = employeePreviewUrl(visitId,input,init);
    const response = await fetch(url,{...init,method:'GET',cache:'no-store'});
    if ([401,403,410].includes(response.status)) setExpired(true);
    return response;
  },[visitId]);
  const readUrl = useCallback((input:string)=>employeePreviewUrl(visitId,input),[visitId]);
  useEffect(()=>{
    let active=true,flight:AbortController|null=null;
    const refresh=async()=>{
      if(flight)return;
      const controller=new AbortController();flight=controller;
      const timeout=setTimeout(()=>controller.abort(),10000);
      try {
        const response=await request('/api/employee/app-setup'+(requestedConnection ? '?connection='+encodeURIComponent(requestedConnection):''),{signal:controller.signal});
        const data=response.ok ? await response.json():null;
        if(active)setDeviceSnapshot(data && Array.isArray(data.connections) ? data : {connections:[],selectedId:null,unavailable:true});
      }catch{if(active)setDeviceSnapshot({connections:[],selectedId:null,unavailable:true});}
      finally{clearTimeout(timeout);if(flight===controller)flight=null;}
    };
    const stop=startVisibleSync(refresh,5000);
    return()=>{active=false;stop();flight?.abort();};
  },[request,requestedConnection]);
  const selectedConnection=deviceSnapshot?.selectedId ?? requestedConnection;
  const href=useCallback((input:string)=>employeePreviewHref(visitId,input,{procurement,frame,connection:selectedConnection || undefined}),[visitId,procurement,frame,selectedConnection]);
  const value = useMemo<Preview>(()=>({topInset,href,readUrl,request,blocked,deviceSnapshot,connectionId:selectedConnection}),[topInset,href,readUrl,request,blocked,deviceSnapshot,selectedConnection]);
  const selectConnection=(id:string)=>{
    setDeviceSnapshot(null);setRequestedConnection(id);
    const url=new URL(window.location.href);url.searchParams.set('connection',id);
    window.history.replaceState(null,'',url.pathname+url.search+url.hash);
  };
  useEffect(() => {
    // Links in reused sheets must not leave inspection for an ordinary employee route.
    const guardNavigation = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      const href = link?.getAttribute('href');
      if (!href) return;
      const url = new URL(href, window.location.origin);
      if (url.origin === window.location.origin && /^\/(?:employee|procurement)(?:\/|$)/.test(url.pathname)) {
        event.preventDefault(); event.stopImmediatePropagation(); blocked();
      }
    };
    document.addEventListener('click', guardNavigation, true);
    return () => document.removeEventListener('click', guardNavigation, true);
  }, [blocked]);
  useEffect(() => { const timer = window.setTimeout(() => setExpired(true), Math.max(0, Date.parse(expiresAt) - Date.now())); return () => window.clearTimeout(timer); }, [expiresAt]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 4500); return () => window.clearTimeout(timer); }, [notice]);
  return <Context.Provider value={value}>
    {!frame && <aside ref={banner} aria-label="Режим проверки сотрудника" className="sticky top-0 z-40 border-b border-[#d7c4b1] bg-[#f8eee3] px-4 py-3 text-[#493829] shadow-sm">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><Eye size={21} className="shrink-0"/><div><p className="text-sm font-bold">Режим проверки · {employeeName}</p><p className="mt-0.5 text-xs">Проверка интерфейса · изменения не сохраняются</p></div></div>
        <div className="flex gap-2"><button onClick={() => window.location.reload()} className="flex min-h-10 items-center gap-2 rounded-xl border border-[#d7c4b1] bg-white px-3 text-xs font-semibold"><RefreshCw size={15}/>Обновить</button><Link href="/admin/employees" className="flex min-h-10 items-center gap-2 rounded-xl bg-[#313539] px-3 text-xs font-semibold text-white"><ArrowLeft size={15}/>К сотрудникам</Link></div>
      </div>
    </aside>}
    {!expired && !frame && <EmployeeInspectionDevice snapshot={deviceSnapshot} selectedId={selectedConnection} onSelect={selectConnection} framed={Boolean(frame)} />}
    {expired ? <section className="mx-auto max-w-lg p-8"><h1 className="text-xl font-bold">Просмотр завершён</h1><p className="mt-3">Вернитесь к сотрудникам и откройте проверку заново.</p></section> : children}
    {notice && <div role="status" className="fixed bottom-24 left-1/2 z-[200] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-[#313539] px-5 py-4 text-sm font-semibold text-white shadow-xl">{notice}</div>}
  </Context.Provider>;
}


/** Repeated inside native dialogs, whose top layer hides the page banner. */
export function EmployeePreviewNotice() {
  const preview = useEmployeePreview();
  return preview ? <p role="note" className="border-b border-[#d7c4b1] bg-[#f8eee3] px-4 py-2 text-xs font-semibold text-[#493829]">Режим проверки · можно заполнять поля, сохранение отключено</p> : null;
}
