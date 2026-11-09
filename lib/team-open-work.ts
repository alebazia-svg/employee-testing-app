import { teamControlSummary, type ControlSummaryRow, type DepartmentControlAction, type OwnerQueueAction } from './team-control-summary';

export type ShiftWork = { id: number; title: string; when: string };
type TeamRow = ControlSummaryRow & { name: string; openTasks?: ShiftWork[] };
type Kind = 'decision' | 'check' | 'employee';
export type OpenWork = { key: string; person: string; personKey: string; label: string; context: string; href: string; kind: Kind };

export function teamOpenWork(rows: TeamRow[], owners: OwnerQueueAction[], departments: DepartmentControlAction[], date: string) {
  const work = new Map<string, OpenWork>();
  const shiftTasks = new Map<string, OpenWork[]>();
  function add(item: OpenWork, taskNote?: string) {
    // Different checks can point to the same employee card. Deduplicate only a
    // concrete issue, cash operation or shift task, never the whole employee card.
    const url = new URL(item.href, 'https://portal.invalid');
    const id = url.searchParams.get('issue');
    const focus = url.searchParams.get('focus');
    const taskKey=focus?.startsWith('shift-task-') ? item.personKey+':'+focus : '';
    const related=taskKey ? shiftTasks.get(taskKey) || [] : [];
    if (taskNote && related.length) {
      for (const previous of related) {
        if (!previous.context.includes(taskNote)) previous.context=[previous.context,taskNote].filter(Boolean).join(' · ');
      }
      return;
    }
    // A shift task may have both a payment decision and a separate cash action:
    // keep their labels, even when their detail link is identical.
    const source = id ? 'issue-'+id : focus && /^shift-(?:cash|request)-/.test(focus) ? focus : item.key;
    const key=item.personKey+':'+source;
    const previous=work.get(key);
    if (previous) {
      if (previous.context!==item.context && item.context && !previous.context.includes(item.context))
        previous.context=[previous.context,item.context].filter(Boolean).join(' · ');
      return;
    }
    work.set(key,item);
    if (taskKey) shiftTasks.set(taskKey,[...related,item]);
  }
  for (const item of owners) add({ ...item,person:item.name,personKey:'user:'+item.employeeId });
  for (const item of departments) add({ ...item,person:'Розница · проверки чеков',personKey:'department:'+item.department });
  for (const row of rows) {
    const person={person:row.name,personKey:'user:'+row.id};
    const summary=teamControlSummary(row,date);
    for (const item of summary.items) add({...person,...item,key:row.id+'-'+item.key,context:item.context||''});
    for (const item of summary.timing) add({...person,...item,key:row.id+'-'+item.key,context:'Сроки выполнения',kind:'employee'},item.label);
    for (const task of row.openTasks||[]) add({...person,key:'task-'+task.id,label:task.title,context:task.when,kind:'employee',
      href:'/admin/workday?date='+date+'&control=all&employee='+row.id+'&focus=shift-task-'+task.id+'#employees-control'},task.when);
  }
  const rank={decision:0,check:1,employee:2};
  return [...work.values()].sort((a,b)=>a.person.localeCompare(b.person,'ru')||rank[a.kind]-rank[b.kind]||a.label.localeCompare(b.label,'ru'));
}
