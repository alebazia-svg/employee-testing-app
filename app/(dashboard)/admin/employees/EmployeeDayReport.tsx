'use client';
import { useMemo, useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal, List, ArrowLeft, AlertTriangle } from 'lucide-react';
import { employeeScreenLabel } from '@/lib/employee-screen-state';
import type { EmployeeActivityReport } from '@/lib/employee-activity-report';
import { activityClock, activityDateTime, activityStamp, activityStatusLabels, latestActivityText, managerActivity, matchesActivity, timesWord, type ActivityStatus, type ManagerActivity } from '@/lib/employee-activity-presentation';
import { ActivityEvidence, ActivityHistory } from './EmployeeActivityHistory';

export const activityTime=(value:string)=>activityClock(value,true);
const sections={day:'Рабочий день',notifications:'Уведомления',payroll:'Зарплата',schedule:'График',procurement:'Закупки',receipts:'Проверка чеков',cash:'Выдача денег',learning:'Обучение',other:'Справка и настройка'};
const tones:Record<ActivityStatus,string>={result:'text-emerald-800 bg-emerald-50',question:'text-[#875332] bg-[#f8eee3]',difficulty:'text-amber-900 bg-amber-50',observed:'text-slate-600 bg-slate-100',unknown:'text-slate-600 bg-slate-100'};

