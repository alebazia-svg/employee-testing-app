'use client';
import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useEmployeeActivityLive } from '@/lib/use-employee-activity-live';
import EmployeeDayReport, { activityTime } from './EmployeeDayReport';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export default function EmployeeActivityDialog({ user, onClose }: { user: { id: number; name: string; portalArea: string }; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [date,setDate] = useState(today);
  const {data,error,loading,refreshing,refresh}=useEmployeeActivityLive(user.id,date,today());
  useEffect(()=>{const focused=document.activeElement as HTMLElement|null; dialog.current?.showModal(); const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;focused?.focus({preventScroll:true});};},[]);
  return <dialog ref={dialog} onCancel={e=>{e.preventDefault();onClose();}} aria-labelledby="employee-activity-title" className="m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-24px)] max-w-[940px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/45"><div className="flex max-h-[calc(100dvh-32px)] flex-col">
    <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7"><div><p className="text-sm font-medium text-[#945e3b]">{user.name}</p><h2 id="employee-activity-title" className="mt-1 text-2xl font-bold text-slate-950">День в приложении</h2></div><button onClick={onClose} aria-label="Закрыть активность" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-[#f5e8dc]"><X className="h-5 w-5"/></button></header>
    <div className="min-h-0 overflow-y-auto px-5 py-4 sm:px-7"><div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm"><label className="flex items-center gap-2 font-semibold text-slate-700">День<input type="date" value={date} max={today()} min={new Date(Date.now()-89*86400000).toISOString().slice(0,10)} onChange={e=>{if(e.target.value)setDate(e.target.value);}} className="min-h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm"/></label><button disabled={refreshing} onClick={refresh} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-slate-600 hover:bg-[#fbf0e5] disabled:opacity-40"><RefreshCw className={"h-4 w-4 "+(refreshing?"animate-spin":"")}/>Обновить</button></div>
    {loading&&<p role="status" className="py-10 text-center text-sm text-slate-500">Загружаем историю…</p>}{error&&<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}{data?" Показаны последние полученные данные.":""}<button onClick={refresh} className="ml-3 underline">Повторить</button></div>}{data&&<EmployeeDayReport key={date} data={data}/>}</div>
    <div role="contentinfo" className="shrink-0 border-t px-5 py-3 text-xs text-slate-500 sm:px-7">{data?`Получено в ${activityTime(data.checkedAt)}. `:''}Время — МСК.{date===today()?(error?" Обновление повторится автоматически.":" Обновляется автоматически."):""}</div>
  </div></dialog>;
}
