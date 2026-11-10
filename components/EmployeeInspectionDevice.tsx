import React from 'react';
import { employeeScreenLabel } from '@/lib/employee-screen-state';
import { ChevronDown } from 'lucide-react';
import type { InspectionDeviceSnapshot } from '@/lib/employee-inspection-state';

/** Inspection-only source note, outside the reused employee interface. */
export function EmployeeInspectionDevice({snapshot,selectedId,onSelect,framed,followScreen,onFollow}:{snapshot:InspectionDeviceSnapshot|null;selectedId:string;onSelect:(id:string)=>void;framed:boolean;followScreen?:boolean;onFollow?:(next:boolean)=>void}) {
  const selected=snapshot?.connections.find(c=>c.id===snapshot.selectedId);
  const when=selected?.checkedAt ? new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(selected.checkedAt)):null;
  const signalAt=selected?.runtimeAt ?? selected?.runtime?.sampledAt;
  const signalWhen=signalAt ? new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(signalAt)):null;
  const signalShort=signalAt ? new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(signalAt)):null;
  const status=!followScreen ? `Самостоятельный просмотр${signalShort ? ` · сигнал от ${signalShort}` : ''}`
    : selected?.runtime ? `${selected.live ? 'Свежие сведения' : 'Последний сигнал'}${signalShort ? ` · ${signalShort}` : ''}`
    : !snapshot ? 'Получаем сведения об устройстве…' : snapshot.unavailable ? 'Сведения устройства временно недоступны' : 'Сведения об экране пока не получены';
  return <aside aria-label='Устройство сотрудника' className={`border-b border-[#d7c4b1] bg-[#f8eee3] px-4 py-2 text-xs text-[#493829] ${framed?'':'mx-auto'}`}>
    <details className='group mx-auto max-w-5xl'>
      <summary aria-label='Подробнее о просмотре сотрудника' className='flex min-h-10 cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden'>
        <span role='status' title={signalWhen ? `${signalWhen} МСК` : undefined} className='min-w-0 leading-5'>{status}</span>
        <span className='flex shrink-0 items-center gap-1 font-semibold'>Подробнее<ChevronDown size={14} aria-hidden className='transition-transform group-open:rotate-180'/></span>
      </summary>
      <div className='flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#d7c4b1] pb-2 pt-3'>
      <p className='basis-full font-semibold'>Проверка интерфейса · изменения не сохраняются.</p>
      {snapshot && (snapshot.connections.length>1 || snapshot.connections.length===1 && !selected) ? <label className='flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto'>Устройство<select aria-label='Устройство сотрудника' value={selectedId} onChange={e=>onSelect(e.target.value)} className='min-h-10 min-w-0 w-0 flex-1 max-w-full rounded-lg border border-[#d7c4b1] bg-white px-2'>
        {!selected && <option value={selectedId}>Устройство недоступно</option>}
        {snapshot.connections.map(c=><option key={c.id} value={c.id}>{c.label} · {new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(c.lastSeenAt))}</option>)}
      </select></label> : <strong>{selected?.label ?? (snapshot ? 'Устройство не определено':'Проверяем устройство сотрудника…')}</strong>}
      {selected?.runtime && <span>{selected.live ? 'Свежие сведения из приложения' : 'Последние сведения из приложения'} · {new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(selected.runtimeAt ?? selected.runtime.sampledAt))} МСК</span>}
      {selected?.runtime?.screen&&<strong>{selected.live?'Экран: ':'Последний известный экран: '}{employeeScreenLabel(selected.runtime.screen)}</strong>}
      {onFollow&&<label className='flex min-h-9 items-center gap-2 font-medium'><input type='checkbox' checked={followScreen} onChange={e=>onFollow(e.target.checked)}/>По данным сотрудника</label>}
      {onFollow&&!followScreen&&<span className='font-semibold'>Ручная проверка интерфейса · экран сотрудника сейчас не воспроизводится.</span>}
      {followScreen&&<span>{selected?.live&&selected.runtime?.screen?'Раздел и поддерживаемые окна обновляются автоматически.':'Последние сведения не подтверждают, что этот экран открыт сейчас.'}</span>}
      {selected ? <span>Настройка уведомлений: {selected.pushLabel}{when ? ` · проверено ${when} МСК`:''}</span> : snapshot && <span>{snapshot.unavailable ? 'Сведения временно недоступны':'Нет свежих данных об уведомлениях'}</span>}
      {selected && (selected.runtime ? !selected.live : !selected.fresh) && <span>Настройки обновятся при открытии приложения сотрудником.</span>}
      <p className='basis-full leading-5'>Кабинет показывает данные портала. Это не сохранённый снимок экрана телефона; несохранённый ввод сотрудника не передаётся.</p>
      </div>
    </details>
  </aside>;
}
