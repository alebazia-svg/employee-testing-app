'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCw, X } from 'lucide-react';
import type { EmployeeActivityReport } from '@/lib/employee-activity-report';
const time = (v: string) => new Date(v).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const dateLabel = (v: string) => new Date(v).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' });
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export default function EmployeeActivityDialog({ user, onClose }: { user: { id: number; name: string; portalArea: string }; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(today), [revision, setRevision] = useState(0);
  const [data, setData] = useState<EmployeeActivityReport | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [section, setSection] = useState<string | null>(null), [notice, setNotice] = useState<number | null>(null);
  useEffect(() => {
    const focused = document.activeElement as HTMLElement | null;
    dialog.current?.showModal(); const old = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = old; focused?.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setData(null); setSection(null); setNotice(null);
    void fetch(`/api/admin/employees/${user.id}/activity?date=${date}`, { cache: 'no-store', signal: controller.signal })
      .then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error || 'Не удалось загрузить историю.'); return body as EmployeeActivityReport; })
      .then(body => { if (!controller.signal.aborted) setData(body); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Не удалось загрузить историю.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user.id, date, revision]);
  const rows = data?.sections.filter(s => s.events.length || (user.portalArea === 'PROCUREMENT' ? ['procurement','notifications'] : ['day','schedule','payroll','notifications']).includes(s.id)) ?? [];
  const visits = rows.reduce((n,s) => n+s.visits,0), actions = rows.reduce((n,s) => n+s.actions,0);
  const last = rows.map(s => s.lastAt).filter((s): s is string => !!s).sort().at(-1);
  const coverage = data?.startedAt && date >= new Date(data.startedAt).toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });
  return <dialog ref={dialog} onCancel={e => { e.preventDefault(); onClose(); }} aria-labelledby="employee-activity-title" className="m-auto w-[calc(100%-24px)] max-w-[980px] max-h-[calc(100dvh-32px)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/45">
    <div className="flex max-h-[calc(100dvh-32px)] flex-col">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6"><div><p className="text-sm font-medium text-[#945e3b]">{user.name}</p><h2 id="employee-activity-title" className="mt-1 text-xl font-bold text-slate-950">Активность и поручения</h2></div><button onClick={onClose} aria-label="Закрыть активность" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-[#f3e4d6]"><X className="h-5 w-5" /></button></header>
      <div className="min-h-0 overflow-y-auto px-5 py-4 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm"><label className="flex items-center gap-2 font-semibold text-slate-700">День<input type="date" value={date} max={today()} min={new Date(Date.now()-89*86400000).toISOString().slice(0,10)} onChange={e=>{if(e.target.value)setDate(e.target.value);}} className="min-h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm"/></label><button disabled={loading} onClick={()=>setRevision(n=>n+1)} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-slate-600 hover:bg-[#fbf0e5] disabled:opacity-40"><RefreshCw className="h-4 w-4"/>Обновить</button></div>
        {loading && <p role="status" className="py-8 text-center text-sm text-slate-500">Загружаем историю…</p>}
        {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}<button onClick={()=>setRevision(n=>n+1)} className="ml-3 underline">Повторить</button></div>}
        {data && <>
          <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 sm:grid-cols-3">
            <div><p className="text-xs text-slate-500">Посещения разделов</p><p className="mt-1 text-sm font-semibold">{coverage ? `${visits} зафиксировано` : 'Ещё не собирались'}</p></div>
            <div><p className="text-xs text-slate-500">Последняя запись</p><p className="mt-1 text-sm font-semibold">{last ? time(last) : 'Нет записей'}</p></div>
            <div><p className="text-xs text-slate-500">Действия и результаты</p><p className="mt-1 text-sm font-semibold">{actions} сохранено</p></div>
          </div>
          {data.truncated && <p className="mb-3 text-sm text-amber-800">Показаны последние записи. Дневной лимит достигнут; итоги могут быть неполными.</p>}
          <section className="mb-4" aria-labelledby="activity-sections-title"><h3 id="activity-sections-title" className="mb-2 text-sm font-bold text-slate-950">Разделы приложения</h3>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="hidden grid-cols-[150px_100px_130px_minmax(0,1fr)_16px] gap-3 bg-slate-50 px-4 py-2 text-xs text-slate-500 md:grid"><span>Раздел</span><span>Посещения</span><span>Последняя запись</span><span>Что зафиксировано</span><span/></div>
              {rows.map(row=><div key={row.id} className="border-t border-slate-100 first:border-t-0">
                <button onClick={()=>setSection(v=>v===row.id?null:row.id)} aria-expanded={section===row.id} className="grid w-full grid-cols-[1fr_16px] items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-[#fbf0e5] md:grid-cols-[150px_100px_130px_minmax(0,1fr)_16px]">
                  <strong className="text-sm">{row.label}</strong><span className="col-start-1 text-sm text-slate-600 md:col-auto"><span className="md:hidden">Посещения: </span>{coverage ? row.visits : 'не считались'}</span><span className="col-start-1 text-sm tabular-nums md:col-auto"><span className="mr-1 text-xs text-slate-500 md:hidden">Последняя запись:</span>{row.lastAt?time(row.lastAt):'Нет записей'}</span><span className="col-start-1 text-sm text-slate-700 md:col-auto">{row.actions ? `Записей: ${row.actions}` : 'Нет сохранённых действий'}</span><ChevronDown className={`col-start-2 row-start-1 h-4 w-4 text-[#945e3b] md:col-auto md:row-auto ${section===row.id?'rotate-180':''}`}/>
                </button>
                {section===row.id&&<div className="max-h-72 overflow-y-auto border-t border-slate-100 bg-[#fbf8f4] px-4 py-2">{row.events.length?row.events.map(e=><div key={e.id} className="flex items-start gap-3 py-2"><time className="w-[70px] shrink-0 text-sm tabular-nums text-slate-500">{time(e.at)}</time><div><p className="text-sm font-medium">{e.title}</p><p className="mt-1 text-xs text-slate-500">{e.note}</p></div></div>):<p className="py-2 text-sm text-slate-600">Нет записей за этот день. Это не доказывает, что сотрудник не пользовался приложением.</p>}</div>}
              </div>)}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{data.startedAt ? `Посещения собираются с ${dateLabel(data.startedAt)}, ${time(data.startedAt)}. ` : 'Сбор посещений пока не включён. '}История — {data.retentionDays} дней. Проверка кабинета администратором не считается посещением сотрудника.</p>
          </section>
          <section aria-labelledby="activity-tasks-title"><h3 id="activity-tasks-title" className="mb-2 text-sm font-bold text-slate-950">Уведомления и результат</h3>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="hidden grid-cols-[minmax(200px,1fr)_90px_110px_170px_16px] gap-3 bg-slate-50 px-4 py-2 text-xs text-slate-500 md:grid"><span>Что требовалось</span><span>Отправлено</span><span>Открыл</span><span>Результат</span><span/></div>
              {!data.obligations.length&&<p className="px-4 py-4 text-sm text-slate-500">За этот день отправленных уведомлений нет.</p>}
              {data.obligations.map(n=><div key={n.id} className="border-t border-slate-100 first:border-t-0">
                <button onClick={()=>setNotice(v=>v===n.id?null:n.id)} aria-expanded={notice===n.id} className="grid w-full grid-cols-2 items-start gap-3 px-4 py-3 text-left hover:bg-[#fbf0e5] md:grid-cols-[minmax(200px,1fr)_90px_110px_170px_16px]">
                  <strong className="col-span-2 text-sm md:col-span-1">{n.title}</strong><span className="text-sm tabular-nums"><small className="block text-slate-500 md:hidden">Отправлено</small>{time(n.sentAt)}</span><span className="text-sm tabular-nums"><small className="block text-slate-500 md:hidden">Открыл</small>{n.openedAt?<>{dateLabel(n.openedAt)!==dateLabel(n.sentAt)&&<small className="block">{dateLabel(n.openedAt)}</small>}{time(n.openedAt)}</>:<span className="text-xs text-slate-500">Не подтверждено</span>}</span><span className={`text-sm ${['Выполнение не подтверждено','Информационное сообщение'].includes(n.result)?'text-slate-500':'font-semibold text-emerald-800'}`}>{n.result}</span><ChevronDown className={`h-4 w-4 justify-self-end text-[#945e3b] ${notice===n.id?'rotate-180':''}`}/>
                </button>
                {notice===n.id&&<div className="space-y-2 border-t border-slate-100 bg-[#fbf8f4] px-4 py-3 text-sm"><p>{n.body}</p>{n.resultAt&&<p>Результат: {dateLabel(n.resultAt)}, {time(n.resultAt)}</p>}<p>{n.note}</p><p className="text-xs text-slate-500">{n.push}</p>{!n.openedAt&&n.legacyReadAt&&<p className="text-xs text-slate-500">Есть прежняя отметка прочтения ({dateLabel(n.legacyReadAt)}, {time(n.legacyReadAt)}). Она могла быть проставлена автоматически и не считается доказательством открытия.</p>}</div>}
              </div>)}
            </div>
          </section>
        </>}
      </div>
      <footer className="shrink-0 border-t px-5 py-3 text-xs text-slate-500 sm:px-6">{data?`Обновлено ${time(data.checkedAt)} · время московское. `:''}Записи помогают проверить работу; количество посещений не является оценкой сотрудника.</footer>
    </div>
  </dialog>;
}
