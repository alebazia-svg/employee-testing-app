'use client';
import { useEffect, useRef, useState } from 'react';
import { PortalAccessDevicesView } from '@/components/PortalAccessDevices';
import type { AccessJournalRow } from '@/components/PortalAccessJournal';
import { Search, X } from 'lucide-react';
import './admin-page-journal-preview.css';

type Browser = { id: string; name: string; service: boolean; code: string; browser: string; connection?: number };
const browsers: Browser[] = [
  { id:'bela',name:'Mac Бэлы',service:false,code:'demo-bela-edge-01',browser:'Edge' },
  { id:'iphone',name:'iPhone Бэлы',service:false,code:'demo-bela-safari-06',browser:'Safari' },
  { id:'aslan',name:'Mac Аслана',service:false,code:'demo-aslan-chrome-02',browser:'Chrome' },
  { id:'codex',name:'Служебный браузер Codex',service:true,code:'demo-codex-chrome-03',browser:'Chrome',connection:1 },
  { id:'codex2',name:'Служебный браузер Codex',service:true,code:'demo-codex-chrome-05',browser:'Chrome',connection:2 },
  { id:'claude',name:'Служебный браузер Claude',service:true,code:'demo-claude-chrome-04',browser:'Chrome' },
];
type Visit = { id: number; browserId: string; date: string; time: string; section: string; path: string; previous?: string; seconds?: number };
// Illustrative fixtures only. These are NOT historical actions of the named people.
const visits: Visit[] = [
  {id:1,browserId:'bela',date:'2026-11-07',time:'14:32:18',section:'Устройства и входы',path:'/admin/employees/access',previous:'Сотрудники',seconds:7},
  {id:2,browserId:'aslan',date:'2026-11-07',time:'14:28:05',section:'Закупки · Календарь',path:'/admin/procurement',previous:'Главная',seconds:16},
  {id:3,browserId:'aslan',date:'2026-11-07',time:'14:25:40',section:'Контроль дня',path:'/admin/workday',previous:'Главная'},
  {id:4,browserId:'bela',date:'2026-11-07',time:'14:20:12',section:'Сотрудники',path:'/admin/employees',previous:'Главная'},
  {id:5,browserId:'aslan',date:'2026-11-06',time:'17:12:30',section:'Главная',path:'/admin'},
  {id:6,browserId:'bela',date:'2026-11-06',time:'16:42:10',section:'Налоги',path:'/admin/taxes',previous:'Главная'},
  {id:7,browserId:'codex',date:'2026-11-07',time:'14:31:04',section:'Устройства и входы',path:'/admin/employees/access',previous:'Сотрудники'},
  {id:8,browserId:'claude',date:'2026-11-07',time:'14:26:11',section:'Контроль дня',path:'/admin/workday',previous:'Главная'},
  {id:9,browserId:'codex2',date:'2026-11-07',time:'14:18:09',section:'Закупки · Календарь',path:'/admin/procurement',previous:'Главная'},
];
const dateLabel = (d:string) => d.split('-').reverse().join('.');
function VisitDetails({visit}:{visit:Visit}) {
  const browser=browsers.find(b=>b.id===visit.browserId)!;
  return <details className='journal-inline-details'><summary aria-label={`Подробнее: ${visit.section}, ${visit.time}`}>Подробнее</summary><dl className='journal-details'>
    <dt>Время · МСК</dt><dd>{dateLabel(visit.date)}, {visit.time}</dd><dt>Код подключения</dt><dd><code>{browser.code}</code></dd><dt>Кабинет</dt><dd>Администратор · admin</dd><dt>Тип события</dt><dd>Открытие раздела в видимом окне</dd><dt>Адрес раздела</dt><dd><code>{visit.path}</code></dd><dt>Предыдущий раздел</dt><dd>{visit.previous||'Не зафиксирован'}</dd>
  </dl><p className='journal-note'>Открытие страницы не подтверждает изменение данных или время работы в ней.</p></details>;
}
type DemoState='ready'|'empty'|'not-started'|'error'|'loading';
const shortCode=(value:string)=>`${value.slice(0,10)}…${value.slice(-2)}`;
const dayTitle=(date:string)=>date==='2026-11-07'?'Сегодня · 7 ноября':date==='2026-11-06'?'Вчера · 6 ноября':dateLabel(date);
function Journal({target,onClose,embedded=false}:{target:Browser|null;onClose?:()=>void;embedded?:boolean}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(embedded)return;const trigger=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{if(trigger?.isConnected)trigger.focus({preventScroll:true});};},[embedded]);
  const [scope,setScope]=useState<'work'|'service'>(target?.service?'service':'work');
  const [browserId,setBrowser]=useState(embedded&&target?.connection?target.id:'all'),[query,setQuery]=useState(''),[period,setPeriod]=useState('week'),[date,setDate]=useState('2026-11-07');
  const [moreFilters,setMoreFilters]=useState(false),[demoState,setDemoState]=useState<DemoState>('ready');
  const scoped=browsers.filter(b=>target?b.name===target.name:b.service===(scope==='service'));
  const available=demoState==='ready'||demoState==='empty';
  const rangeRows=demoState==='empty'?[]:visits.filter(v=>scoped.some(b=>b.id===v.browserId)&&(browserId==='all'||v.browserId===browserId||(!target&&browserId==='codex'&&v.browserId==='codex2'))&&(period==='week'?v.date>='2026-11-01'&&v.date<='2026-11-07':v.date===(period==='date'?date:'2026-11-07'))).sort((a,b)=>`${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const filtered=rangeRows.filter(v=>`${v.section} ${v.path} ${browsers.find(b=>b.id===v.browserId)!.name} ${browsers.find(b=>b.id===v.browserId)!.code}`.toLowerCase().includes(query.trim().toLowerCase()));
  const reset=()=>{setBrowser('all');setQuery('');setPeriod('week');setDate('2026-11-07');};
  const active=query.trim()!==''||browserId!=='all'||period!=='week';
  const groups=[...new Set(filtered.map(v=>v.date))].map(day=>({day,rows:filtered.filter(v=>v.date===day)}));
  const latest=rangeRows[0];
  const detailsControls=<details className='journal-preview-controls'><summary>Проверить состояния примера</summary><label>Состояние журнала<select value={demoState} onChange={e=>setDemoState(e.target.value as DemoState)}><option value='ready'>Примеры посещений</option><option value='empty'>Посещений не зафиксировано</option><option value='not-started'>Сбор ещё не начался</option><option value='loading'>Загрузка</option><option value='error'>Ошибка загрузки</option></select></label><p>Переключатель только для предварительного просмотра. Рабочие данные не меняются.</p></details>;
  const content=<div className='access-dialog-content'>
    {!embedded&&<header><div><h2 id='journal-title'>Посещения страниц</h2><p className='journal-context'>{target?<><strong>{target.name}</strong> · {target.browser} · {scoped.length>1?`${scoped.length} подключения`:<code title={target.code}>{shortCode(target.code)}</code>}</>:'Открытые разделы с разных браузеров'}</p></div><button aria-label='Закрыть журнал' onClick={()=>dialog.current?.close()}><X size={20}/></button></header>}
    {embedded&&target&&<p className='journal-context'>{scoped.length>1?`${scoped.length} подключения · `:'Код подключения: '}<code title={target.code}>{shortCode(target.code)}</code></p>}
    <p className='journal-demo-compact'><strong>Демонстрация.</strong> Все события вымышлены, включая примеры для «Mac Аслана».</p>
    <div className='journal-meta'><span className='journal-only-visits'>Только посещения</span><span>{demoState==='not-started'?'Сбор не начался':'Начало сбора в примере: 06.11, 09:00 МСК'}</span></div>
    {available&&<>
      <div className='journal-summary' aria-label='Сводка за выбранный период'>
        <div><span>Последнее открытие</span><strong>{latest?latest.time.slice(0,5):'—'}</strong><small>{latest?dateLabel(latest.date):'За период нет записей'}</small></div>
        <div><span>Открытий</span><strong>{rangeRows.length}</strong><small>За выбранный период</small></div>
        <div><span>Разделов</span><strong>{new Set(rangeRows.map(v=>v.section)).size}</strong><small>За выбранный период</small></div>
      </div>
      {!target&&<div className='journal-scope' role='group' aria-label='Тип браузеров'><button aria-pressed={scope==='work'} onClick={()=>{setScope('work');setBrowser('all');}}>Рабочие браузеры</button><button aria-pressed={scope==='service'} onClick={()=>{setScope('service');setBrowser('all');}}>Служебные · Codex и Claude</button></div>}
      <div className='journal-quick-filters'>
        <label><span className='sr-only'>Период</span><select aria-label='Период' value={period} onChange={e=>setPeriod(e.target.value)}><option value='week'>Последние 7 дней</option><option value='today'>Сегодня · 7 ноября</option><option value='date'>Выбрать дату</option></select></label>
        <button className='access-secondary' aria-expanded={moreFilters} aria-controls='journal-more-filters' onClick={()=>setMoreFilters(v=>!v)}><Search size={15}/>{target?(scoped.length>1?'Поиск и коды':'Поиск'):'Браузер и поиск'}{query||browserId!=='all'?<span aria-label='Есть активный фильтр'> ·</span>:null}</button>
        {active&&<button className='journal-reset' onClick={reset}>Сбросить</button>}
      </div>
      {period==='date'&&<label className='journal-date-field'>Дата<input type='date' value={date} onChange={e=>setDate(e.target.value)}/></label>}
      {moreFilters&&<div id='journal-more-filters' className='journal-filters'>
        {(!target||scoped.length>1)&&<label><span>{target?'Подключение':'Браузер'}</span><select value={browserId} onChange={e=>setBrowser(e.target.value)}><option value='all'>{target?'Все подключения':`Все ${scope==='work'?'рабочие':'служебные'}`}</option>{scoped.filter(b=>target||b.id!=='codex2').map(b=><option key={b.id} value={b.id}>{target?`Подключение ${b.connection} · ${b.code}`:b.name}</option>)}</select></label>}
        <label className='journal-search'><span>Найти раздел или код</span><div><Search size={16}/><input placeholder='Например, Закупки' value={query} maxLength={100} onChange={e=>setQuery(e.target.value)}/></div></label>
      </div>}
      {query.trim()&&<p className='journal-search-result' role='status'>Найдено: {filtered.length} из {rangeRows.length} открытий за период</p>}
      {filtered.length?target?<div className='journal-chronology' role='region' aria-label='Открытые страницы'>{groups.map(group=><section className='journal-day' key={group.day} aria-label={dayTitle(group.day)}><h3>{dayTitle(group.day)}<span>{group.rows.length}</span></h3>{group.rows.map(v=>{const b=browsers.find(b=>b.id===v.browserId)!;return <article className='journal-visit-line' key={v.id} aria-label={`${v.section}, ${v.time}`}><time dateTime={`${v.date}T${v.time}+03:00`} title={v.time}>{v.time.slice(0,5)}</time><div className='journal-visit-page'><strong>{v.section}</strong>{scoped.length>1&&<small>Подключение {b.connection}</small>}</div><VisitDetails visit={v}/></article>;})}</section>)}</div>:<div className='journal-table' role='region' aria-label='Открытые страницы'><div className='journal-head' aria-hidden='true'><span>Время · МСК</span><span>Раздел</span><span>Браузер и кабинет</span><span/></div>{filtered.map(v=>{const b=browsers.find(b=>b.id===v.browserId)!;return <article className='journal-row' key={v.id} aria-label={`${v.section}, ${b.name}, ${v.time}`}><div className='journal-time'><time dateTime={`${v.date}T${v.time}+03:00`}>{v.time.slice(0,5)}</time><span>{dateLabel(v.date)}</span></div><div className='journal-page'><strong>{v.section}</strong></div><div className='journal-browser'><strong>{b.name}</strong><span>{b.browser}{b.connection?` · подключение ${b.connection}`:''} · Администратор</span></div><VisitDetails visit={v}/></article>;})}</div>:<section className='journal-state journal-state-empty' role='status'><h3>{query.trim()?'По запросу ничего не найдено':'Посещений за этот период не зафиксировано'}</h3><p>{query.trim()?'Измените запрос или сбросьте фильтры.':'Сбор в примере работает с 6 ноября. Выберите другой период; отсутствие записей не доказывает отсутствие посещений.'}</p>{active&&<button className='access-secondary' onClick={reset}>Сбросить фильтры</button>}</section>}
    </>}
    {demoState==='not-started'&&<section className='journal-state journal-state-info' role='status'><h3>Сбор ещё не начался</h3><p>Первые записи появятся после включения журнала. Более ранние переходы восстановить по журналу входов нельзя.</p></section>}
    {demoState==='error'&&<section className='journal-state journal-state-error' role='alert'><h3>Не удалось загрузить журнал</h3><p>Это ошибка получения данных, а не отсутствие посещений. Повторите попытку.</p><button className='access-secondary' onClick={()=>setDemoState('ready')}>Повторить загрузку</button></section>}
    {demoState==='loading'&&<section className='journal-state journal-state-loading' role='status' aria-busy='true'><h3>Загружаем журнал…</h3><p>Получаем записи за выбранный период.</p><div className='journal-skeleton' aria-hidden='true'/><div className='journal-skeleton' aria-hidden='true'/><div className='journal-skeleton' aria-hidden='true'/></section>}
    <details className='journal-data-help'><summary>Что подтверждает журнал</summary><p>Запись подтверждает открытие раздела в видимом окне. Фоновые обновления не считаются переходами. Название браузера сохранено администратором и не устанавливает человека за компьютером. Журнал не фиксирует изменение данных или длительность работы на странице.</p></details>
    {detailsControls}
  </div>;
  return embedded?<section className='journal-preview journal-refined journal-embedded' aria-label='Посещения этого браузера'>{content}</section>:<dialog ref={dialog} className='access-dialog journal-dialog journal-preview journal-refined' aria-labelledby='journal-title' onClose={onClose} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close();}}>{content}</dialog>;
}
const fixtureRows: AccessJournalRow[]=browsers.map((b,i)=>({id:b.id,name:'Администратор',login:'admin',role:'ADMIN',device:b.id==='iphone'?'iPhone':'Mac',browser:b.browser,browserInstanceId:b.code,connectionLabel:b.name,deviceGroupId:b.id.startsWith('codex')?'demo-codex-group':null,ownerBrowser:true,ownerInspection:false,canMarkOwner:b.id==='bela',isCurrentBrowser:b.id==='bela',firstSeenAt:`2026-10-${20+i}T09:00:00+03:00`,loginAt:'2026-11-07T10:00:00+03:00',lastSeenAt:'2026-11-07T14:40:00+03:00',loggedOutAt:null,expiresAt:'2026-12-01T00:00:00+03:00',pushLabel:b.id==='bela'?'Уведомления подключены':'Уведомления не подключены',pushCheckedAt:'2026-11-07T14:40:00+03:00',displayMode:'browser'}));
export default function AdminPageJournalPreview(){
  const [journal,setJournal]=useState<{target:Browser|null}|null>(null);
  return <><div className='journal-preview-notice journal-demo-overview mx-auto max-w-6xl'><strong>Предварительный просмотр.</strong><p>Все данные — примеры; реальный сбор не включён.</p></div><PortalAccessDevicesView compactOverview rows={fixtureRows} query='' history={false} service page={1} hasMore={false} unavailable={false} nowIso='2026-11-07T14:45:00+03:00'
    toolbarAction={<button className='access-secondary journal-overview-action' onClick={()=>setJournal({target:null})}>Посещения страниц</button>}
    renderDetailPages={row=><Journal key={row.id} embedded target={browsers.find(b=>b.code===row.browserInstanceId)!}/>}/>
    {journal&&<Journal target={journal.target} onClose={()=>setJournal(null)}/>}
  </>;
}
