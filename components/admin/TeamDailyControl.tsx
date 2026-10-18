'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { openWorkdayCard } from '@/lib/workday-card-navigation';
import { ArrowRight, ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import { TeamSourceRefresh } from './TeamSourceRefresh';
import { teamControlSummary, controlCountLabel, controlCompositionLabel, type DepartmentControlAction, type OwnerQueueAction } from '@/lib/team-control-summary';
export type TeamDayRow = {
 id:number;detailAvailable:boolean;sourceUnavailable:boolean;name:string;department:string;source:string;plan:string;planState:string;shift:string;start:string;end:string;state:string;active:boolean;late:number;missing:boolean;review:string;next:string;issueCount:number;needsReview:boolean;alertTargets:Record<string,string>;alerts:string[];timing:string[];issues:Array<{id:number;state?:string;title:string;originDate?:string;meta:string;lifecycle:string;href:string}>;
};
export function TeamDailyControl({rows,controls,planControls=[],departmentActions=[],ownerActions=[],date,readAt,sourceWarning,initialTab='overview'}:{ownerActions?:OwnerQueueAction[];departmentActions?:DepartmentControlAction[];rows:TeamDayRow[];controls:ReactNode[];planControls?:ReactNode[];date:string;readAt:string;sourceWarning:string;initialTab?:string}) {
 const [tab,setTab]=useState(initialTab);const [filter,setFilter]=useState('all');
 useEffect(()=>{setTab(initialTab);},[initialTab]);
 const summaries=rows.map(row=>teamControlSummary(row,date));
 const ownCount=ownerActions.length+departmentActions.filter(action=>action.kind!=='employee').length+summaries.reduce((sum,summary)=>sum+summary.breakdown.decision+summary.breakdown.check,0);
 const decisionCount=ownerActions.filter(action=>action.kind==='decision').length+departmentActions.filter(action=>action.kind==='decision').length+summaries.reduce((sum,summary)=>sum+summary.breakdown.decision,0);
 const filters=[['active','Работает в приложении'],['started','Есть начало'],['late','Опоздания'],['off','Выходной / отпуск'],['unknown','Нет записи графика'],['missing','Не отметились по плану']];
 const matches=(r:TeamDayRow)=>filter==='all'||filter==='attention'&&(teamControlSummary(r,date,ownerActions).items.length>0||r.timing.length>0)||filter==='active'&&r.active||filter==='started'&&r.start!=='—'||filter==='late'&&r.late>0||filter==='off'&&(r.planState==='off'||r.planState==='vacation')||filter==='unknown'&&r.planState==='unknown'||filter==='missing'&&r.missing;
 const hasAttention=ownerActions.length>0||departmentActions.length>0||summaries.some(summary=>summary.items.length>0||summary.timing.length>0);
 return <section className="team-control" id="employees-control"><TeamSourceRefresh/>
  <div className="admin-section-tabs" role="tablist" aria-label="Контроль дня">{[['overview','Обзор дня'],['attention','Нужно действие'],['audit','События и сверка']].map(([id,label])=><button key={id} type="button" role="tab" aria-selected={tab===id} className={`admin-section-tab ${tab===id?'is-active':''}`} onClick={()=>setTab(id)}>{label}{id==='attention'&&hasAttention?<span className={`admin-section-tab-count ${decisionCount?'needs-decision':''}`} title={ownCount?`Для вас: ${ownCount} нерешённых вопросов`:'Есть замечания'} aria-label={ownCount?`Требуют вашего участия: ${ownCount}`:'Есть замечания'}>{ownCount||'!'}</span>:null}</button>)}</div>
  <div className="team-context-line"><Link href={`/admin/attendance?date=${date}`}>График команды <ArrowRight aria-hidden="true"/></Link>{sourceWarning?<details className="team-source-details"><summary><AlertTriangle aria-hidden="true"/>Данные Google неполные<ChevronDown aria-hidden="true" className="team-source-chevron"/></summary><p>{sourceWarning} Отсутствие данных не считается невыходом. Последняя проверка: {readAt} МСК.</p></details>:<span>Google · {readAt} МСК</span>}</div>
  {tab==='overview'&&<>
   <div hidden>{controls}</div>
   <section className="team-panel"><div className="team-panel-title team-panel-title-compact"><h2>Команда сегодня</h2><span className="team-presence-note" title="Отметка начала не является независимым подтверждением присутствия.">Начало — по отметке сотрудника</span></div>
   <div className="team-filters team-filters-compact" role="group" aria-label="Показать сотрудников">{[['all','Все'],['attention','С замечаниями']].map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>{setFilter(id);}}>{label}</button>)}<select aria-label="Другие фильтры сотрудников" value={filter==='all'||filter==='attention'?'':filter} onChange={event=>{setFilter(event.target.value);}}><option value="" disabled>Другие фильтры</option>{filters.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div>
   <div className="team-column-head" aria-hidden="true"><span>Сотрудник / источник</span><span>План</span><span>Начало</span><span>Состояние</span><span>Контроль</span></div>
   {['wholesale','retail'].map(department=>{
    const all=rows.filter(r=>r.department===department),shown=all.filter(matches);

    return shown.length>0?<section key={department}>
     <div className="team-department"><div className="team-department-name"><b>{department==='wholesale'?'Опт':'Розница'}</b><span>{shown.length===all.length?`${all.length} чел.`:`${shown.length} из ${all.length} чел.`}</span></div>
</div>
     {shown.map(r=>{
      const summary=teamControlSummary(r,date,ownerActions);
      const hasPastQuestions=ownerActions.some(action=>action.employeeId===r.id);
      const primaryKey=summary.items[0]?.key;
      return <article className="team-employee" key={r.id}>
       <div><a className="team-person-link" href={`/admin/workday?date=${date}&control=all&employee=${r.id}#employees-control`} onClick={event=>openWorkdayCard(event,date)} title='Открыть день сотрудника' aria-label={`${r.name}: день сотрудника`}>{r.name}<ChevronRight className="team-person-chevron" aria-hidden="true"/></a><div className="team-person-meta"><small>{r.source.replace(' · пилот','')}</small></div></div>
       <div className="team-plan-cell" data-label="План"><div>{r.planState==='unknown'?'Не заполнен':r.planState==='unavailable'?'Нет данных':r.plan}{r.shift&&<small>{r.shift}</small>}</div><div className="team-employee-plan-controls">{planControls[rows.indexOf(r)]}</div></div>
       <div className="team-start-cell" data-label="Начало"><strong className="team-time">{r.start}</strong>{r.late>0&&<small className="team-amber">Позже на {r.late} мин</small>}</div>
       <div>{r.sourceUnavailable&&r.start==='—'&&r.end==='—'?<span className="team-control-clear">—</span>:<span className={`team-state-text ${r.state==='Работает'?'active':r.end!=='—'?'finished':r.state==='Не завершил смену'||r.missing?'attention':'neutral'}`}><i aria-hidden="true"/>{r.state==='План неизвестен'?'—':r.state}</span>}</div>
       <div className="team-control-anchor">{summary.kind==='normal'?<span className="team-control-clear" aria-label="Открытых вопросов по доступным сведениям нет">Без замечаний</span>:<a className={`team-control-indicator team-control-question ${summary.kind}`} onClick={event=>openWorkdayCard(event,date)} href={hasPastQuestions&&primaryKey&&summary.originDates.length===1?summary.items[0].href:hasPastQuestions&&primaryKey?`/admin/workday?date=${date}&control=all&view=attention#owner-case-${primaryKey.startsWith('past-')?primaryKey:`${r.id}-${primaryKey}`}`:summary.kind==='check'&&summary.items[0]?.key.startsWith('issue-')&&r.detailAvailable?`/admin/workday?date=${date}&control=all&employee=${r.id}&focus=shift-owner-issues#employees-control`:summary.kind==='employee'?`/admin/workday?date=${date}&control=all&employee=${r.id}&focus=shift-issues#employees-control`:summary.items[0]?.href??summary.timing[0]?.href??`/admin/attendance?date=${date}`} title={summary.kind==='employee'?'Открыть замечания сотрудника':summary.kind==='decision'?'Открыть запрос на ваше решение':summary.kind==='check'?'Открыть проверку':summary.label}><span className="team-control-copy"><span>{summary.label}</span><small>{controlCompositionLabel(summary.breakdown)??controlCountLabel(summary.totalCount||summary.count,summary.kind)}</small></span><ChevronRight className="team-control-chevron" aria-hidden="true"/></a>}</div>
      </article>;
     })}
    </section>:null;
   })}
   {!rows.some(matches)&&<p className="team-empty">Сотрудников по этому фильтру нет.</p>}
   </section>
  </>}
  {tab==='attention'&&<div className="team-action-queue">
    <div hidden>{controls}</div>
    {[
      ...(['decision','check','employee'] as const).map(kind=>({
       id:kind==='employee'?'watch':kind,
       title:kind==='decision'?'Ваши решения':kind==='check'?'Ваши проверки':'Замечания и сроки',
       action:kind==='decision'?'Рассмотреть':kind==='check'?'Проверить':'Подробнее',
       items:[...ownerActions.filter(item=>item.kind===kind).map(item=>({key:item.key,name:item.name,text:item.label,meta:item.context,href:item.href})),...departmentActions.filter(item=>item.kind===kind).map(item=>({key:item.key,name:'Розница · проверки чеков',text:item.label,meta:item.context,href:item.href})),
        ...rows.flatMap(r=>teamControlSummary(r,date).items.filter(item=>item.kind===kind).map(item=>({key:`${r.id}-${item.key}`,name:r.name,text:item.label,meta:item.context??'',href:item.href}))),
        ...(kind==='employee'?rows.flatMap(r=>teamControlSummary(r,date).timing.map(item=>({key:`${r.id}-${item.key}`,name:r.name,text:item.label,meta:'Сроки выполнения',href:item.href}))):[])],
      })),
    ].filter(group=>group.items.length>0).map(group=><section className={`team-queue-group ${group.id}`} key={group.id} aria-labelledby={`queue-${group.id}`}>
      <header><div><h2 id={`queue-${group.id}`}>{group.title} <span>Пунктов: {group.items.length}</span></h2></div></header>
      {group.items.length?[...new Set(group.items.map(item=>item.name))].map(name=><section className="team-queue-employee" key={name} id={name==='Розница · проверки чеков'?`department-fiscal-${group.id==='watch'?'employee':group.id}`:undefined}><h3>{name}</h3><div className="team-queue-employee-items">{group.items.filter(item=>item.name===name).map(item=><article className="team-queue-row" key={item.key} id={`owner-case-${item.key}`}><div className="team-queue-detail"><div className="team-queue-reason"><span className="team-queue-subject">{item.text.split(' · ')[0]}</span>{item.text.includes(' · ')&&<small className="team-queue-context">{item.text.split(' · ').slice(1).join(' · ')}</small>}{item.meta&&<small className="team-queue-context">{item.meta}</small>}</div><a className="team-button" href={item.href} onClick={event=>openWorkdayCard(event,date)}>{group.action}<ArrowRight aria-hidden="true"/></a></div></article>)}</div></section>):<p className="team-queue-empty">{group.id==='decision'?'Запросов на решение нет':group.id==='check'?'По полученным сведениям проверок не требуется':'Открытых обращений и нарушений сроков нет'}</p>}
    </section>)}
    {!ownerActions.length&&!departmentActions.length&&!rows.some(row=>{const summary=teamControlSummary(row,date);return summary.items.length||summary.timing.length;})&&<p className="team-empty">По доступным сведениям действий не требуется.</p>}
  </div>}
  {tab==='audit'&&<section className="team-panel team-prose"><h2>Фактические отметки и источники</h2><p>Здесь показаны зарегистрированные начало и завершение. Сроки будущих проверок не являются совершёнными событиями.</p>{rows.map(r=><div className="team-audit-row" key={r.id}><div><b>{r.name}</b><small>{r.source} · начало {r.start} · завершение {r.end}</small></div>{controls[rows.indexOf(r)]}</div>)}<Link href={`/admin/attendance?date=${date}&view=comparison`}>Сопоставить график и отметки источников →</Link></section>}
 </section>;
}