function ProcessRow({row,date}:{row:ManagerActivity;date:string}){
 const {item}=row,notice=item.message!==undefined;
 const appLabel=row.openings.length?`Открывали ${row.openings.length} ${timesWord(row.openings.length)}`:row.shown.length?'Показано; открытие не записано':'Показ и открытие не записаны';
 const evidenceNotes=[...item.summary,...(item.questionNote?[item.questionNote]:[]),...(row.obligation?.reason?[row.obligation.reason]:[])];
 return <article className="border-b border-slate-200 last:border-0">
  <details className="group/operation">
   <summary className="flex cursor-pointer list-none items-start gap-3 rounded-lg py-3.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#945e3b] sm:gap-4 [&::-webkit-details-marker]:hidden">
    <span className="w-14 shrink-0 pt-0.5 text-slate-500 sm:w-[68px]"><time className="block text-sm leading-5 tabular-nums">{activityStamp(row.time.at,date)}</time><span className="mt-0.5 block break-words text-[10px] leading-4">{row.time.label}</span></span>
    <span className="min-w-0 flex-1">
     <span className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-base font-semibold leading-6 text-slate-900">{item.title}</span>{row.status!=='observed'&&<span className={'rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 '+tones[row.status]}>{activityStatusLabels[row.status]}</span>}</span>
     <span className={'mt-1 block text-sm leading-6 '+(row.status==='difficulty'?'text-amber-900':row.status==='result'?'text-emerald-800':'text-slate-700')}>{row.result}</span>
     {notice&&<span className="mt-1 block text-xs leading-5 text-slate-500">{row.status!=='observed'?appLabel+' · ':''}Push: {row.push.label}{row.push.source?' · '+row.push.source.label:''}</span>}
     {row.obligation?.sourceAt&&row.status!=='result'&&<span className="block text-xs leading-5 text-slate-500">Последняя проверка: {activityStamp(row.obligation.sourceAt,date)}{row.resultCheck==='before_opening'?' · до последнего открытия':row.resultCheck==='after_opening'?' · после последнего открытия':row.resultCheck==='same_time'?' · одновременно с открытием':row.resultCheck==='unknown'?' · время не подтверждено':''}</span>}
     {row.ownerCheck&&<span className="mt-1 block text-xs font-medium text-[#945e3b]">В истории есть проверка администратора</span>}
    </span>
    <ChevronDown aria-hidden size={17} className="mt-1 shrink-0 text-slate-400 transition-transform group-open/operation:rotate-180"/>
   </summary>
   <div className="pb-4 sm:pl-[84px]">
    {(row.nextStep||row.reason)&&<div className={'mb-3 rounded-lg px-3 py-2.5 text-sm leading-6 '+(row.status==='difficulty'?'bg-amber-50 text-amber-950':'bg-stone-50 text-slate-700')}>
     {row.reason&&row.status==='difficulty'&&<p>{row.reason}</p>}
     {row.nextStep&&<p className={row.reason&&row.status==='difficulty'?'mt-1':''}><strong className="font-medium">Что проверить: </strong>{row.nextStep}</p>}
    </div>}
    {notice&&<dl className="mb-3 grid gap-x-4 gap-y-2 text-sm leading-6 sm:grid-cols-[140px_1fr]">
     <dt className="font-medium text-slate-600">В приложении</dt><dd className="text-slate-800">{row.shown.length?'Показ записан '+activityStamp(row.shown[0].at,date,true)+(row.shown.length>1?'; последнее появление '+activityStamp(row.shown.at(-1)!.at,date,true):''):'Показ сообщения не записан'}</dd>
     <dt className="font-medium text-slate-600">Открытия</dt><dd className="text-slate-800">{row.openings.length?`${row.openings.length} ${timesWord(row.openings.length)} · впервые ${activityStamp(row.openings[0].at,date,true)}`+(row.openings.length>1?'; последнее '+activityStamp(row.openings.at(-1)!.at,date,true):''):'Открытие сообщения не записано'}</dd>
     <dt className="font-medium text-slate-600">Доставка push</dt><dd className="text-slate-800">{row.push.explanation}{row.push.source?' Подключение: '+row.push.source.label+'.':''}{row.push.at?' Записано '+activityDateTime(row.push.at)+'.':''}</dd>
     {row.obligation?.sourceAt&&<><dt className="font-medium text-slate-600">Последняя сохранённая проверка</dt><dd className="text-slate-800">{activityDateTime(row.obligation.sourceAt)} · {row.obligation.result}</dd></>}
    </dl>}
    {item.message&&<details className="group/message mb-3 rounded-lg border border-slate-200 px-3"><summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm font-medium text-slate-700 [&::-webkit-details-marker]:hidden">Текст сообщения<ChevronDown size={14} className="ml-auto group-open/message:rotate-180"/></summary><p className="whitespace-pre-wrap pb-3 text-sm leading-6 text-slate-700">{item.message}</p></details>}
    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Как это происходило</h4>
    <ActivityHistory entries={row.history} date={date}/>
    <ActivityEvidence steps={item.steps} date={date} notes={evidenceNotes}/>
   </div>
  </details>
 </article>;
}

export default function EmployeeDayReport({data}:{data:EmployeeActivityReport}){
 const [mode,setMode]=useState<'operations'|'timeline'>('operations'),[connection,setConnection]=useState('all');
 const [filtersOpen,setFiltersOpen]=useState(false),[difficultiesOnly,setDifficultiesOnly]=useState(false),[section,setSection]=useState('all'),[query,setQuery]=useState(''),[limit,setLimit]=useState(20);
 const view=useMemo(()=>managerActivity(data,connection),[data,connection]);
 const rows=view.rows.filter(row=>matchesActivity(row,query,section,difficultiesOnly));
 const difficulties=view.rows.filter(row=>matchesActivity(row,query,section,false)&&row.status==='difficulty').length;
 const q=query.trim().toLocaleLowerCase('ru-RU');
 const timeline=view.chronology.filter(e=>(section==='all'||e.section===section)&&(!difficultiesOnly||e.unresolved)&&`${e.title} ${view.rows.find(r=>r.item.id===e.itemId)?.item.message||''} ${e.label} ${e.raw.map(s=>s.label+' '+(s.note||'')).join(' ')}`.toLocaleLowerCase('ru-RU').includes(q));
 const observed=data.inspection?.connections.find(c=>c.id===(connection==='all'?data.inspection?.selectedId:connection));
 const coverageMissing=!data.startedAt||data.date<new Date(data.startedAt).toLocaleDateString('en-CA',{timeZone:'Europe/Moscow'});
 const activeFilters=Number(connection!=='all')+Number(section!=='all')+Number(difficultiesOnly);
 const reset=()=>{setConnection('all');setSection('all');setDifficultiesOnly(false);setQuery('');setLimit(20);};
 const allScope=connection==='all'?'Все подключения':'Выбранное подключение';
 return <div>
  <section aria-label="Итог дня" className="mb-4 rounded-xl border border-[#e5d9cc] bg-[#faf7f3] px-4 py-3">
   <div className="flex flex-wrap items-center justify-between gap-1"><h3 className="text-sm font-semibold text-slate-900">Итог дня</h3><span className="text-[11px] text-slate-500">{allScope} · все разделы</span></div>
   {view.rows.length?<div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm leading-6">
    {view.counts.difficulty>0&&<span className="text-amber-900">Затруднения <strong>{view.counts.difficulty}</strong></span>}
    {view.counts.question>0&&<span className="text-[#875332]">Открытые вопросы <strong>{view.counts.question}</strong></span>}
    {view.counts.result>0&&<span className="text-emerald-800">Есть результат <strong>{view.counts.result}</strong></span>}
    {view.counts.unknown>0&&<span className="text-slate-600">Нужны сведения <strong>{view.counts.unknown}</strong></span>}
    {!view.counts.result&&!view.counts.question&&!view.counts.difficulty&&!view.counts.unknown&&<span className="text-slate-700">Записаны просмотры и действия; сохранённых результатов нет</span>}
   </div>:<p className="mt-1 text-sm leading-6 text-slate-700">Пока нет записанных действий</p>}
   {view.latest&&<p className="mt-1 text-sm leading-6 text-slate-700">Последнее в приложении: {latestActivityText(view.latest)} · {activityStamp(view.latest.at,data.date)}</p>}
   <details className="group/source mt-1 text-xs leading-5 text-slate-600"><summary className="flex min-h-8 w-fit cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">Подключение и сведения о дне<ChevronDown size={13} className="group-open/source:rotate-180"/></summary>
    <p>Действия в учётной записи. Имя сотрудника само по себе не устанавливает, кто пользовался браузером.</p>
    {connection!=='all'&&<p>В этой выборке — действия выбранного подключения. Сохранённый результат операции относится к учётной записи; автор в другой системе может быть неизвестен.</p>}
    {observed?<p className="mt-1">Последние сведения устройства: {observed.label} · {observed.runtime?.screen?employeeScreenLabel(observed.runtime.screen):'экран не передан'} · {observed.runtimeAt?activityDateTime(observed.runtimeAt):'время не передано'}. {observed.live?'Есть свежий сигнал приложения.':'Текущий экран не подтверждён; это последнее известное состояние.'}</p>:<p className="mt-1">Нет подтверждённых сведений о текущем экране сотрудника.</p>}
    <p className="mt-1">{data.shift.startedAt?'Начало смены '+activityStamp(data.shift.startedAt,data.date):'Отметки начала смены нет'}{data.shift.endedAt?' · Завершение '+activityStamp(data.shift.endedAt,data.date):''}</p>
   </details>
  </section>
  {(data.truncated||coverageMissing)&&<p role="status" className="mb-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900"><AlertTriangle size={17} className="mt-1 shrink-0"/><span>История за день неполная. Показаны полученные записи; отсутствие события не доказывает бездействие.</span></p>}
  <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
   <label className="flex min-h-10 min-w-40 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3"><Search size={16} className="shrink-0 text-slate-500"/><input aria-label="Найти действие" placeholder="Найти действие или сообщение" className="w-full min-w-0 !border-0 !bg-transparent !shadow-none py-2 text-sm outline-none focus:!ring-0" value={query} onChange={e=>{setQuery(e.target.value);setLimit(20);}}/></label>
   <button type="button" aria-expanded={filtersOpen} aria-controls="employee-activity-filters" onClick={()=>setFiltersOpen(v=>!v)} className={'flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm '+(activeFilters?'border-[#ba835b] bg-[#f5e8dc] text-[#754325]':'border-slate-200 text-slate-700')}><SlidersHorizontal size={16}/>Фильтры{activeFilters?' · '+activeFilters:''}</button>
   <button type="button" onClick={()=>{setMode(mode==='operations'?'timeline':'operations');setLimit(20);}} className="flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[#945e3b]">{mode==='operations'?<List size={16}/>:<ArrowLeft size={16}/>}<span>{mode==='operations'?'Вся хронология':'К итогу дня'}</span></button>
  </div>
  <div id="employee-activity-filters" hidden={!filtersOpen} className="border-b border-slate-200 py-3"><div className="flex flex-wrap items-center gap-2">
   {Boolean(data.connections?.length)&&<select aria-label="Браузер в истории" value={connection} onChange={e=>{setConnection(e.target.value);setLimit(20);}} className="min-h-10 min-w-0 max-w-full flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">Все подключения</option>{data.connections!.map(c=><option key={c.id} value={c.id}>{c.label}{c.browserCode?' · '+c.browserCode.slice(0,8):''}{c.kind==='owner_check'?' · проверка администратора':''}</option>)}</select>}
   <select aria-label="Раздел приложения" value={section} onChange={e=>{setSection(e.target.value);setLimit(20);}} className="min-h-10 min-w-0 max-w-full flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">Все разделы</option>{Object.entries(sections).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
   <button type="button" aria-pressed={difficultiesOnly} aria-label={`Только затруднения: ${difficulties}`} onClick={()=>{setDifficultiesOnly(v=>!v);setLimit(20);}} className={'flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium '+(difficultiesOnly?'border-[#ba835b] bg-[#f5e8dc] text-[#754325]':'border-slate-200 text-slate-700')}>Только затруднения <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs tabular-nums">{difficulties}</span></button>
  </div></div>
  {(activeFilters>0||q)&&<div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs leading-5 text-slate-600"><span>{[connection!=='all'?data.connections?.find(c=>c.id===connection)?.label:'',section!=='all'?sections[section as keyof typeof sections]:'',difficultiesOnly?'Только затруднения':'',q?'Поиск: '+query:''].filter(Boolean).join(' · ')}</span><button type="button" onClick={reset} className="min-h-8 text-[#945e3b] underline underline-offset-2">Сбросить</button></div>}
  {mode==='operations'&&rows.slice(0,limit).map(row=><ProcessRow key={row.item.id} row={row} date={data.date}/>)}
  {mode==='operations'&&!rows.length&&<p role="status" className="py-8 text-center text-sm leading-6 text-slate-600">{!view.rows.length?'Действия за этот день не записаны. Это не означает, что сотрудник не работал.':difficultiesOnly?'По выбранным условиям нет записанных затруднений.':'По выбранным условиям действий нет.'}</p>}
  {mode==='operations'&&rows.length>limit&&<button type="button" className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm text-[#945e3b]" onClick={()=>setLimit(n=>n+20)}>Показать ещё · {rows.length-limit}</button>}
  {mode==='timeline'&&<><h3 className="pt-4 text-sm font-semibold text-slate-900">Хронология дня</h3><ActivityHistory entries={timeline} date={data.date} showTitles/>{!timeline.length&&<p className="py-8 text-center text-sm text-slate-600">По выбранным условиям событий нет.</p>}<ActivityEvidence steps={timeline.flatMap(h=>h.raw)} date={data.date}/></>}
  <details className="mt-3 border-t border-slate-200 pt-2 text-sm leading-6 text-slate-600"><summary className="min-h-11 cursor-pointer py-2 font-medium text-slate-700">Как читать эти данные</summary><p>Это события в учётной записи, а не оценка сотрудника. Открытие сообщения не доказывает прочтение или выполнение. Сохранённый результат подтверждает портал или другой источник; автор действий в 1С может быть неизвестен.</p><p className="mt-2">Цифры итога относятся ко дню и выбранному подключению, до поиска и фильтра раздела. Каждая история имеет один основной статус. «Только затруднения» выбирает записанные проблемы без последующего подтверждения результата; открытые поручения показаны отдельно. Это не доказательство текущего сбоя или просрочки.</p><p className="mt-2">Время — по записи портала, МСК. Под временем в карточке написано его значение. Точные секунды и повторные попытки — в раскрытии. Изменения графика считаются по разным датам, повторные правки сохранены; это не проверка заполненности всего месяца.</p><p className="mt-2">Одно открытие может дать несколько технических записей. В понятной хронологии они объединены только при совпадении подключения и события; исходные записи сохранены. Длительность запроса включает время в фоне и не измеряет бездействие.</p><p className="mt-2">Push принят сервисом, push получен устройством, запрос показа принят браузером, нажатие push и открытие сообщения — разные сведения. Запрос показа не подтверждает баннер ОС или прочтение. Новые подтверждения устройства появятся после обновления приложения; старые неизвестные сведения не восстановить.</p><p className="mt-2">Сбор не блокирует работу. Сеть, старая версия, закрытый вход или лимит могут помешать записи; отсутствие события остаётся неизвестностью. Служебные подключения исключены. История — {data.retentionDays} дней.</p></details>
 </div>;
}
