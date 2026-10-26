'use client';
import { useMemo, useState } from 'react';
import { ChevronDown, AlertTriangle, Search } from 'lucide-react';
import type { EmployeeActivityReport } from '@/lib/employee-activity-report';
import { buildProcessView, filterProcessView, elapsed, type ProcessItem } from '@/lib/employee-process-view';

export const activityTime = (value:string) => new Date(value).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit',second:'2-digit'});
const time=(value:string)=>activityTime(value).slice(0,5);
const dated=(value:string)=>new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const sections={day:'Рабочий день',notifications:'Уведомления',payroll:'Зарплата',schedule:'График',other:'Другое'};

function ProcessRow({item,date}:{item:ProcessItem;date:string}) {
 const [limit,setLimit]=useState(30);
 const opened=item.steps.find(s=>s.opened==='notification');
 const shown=item.steps.find(s=>s.target==='notification'&&s.stage==='shown');
 const stamp=(at:string)=>new Date(Date.parse(at)+10800000).toISOString().slice(0,10)===date?time(at):dated(at);
 return <article className="border-b border-slate-200 py-3 last:border-0">
   <div className="flex gap-3 sm:gap-5"><time className="w-11 shrink-0 pt-0.5 text-sm tabular-nums text-slate-600">{stamp(item.at)}</time><div className="min-w-0 flex-1">
     <div className="flex items-start justify-between gap-2"><h3 className="text-base font-semibold leading-6 text-slate-900">{item.title}</h3>{item.unresolved&&<AlertTriangle aria-label="Есть событие для проверки" size={18} className="mt-1 shrink-0 text-amber-700"/>}</div>
     <p className={'mt-1 text-sm leading-6 '+(item.unresolved?'text-amber-900':item.confirmed?'text-emerald-800':'text-slate-700')}>{item.attentionReason||item.outcome}{!item.attentionReason&&item.outcomeAt?' · '+stamp(item.outcomeAt):''}</p>
     {item.attentionReason&&item.confirmed&&<p className="mt-1 text-sm leading-6 text-slate-700">{item.outcome}{item.outcomeAt?' · '+stamp(item.outcomeAt):''}</p>}
     {item.message!==undefined&&<p className="mt-1 text-sm leading-6 text-slate-600">{shown?'Показано в приложении '+stamp(shown.at):'Показ не записан'} · {opened?'Открыто '+stamp(opened.at):'Открытие не записано'}</p>}
     {item.summary.length>0&&<p className="mt-1 text-sm leading-6 text-slate-600">{item.summary.join(' · ')}</p>}
     <details className="group mt-1"><summary className="flex min-h-10 w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-[#945e3b]">Ход операции<ChevronDown size={15} className="group-open:rotate-180"/></summary>
       {item.message&&<p className="mb-3 rounded-lg bg-stone-50 p-3 text-sm leading-6 text-slate-700">{item.message}</p>}
       <ol className="divide-y divide-slate-100">{item.steps.slice(0,limit).map(s=><li key={s.id} className="flex gap-3 py-2.5"><time title={activityTime(s.at)} className="w-11 shrink-0 text-sm tabular-nums text-slate-500">{stamp(s.at)}</time><div className="min-w-0"><p className={'text-sm leading-6 '+(s.tone==='error'?'font-medium text-amber-900':'text-slate-800')}>{s.label}{s.durationMs!==undefined?' · '+elapsed(s.durationMs):''}</p>{s.note&&<p className="mt-0.5 text-sm leading-5 text-slate-600">{s.note}</p>}<p className="mt-1 text-xs text-slate-500">{s.origin==='system'?'Подтверждение системы':'Событие из приложения'}</p></div></li>)}</ol>
       {item.steps.length>limit&&<button className="min-h-10 text-sm font-medium text-[#945e3b]" onClick={()=>setLimit(n=>n+30)}>Ещё события · {item.steps.length-limit}</button>}
     </details>
   </div></div>
 </article>;
}

