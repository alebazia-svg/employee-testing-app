'use client';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { openWorkdayCard } from '@/lib/workday-card-navigation';
import type { OpenWork } from '@/lib/team-open-work';

export function TeamOpenWork({items,date}:{items:OpenWork[];date:string}) {
  const [person,setPerson]=useState('all');
  const people=new Map(items.map(item=>[item.personKey,item.person]));
  const selected=people.has(person)?person:'all';
  const visible=items.filter(item=>selected==='all'||item.personKey===selected);
  return <section className="team-queue-group watch" aria-labelledby="open-team-work">
    <header><div><h2 id="open-team-work">Незавершённые задачи <span>Всего: {visible.length}</span></h2></div>
      {people.size>1&&<label>Сотрудник <select aria-label="Ответственный сотрудник" value={selected} onChange={event=>setPerson(event.target.value)}>
        <option value="all">Все ответственные</option>{[...people].map(([id,name])=><option key={id} value={id}>{name}</option>)}
      </select></label>}
    </header>
    {visible.length===0&&<p className="team-empty">По доступным данным открытых задач нет.</p>}
    {[...people].filter(([id])=>selected==='all'||id===selected).map(([id,name])=><section className="team-queue-employee" key={id} aria-label={name}>
      <h3>{name}</h3><div className="team-queue-employee-items">
        {visible.filter(item=>item.personKey===id).map(item=><article className="team-queue-row" key={item.key} id={'owner-case-'+item.key}>
          <div className="team-queue-detail"><div className="team-queue-reason">
            <strong className="team-queue-subject">{item.label}</strong>
            {(item.context || item.kind!=='employee')&&<small className="team-queue-context">{[
              item.kind==='decision'?'Требуется решение администратора':item.kind==='check'?'Проверка администратора':'',item.context
            ].filter(Boolean).join(' · ')}</small>}
          </div><a className="team-button" href={item.href} onClick={event=>openWorkdayCard(event,date)}>{
            item.kind==='decision'?'Рассмотреть':item.kind==='check'?'Проверить':'Подробнее'}<ArrowRight aria-hidden="true"/>
          </a></div>
        </article>)}
      </div>
    </section>)}
  </section>;
}
