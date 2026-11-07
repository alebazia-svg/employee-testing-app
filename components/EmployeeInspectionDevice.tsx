import type { InspectionDeviceSnapshot } from '@/lib/employee-inspection-state';

/** Inspection-only source note, outside the reused employee interface. */
export function EmployeeInspectionDevice({snapshot,selectedId,onSelect,framed}:{snapshot:InspectionDeviceSnapshot|null;selectedId:string;onSelect:(id:string)=>void;framed:boolean}) {
  const selected=snapshot?.connections.find(c=>c.id===snapshot.selectedId);
  const when=selected?.checkedAt ? new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(selected.checkedAt)):null;
  return <aside aria-label='Устройство сотрудника' className={`border-b border-[#d7c4b1] bg-[#f8eee3] px-4 py-2 text-xs text-[#493829] ${framed?'':'mx-auto'}`}>
    <div className='mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1'>
      {snapshot && (snapshot.connections.length>1 || snapshot.connections.length===1 && !selected) ? <label className='flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto'>Устройство<select aria-label='Устройство сотрудника' value={selectedId} onChange={e=>onSelect(e.target.value)} className='min-h-10 min-w-0 w-0 flex-1 max-w-full rounded-lg border border-[#d7c4b1] bg-white px-2'>
        {!selected && <option value={selectedId}>Устройство недоступно</option>}
        {snapshot.connections.map(c=><option key={c.id} value={c.id}>{c.label} · {new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(c.lastSeenAt))}</option>)}
      </select></label> : <strong>{selected?.label ?? (snapshot ? 'Устройство не определено':'Проверяем устройство сотрудника…')}</strong>}
      {selected?.runtime && <span>{selected.live ? 'PWA на связи' : 'Последнее состояние PWA'} · {new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(selected.runtimeAt ?? selected.runtime.sampledAt))} МСК</span>}
      {selected ? <span>{selected.pushLabel}{when ? ` · проверено ${when} МСК`:''}</span> : snapshot && <span>{snapshot.unavailable ? 'Сведения временно недоступны':'Нет свежих данных об уведомлениях'}</span>}
      {selected && (selected.runtime ? !selected.live : !selected.fresh) && <span>Настройки обновятся при открытии приложения сотрудником.</span>}
    </div>
  </aside>;
}
