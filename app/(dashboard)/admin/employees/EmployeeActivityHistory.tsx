'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { AuditStep } from '@/lib/employee-audit-timeline';
import { auditStepOrder } from '@/lib/employee-audit-timeline';
import { activityStamp, type HumanActivity } from '@/lib/employee-activity-presentation';
import { elapsed } from '@/lib/employee-process-view';

export function ActivityEvidence({steps,date,notes=[]}:{steps:AuditStep[];date:string;notes?:string[]}){
 const [limit,setLimit]=useState(30);
 const ordered=[...steps].sort(auditStepOrder);
 return <details className="group/evidence mt-3 rounded-lg border border-slate-200 px-3 text-xs leading-5 text-slate-600">
  <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 font-medium [&::-webkit-details-marker]:hidden">Источник и точные записи · {ordered.length}<ChevronDown size={13} className="ml-auto group-open/evidence:rotate-180"/></summary>
  {notes.length>0&&<div className="space-y-1 border-t border-slate-100 py-2">{notes.map((n,i)=><p key={i}>{n}</p>)}</div>}
  <ol className="divide-y divide-slate-100">{ordered.slice(0,limit).map(s=><li key={s.id} className="py-2"><p className="text-slate-800"><time className="mr-2 tabular-nums">{activityStamp(s.at,date,true)}</time>{s.label}{s.durationMs!==undefined?' · '+elapsed(s.durationMs):''}</p>{s.note&&<p>{s.note}</p>}<p>{s.source?.kind==='owner_check'?'Проверка администратора':s.origin==='system'?'Запись портала':'Сообщило приложение'}{s.source?' · '+s.source.label:''}</p>{s.source?.browserCode&&<p className="break-all text-slate-500">Код браузера: {s.source.browserCode}</p>}{s.pushAcceptedAt&&<p>Сервис принял отправку: {activityStamp(s.pushAcceptedAt,date,true)}. Показ баннера ОС и прочтение этим не подтверждаются.</p>}</li>)}</ol>
  {ordered.length>limit&&<button type="button" onClick={()=>setLimit(n=>n+30)} className="min-h-10 font-medium text-[#945e3b]">Ещё записи · {ordered.length-limit}</button>}
 </details>;
}
export function ActivityHistory({entries,date,showTitles=false}:{entries:HumanActivity[];date:string;showTitles?:boolean}){
 const [limit,setLimit]=useState(30);
 return <>
  <ol className="divide-y divide-slate-100">{entries.slice(0,limit).map((entry,i)=>{
   const source=entry.raw.find(s=>s.source)?.source;
   const previous=entries[i-1]?.raw.find(s=>s.source)?.source;
   const error=entry.raw.some(s=>s.tone==='error'||s.tone==='warning');
   return <li key={entry.id} className="flex gap-3 py-2.5"><time className="w-[68px] shrink-0 pt-0.5 text-xs tabular-nums leading-5 text-slate-500">{activityStamp(entry.at,date,true)}</time><div className="min-w-0 flex-1">
    {showTitles&&entries[i-1]?.itemId!==entry.itemId&&<p className="mb-0.5 text-xs font-medium text-[#945e3b]">{entry.title}</p>}
    <p className={'text-sm leading-6 '+(error?'text-amber-900':'text-slate-800')}>{entry.label}</p>
    {source&&(!previous||previous.id!==source.id)&&<p className="mt-0.5 text-xs leading-5 text-slate-500">{source.kind==='owner_check'?'Проверка администратора · ':''}{source.label}</p>}
   </div></li>;
  })}</ol>
  {entries.length>limit&&<button type="button" className="min-h-10 text-sm font-medium text-[#945e3b]" onClick={()=>setLimit(n=>n+30)}>Ещё действия · {entries.length-limit}</button>}
 </>;
}