export default function EmployeeDayReport({data}:{data:EmployeeActivityReport}) {
 const items=useMemo(()=>buildProcessView(data),[data]);
 const [attentionOnly,setAttentionOnly]=useState(false),[section,setSection]=useState('all'),[query,setQuery]=useState(''),[limit,setLimit]=useState(20);
 const {items:filtered,attentionCount}=filterProcessView(items,{query,section,attentionOnly});
 const coverageMissing=!data.startedAt||data.date<new Date(data.startedAt).toLocaleDateString('en-CA',{timeZone:'Europe/Moscow'});
 return <div>
   <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600"><span>{data.shift.startedAt?'Начало смены '+time(data.shift.startedAt):'Отметки начала смены нет'}</span>{data.shift.endedAt&&<span>Завершение {time(data.shift.endedAt)}</span>}</div>
   {(data.truncated||coverageMissing)&&<p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">Журнал за день неполный. Ниже только записанные события; отсутствие события не означает бездействие сотрудника.</p>}
   <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3"><label className="flex min-h-10 min-w-40 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3"><Search size={16} className="shrink-0 text-slate-500"/><input aria-label="Найти действие" placeholder="Найти действие" className="w-full min-w-0 bg-transparent py-2 text-sm outline-none" value={query} onChange={e=>{setQuery(e.target.value);setLimit(20);}}/></label><select aria-label="Раздел приложения" value={section} onChange={e=>{setSection(e.target.value);setLimit(20);}} className="min-h-10 max-w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">Все разделы</option>{Object.entries(sections).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><button type="button" aria-pressed={attentionOnly} aria-label={`Требует проверки: ${attentionCount}`} onClick={()=>{setAttentionOnly(value=>!value);setLimit(20);}} className={'flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#945e3b] '+(attentionOnly?'border-[#ba835b] bg-[#f5e8dc] text-[#754325]':'border-slate-200 bg-white text-slate-700')}><span>Требует проверки</span><span className={'inline-flex min-w-6 items-center justify-center rounded-md px-1.5 py-0.5 text-xs tabular-nums '+(attentionCount?'bg-[#f4d8b4] text-[#754325]':'bg-slate-100 text-slate-600')}>{attentionCount}</span></button></div>
   {filtered.slice(0,limit).map(item=><ProcessRow key={item.id} item={item} date={data.date}/>)}
   {!filtered.length&&<p role="status" className="py-8 text-center text-sm leading-6 text-slate-600">{!items.length?'Действия за этот день не записаны. Это не означает, что сотрудник не работал.':attentionOnly?query||section!=='all'?'По выбранным условиям нет записей для проверки.':'В записанном журнале нет нерешённых ошибок.':'По этому условию событий нет.'}</p>}
   {filtered.length>limit&&<button className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm text-[#945e3b]" onClick={()=>setLimit(n=>n+20)}>Показать ещё · {filtered.length-limit}</button>}
   <details className="mt-3 border-t border-slate-200 pt-2 text-sm leading-6 text-slate-600"><summary className="min-h-11 cursor-pointer py-2 font-medium text-slate-700">Точность данных</summary><p>«Требует проверки» показывает записанные затруднения без последующего подтверждения результата. Счётчик учитывает выбранный раздел и поиск. Это не доказательство, что сбой продолжается сейчас. Устранённые ошибки остаются в общем списке и подробностях.</p><p className="mt-2">Открытие сообщения не доказывает прочтение. Подтверждение результата системой не всегда устанавливает автора и точное время действия в 1С. Интервал между открытием и результатом — не оценка скорости сотрудника.</p><p className="mt-2">Время ответа — длительность запроса по данным приложения, включая время в фоне, а не время бездействия. Просмотры зарплаты и графика сгруппированы по периоду. Частые открытия «Рабочего дня» без действий не показаны.</p><p className="mt-2">Запись событий не блокирует работу. При отсутствии сети, старой версии приложения или достижении лимита часть событий может отсутствовать. Новые подробности появятся после обновления приложения; прошлые незаписанные действия восстановить нельзя. Служебные подключения исключены. История — {data.retentionDays} дней.</p></details>
 </div>;
}
