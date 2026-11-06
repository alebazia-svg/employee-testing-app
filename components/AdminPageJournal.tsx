'use client';
import { useEffect, useRef, useState } from 'react';
import { PortalAccessDevicesView } from '@/components/PortalAccessDevices';
import type { AccessJournalRow } from '@/components/PortalAccessJournal';
import { Search, X } from 'lucide-react';

import { adminPages, adminMoscowDay, type AdminJournalBrowser as Browser, type AdminJournalData, type AdminJournalVisit } from '@/lib/admin-page-policy';
type Visit = AdminJournalVisit & {date:string;time:string;section:string;path:string;previousLabel?:string};
const dateLabel = (d:string) => d.split('-').reverse().join('.');
function VisitDetails({visit,browsers}:{visit:Visit;browsers:Browser[]}) {
  const browser=browsers.find(b=>b.id===visit.browserId)!;
  return <details className='journal-inline-details'><summary aria-label={`Подробнее: ${visit.section}, ${visit.time}`}>Подробнее</summary><dl className='journal-details'>
    <dt>Время · МСК</dt><dd>{dateLabel(visit.date)}, {visit.time}</dd><dt>Код подключения</dt><dd><code>{browser.id}</code></dd><dt>Кабинет</dt><dd>{visit.account}</dd><dt>Тип события</dt><dd>Открытие раздела в видимом окне</dd><dt>Адрес раздела</dt><dd><code>{visit.path}</code></dd><dt>Предыдущий раздел</dt><dd>{visit.previousLabel||'Не зафиксирован'}</dd>
  </dl><p className='journal-note'>Открытие страницы не подтверждает изменение данных или время работы в ней.</p></details>;
}
const shortCode=(value:string)=>`${value.slice(0,10)}…${value.slice(-2)}`;
const dayTitle=(date:string)=>date===adminMoscowDay()?'Сегодня · '+dateLabel(date):date===adminMoscowDay(new Date(Date.now()-86400000))?'Вчера · '+dateLabel(date):dateLabel(date);
export function AdminPageJournal({target,onClose,embedded=false}:{target:{id:string;name:string;browser:string;group?:string|null}|null;onClose?:()=>void;embedded?:boolean}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(embedded)return;const trigger=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{if(trigger?.isConnected)trigger.focus({preventScroll:true});};},[embedded]);
  const [scope,setScope]=useState<'work'|'service'>('work');
  const [browserId,setBrowser]=useState(target?.id||'all'),[query,setQuery]=useState(''),[period,setPeriod]=useState('week'),[date,setDate]=useState(adminMoscowDay());
  const [moreFilters,setMoreFilters]=useState(false),[retry,setRetry]=useState(0);
  const [data,setData]=useState<AdminJournalData|null>(null),[status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const [cursor,setCursor]=useState<string|null>(null),[loadingMore,setLoadingMore]=useState(false),[moreError,setMoreError]=useState(false);
  const requestKey=JSON.stringify({scope,browserId,query,period,date,target:target?.id,retry});
  useEffect(()=>{
    const controller=new AbortController();let done=false;
    setStatus('loading');setMoreError(false);setLoadingMore(false);
    const timer=setTimeout(async()=>{
      try {
        const params=new URLSearchParams({scope,q:query});
        if(period!=='week')params.set('date',period==='today'?adminMoscowDay():date);
        if(browserId!=='all')params.set('browser',browserId);
        else if(target)params.set('browser',target.id);
        if(browserId==='all'&&target||!target&&browserId!=='all')params.set('group','1');
        const response=await fetch('/api/admin/employees/access/pages?'+params,{signal:controller.signal,cache:'no-store'});
        if(!response.ok)throw Error();
        const result:AdminJournalData=await response.json();
        if(done)return;setData(result);setCursor(result.nextCursor);setStatus('ready');
      }catch{if(!done)setStatus('error');}
    },query?250:0);
    const timeout=setTimeout(()=>controller.abort(),15000);
    return()=>{done=true;clearTimeout(timer);clearTimeout(timeout);controller.abort();};
  },[requestKey]);
  const keyRef=useRef(requestKey);keyRef.current=requestKey;
  async function loadMore(){
    if(!cursor||loadingMore)return;
    const key=requestKey;setLoadingMore(true);setMoreError(false);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const params=new URLSearchParams({scope,q:query,cursor});
      if(period!=='week')params.set('date',period==='today'?adminMoscowDay():date);
      if(browserId!=='all')params.set('browser',browserId);else if(target)params.set('browser',target.id);
      if(browserId==='all'&&target||!target&&browserId!=='all')params.set('group','1');
      const response=await fetch('/api/admin/employees/access/pages?'+params,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error();
      const result:AdminJournalData=await response.json();if(keyRef.current!==key)return;
      setData(old=>old?{...result,visits:[...old.visits,...result.visits.filter(v=>!old.visits.some(o=>o.id===v.id))]}:result);setCursor(result.nextCursor);
    }catch{if(keyRef.current===key)setMoreError(true);}finally{clearTimeout(timeout);if(keyRef.current===key)setLoadingMore(false);}
  }
  const browsers=data?.browsers||[];
  const anchor=target?browsers.find(b=>b.id===target.id):null;
  const scoped=browsers.filter(b=>target?b.group===(anchor?.group||target.group||target.id):b.service===(scope==='service'));
  const available=status!=='error'&&!!data?.startedAt;
  const filtered:Visit[]=(data?.visits||[]).map(v=>{const moscow=new Date(+new Date(v.createdAt)+10800000).toISOString();return {...v,date:moscow.slice(0,10),time:moscow.slice(11,19),section:adminPages[v.page][0],path:adminPages[v.page][1],previousLabel:v.previous?adminPages[v.previous][0]:undefined};});
  const reset=()=>{setBrowser(target?.id||'all');setQuery('');setPeriod('week');setDate(adminMoscowDay());};
  const active=query.trim()!==''||browserId!==(target?.id||'all')||period!=='week';
  const groups=[...new Set(filtered.map(v=>v.date))].map(day=>({day,rows:filtered.filter(v=>v.date===day)}));
  const latest=data?.summary.latest?new Date(+new Date(data.summary.latest)+10800000).toISOString():null;
  const content=<div className='access-dialog-content'>
    {!embedded&&<header><div><h2 id='journal-title'>Посещения страниц</h2><p className='journal-context'>{target?<><strong>{target.name}</strong> · {target.browser} · {scoped.length>1?`${scoped.length} подключения`:<code title={target.id}>{shortCode(target.id)}</code>}</>:'Открытые разделы с разных браузеров'}</p></div><button aria-label='Закрыть журнал' onClick={()=>dialog.current?.close()}><X size={20}/></button></header>}
    {embedded&&target&&<p className='journal-context'>{scoped.length>1?`${scoped.length} подключения · `:'Код подключения: '}<code title={target.id}>{shortCode(target.id)}</code></p>}
    <div className='journal-meta'><span className='journal-only-visits'>Только посещения</span><span>{status==='error'?'Сведения о сборе недоступны':!data&&status==='loading'?'Получаем сведения о сборе…':data?.startedAt?'Сбор с '+new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(data.startedAt))+' МСК':'Сбор ещё не начался'}</span></div>
    {available&&<>
      <div className='journal-summary' aria-label='Сводка за выбранный период'>
        <div><span>Последнее открытие</span><strong>{status==='loading'?'…':latest?latest.slice(11,16):'—'}</strong><small>{latest?dateLabel(latest.slice(0,10)):'За период нет записей'}</small></div>
        <div><span>Открытий</span><strong>{status==='loading'?'…':data!.summary.count}</strong><small>За выбранный период</small></div>
        <div><span>Разделов</span><strong>{status==='loading'?'…':data!.summary.sections}</strong><small>За выбранный период</small></div>
      </div>
      {!target&&<div className='journal-scope' role='group' aria-label='Тип браузеров'><button aria-pressed={scope==='work'} onClick={()=>{setScope('work');setBrowser('all');}}>Рабочие браузеры</button><button aria-pressed={scope==='service'} onClick={()=>{setScope('service');setBrowser('all');}}>Служебные · Codex и Claude</button></div>}
      <div className='journal-quick-filters'>
        <label><span className='sr-only'>Период</span><select aria-label='Период' value={period} onChange={e=>setPeriod(e.target.value)}><option value='week'>Последние 7 дней</option><option value='today'>Сегодня</option><option value='date'>Выбрать дату</option></select></label>
        <button className='access-secondary' aria-expanded={moreFilters} aria-controls='journal-more-filters' onClick={()=>setMoreFilters(v=>!v)}><Search size={15}/>{target?(scoped.length>1?'Поиск и коды':'Поиск'):'Браузер и поиск'}{query||browserId!==(target?.id||'all')?<span aria-label='Есть активный фильтр'> ·</span>:null}</button>
        {active&&<button className='journal-reset' onClick={reset}>Сбросить</button>}
      </div>
      {period==='date'&&<label className='journal-date-field'>Дата<input type='date' min={adminMoscowDay(new Date(Date.now()-89*86400000))} max={adminMoscowDay()} value={date} onChange={e=>setDate(e.target.value)}/></label>}
      {moreFilters&&<div id='journal-more-filters' className='journal-filters'>
        {(!target||scoped.length>1)&&<label><span>{target?'Подключение':'Браузер'}</span><select value={browserId} onChange={e=>setBrowser(e.target.value)}><option value='all'>{target?'Все подключения':`Все ${scope==='work'?'рабочие':'служебные'}`}</option>{scoped.filter((b,i)=>target||scoped.findIndex(o=>o.group===b.group)===i).map(b=><option key={b.id} value={b.id}>{target?`Подключение ${b.connection} · ${b.id}`:`${b.name}${scoped.filter(o=>o.group===b.group).length>1?' · '+scoped.filter(o=>o.group===b.group).length+' подключения':' · '+shortCode(b.id)}`}</option>)}</select></label>}
        <label className='journal-search'><span>Найти раздел или код</span><div><Search size={16}/><input placeholder='Например, Закупки' value={query} maxLength={100} onChange={e=>setQuery(e.target.value)}/></div></label>
      </div>}
      {status==='ready'&&query.trim()&&<p className='journal-search-result' role='status'>Найдено: {data!.matched} из {data!.summary.count} открытий за период</p>}
      {status==='ready'&&(filtered.length?target?<div className='journal-chronology' role='region' aria-label='Открытые страницы'>{groups.map(group=><section className='journal-day' key={group.day} aria-label={dayTitle(group.day)}><h3>{dayTitle(group.day)}<span>{group.rows.length}</span></h3>{group.rows.map(v=>{const b=browsers.find(b=>b.id===v.browserId)!;return <article className='journal-visit-line' key={v.id} aria-label={`${v.section}, ${v.time}`}><time dateTime={`${v.date}T${v.time}+03:00`} title={v.time}>{v.time.slice(0,5)}</time><div className='journal-visit-page'><strong>{v.section}</strong>{scoped.length>1&&<small>Подключение {b.connection}</small>}</div><VisitDetails visit={v} browsers={browsers}/></article>;})}</section>)}</div>:<div className='journal-table' role='region' aria-label='Открытые страницы'><div className='journal-head' aria-hidden='true'><span>Время · МСК</span><span>Раздел</span><span>Браузер и кабинет</span><span/></div>{filtered.map(v=>{const b=browsers.find(b=>b.id===v.browserId)!;return <article className='journal-row' key={v.id} aria-label={`${v.section}, ${b.name}, ${v.time}`}><div className='journal-time'><time dateTime={`${v.date}T${v.time}+03:00`}>{v.time.slice(0,5)}</time><span>{dateLabel(v.date)}</span></div><div className='journal-page'><strong>{v.section}</strong></div><div className='journal-browser'><strong>{b.name}</strong><span>{b.browser}{b.connection?` · подключение ${b.connection}`:''} · {v.account}</span></div><VisitDetails visit={v} browsers={browsers}/></article>;})}</div>:<section className='journal-state journal-state-empty' role='status'><h3>{query.trim()?'По запросу ничего не найдено':'Посещений за этот период не зафиксировано'}</h3><p>{query.trim()?'Измените запрос или сбросьте фильтры.':'Выберите другой период. Отсутствие записей не доказывает отсутствие посещений.'}</p>{active&&<button className='access-secondary' onClick={reset}>Сбросить фильтры</button>}</section>)}
    </>}
    {status==='ready'&&!data?.startedAt&&<section className='journal-state journal-state-info' role='status'><h3>Сбор ещё не начался</h3><p>Первые записи появятся после включения журнала. Более ранние переходы восстановить по журналу входов нельзя.</p></section>}
    {status==='error'&&<section className='journal-state journal-state-error' role='alert'><h3>Не удалось загрузить журнал</h3><p>Это ошибка получения данных, а не отсутствие посещений. Повторите попытку.</p><button className='access-secondary' onClick={()=>setRetry(n=>n+1)}>Повторить загрузку</button></section>}
    {status==='loading'&&<section className='journal-state journal-state-loading' role='status' aria-busy='true'><h3>Загружаем журнал…</h3><p>Получаем записи за выбранный период.</p><div className='journal-skeleton' aria-hidden='true'/><div className='journal-skeleton' aria-hidden='true'/><div className='journal-skeleton' aria-hidden='true'/></section>}
    <details className='journal-data-help'><summary>Что подтверждает журнал</summary><p>Запись подтверждает открытие раздела в видимом окне. Фоновые обновления не считаются переходами. Название браузера сохранено администратором и не устанавливает человека за компьютером. Журнал не фиксирует изменение данных или длительность работы на странице. Срок хранения — 90 дней.</p></details>
    {available&&status==='ready'&&cursor&&<button className='access-secondary' disabled={loadingMore} onClick={()=>void loadMore()}>{loadingMore?'Загружаем…':'Показать ещё'}</button>}
    {moreError&&<p role='alert' className='journal-note'>Не удалось загрузить продолжение. Уже загруженные записи сохранены; повторите попытку.</p>}
  </div>;
  return embedded?<section className='journal-preview journal-refined journal-embedded' aria-label='Посещения этого браузера'>{content}</section>:<dialog ref={dialog} className='access-dialog journal-dialog journal-preview journal-refined' aria-labelledby='journal-title' onClose={onClose} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close();}}>{content}</dialog>;
}
