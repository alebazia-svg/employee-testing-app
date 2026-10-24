'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Eye, Check, Bell, RefreshCw, X } from 'lucide-react';
import type { EmployeeActivityReport } from '@/lib/employee-activity-report';
const time = (v: string) => new Date(v).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const dateLabel = (v: string) => new Date(v).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' });
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export default function EmployeeActivityDialog({ user, onClose }: { user: { id: number; name: string; portalArea: string }; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [date, setDate] = useState(today), [revision, setRevision] = useState(0);
  const [data, setData] = useState<EmployeeActivityReport | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [shown, setShown] = useState(6);
  const [section, setSection] = useState<string | null>(null), [notice, setNotice] = useState<number | null>(null);
  useEffect(() => {
    const focused = document.activeElement as HTMLElement | null;
    dialog.current?.showModal(); const old = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = old; focused?.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setData(null); setSection(null); setNotice(null); setShown(6);
    void fetch(`/api/admin/employees/${user.id}/activity?date=${date}`, { cache: 'no-store', signal: controller.signal })
      .then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error || 'Не удалось загрузить историю.'); return body as EmployeeActivityReport; })
      .then(body => { if (!controller.signal.aborted) setData(body); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Не удалось загрузить историю.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user.id, date, revision]);
  const rows = data?.sections.filter(s => s.events.length || (user.portalArea === 'PROCUREMENT' ? ['procurement','notifications'] : ['day','schedule','payroll','notifications']).includes(s.id)) ?? [];
  const visits = rows.reduce((n,s) => n+s.visits,0);
  const facts = rows.flatMap(s => s.events.map(e => ({...e, label: s.label}))).sort((a,b) => b.at.localeCompare(a.at));
  const obligations = data?.obligations.filter(n => n.result !== 'Информационное сообщение') ?? [];
  const information = data?.obligations.filter(n => n.result === 'Информационное сообщение') ?? [];
  const coverage = data?.startedAt && date >= new Date(data.startedAt).toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });
  return <dialog ref={dialog} onCancel={e => { e.preventDefault(); onClose(); }} aria-labelledby="employee-activity-title" className="m-auto w-[calc(100%-24px)] max-w-[980px] max-h-[calc(100dvh-32px)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/45">
    <div className="flex max-h-[calc(100dvh-32px)] flex-col">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6"><div><p className="text-sm font-medium text-[#945e3b]">{user.name}</p><h2 id="employee-activity-title" className="mt-1 text-xl font-bold text-slate-950">Активность и поручения</h2></div><button onClick={onClose} aria-label="Закрыть активность" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-[#f3e4d6]"><X className="h-5 w-5" /></button></header>
      <div className="min-h-0 overflow-y-auto px-5 py-4 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm"><label className="flex items-center gap-2 font-semibold text-slate-700">День<input type="date" value={date} max={today()} min={new Date(Date.now()-89*86400000).toISOString().slice(0,10)} onChange={e=>{if(e.target.value)setDate(e.target.value);}} className="min-h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm"/></label><button disabled={loading} onClick={()=>setRevision(n=>n+1)} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-slate-600 hover:bg-[#fbf0e5] disabled:opacity-40"><RefreshCw className="h-4 w-4"/>Обновить</button></div>
        {loading && <p role="status" className="py-8 text-center text-sm text-slate-500">Загружаем историю…</p>}
        {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}<button onClick={()=>setRevision(n=>n+1)} className="ml-3 underline">Повторить</button></div>}
        {data && <>
          {data.truncated && <p className="mb-3 text-sm text-amber-800">История неполная: показана доступная часть записей.</p>}
          <section className="mb-5" aria-labelledby="activity-day-title">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h3 id="activity-day-title" className="text-base font-bold text-slate-950">История дня</h3><span className="text-xs text-slate-500">Новые события сверху · время московское</span></div>
            {!visits && <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{coverage ? 'Посещений пока нет в журнале. Это не означает, что сотрудник не заходил.' : 'В этот день посещения ещё не записывались.'}</p>}
            <div className="overflow-hidden rounded-xl border border-slate-200">
              {!facts.length && <p role="status" className="px-4 py-6 text-sm text-slate-500">За этот день записей нет.</p>}
              {facts.slice(0, shown).map(e => {
                const opening = !e.visit && e.title.startsWith('Открыл уведомление');
                const Icon = e.visit ? Eye : opening ? Bell : Check;
                return <div key={e.id} className="grid grid-cols-[64px_20px_minmax(0,1fr)] items-start gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0 sm:grid-cols-[74px_24px_minmax(0,1fr)]">
                  <time className="pt-0.5 text-sm tabular-nums text-slate-500">{time(e.at)}</time>
                  <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 ${e.visit ? 'text-[#945e3b]' : opening ? 'text-slate-500' : 'text-emerald-700'}`}/>
                  <div className="min-w-0"><div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5"><p className="text-sm font-semibold text-slate-900">{e.visit ? e.label : e.title}</p>{e.visit && <p className="text-sm text-slate-500">Открыл раздел</p>}</div>
                    {!e.visit && !opening && <details className="mt-1 text-xs text-slate-500"><summary className="w-fit cursor-pointer text-[#945e3b]">Подробнее</summary><p className="mt-1 leading-5">{e.note}</p></details>}
                  </div>
                </div>;
              })}
            </div>
            {facts.length > shown && <button onClick={()=>setShown(n=>n+6)} className="mt-2 min-h-10 rounded-lg px-3 text-sm font-medium text-[#945e3b] hover:bg-[#fbf0e5]">Показать ещё · осталось {facts.length-shown}</button>}
          </section>
          <details className="mb-5 rounded-xl border border-slate-200">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-[#fbf0e5]">Посещения по разделам <span className="ml-2 font-normal text-slate-500">{coverage ? `Всего: ${visits}` : 'Ещё не записывались'}</span></summary>
          <section className="border-t border-slate-100 px-3 py-3" aria-label="Посещения вкладок и страниц">
            <p className="mb-3 text-xs leading-5 text-slate-500">Открытия разделов, даже если сотрудник ничего не сохранял. Нажмите строку, чтобы увидеть время каждого посещения.</p>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="hidden grid-cols-[minmax(150px,1fr)_100px_130px_130px_16px] gap-3 bg-slate-50 px-4 py-2 text-xs text-slate-500 md:grid"><span>Вкладка / страница</span><span>Открытий</span><span>Первое</span><span>Последнее</span><span/></div>
              {rows.map(row=>{const openings = row.events.filter(e=>e.visit); return <div key={row.id} className="border-t border-slate-100 first:border-t-0">
                <button onClick={()=>setSection(v=>v===row.id?null:row.id)} aria-expanded={section===row.id} className="grid w-full grid-cols-[1fr_auto_16px] items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-[#fbf0e5] md:grid-cols-[minmax(150px,1fr)_100px_130px_130px_16px]">
                  <strong className="text-sm">{row.label}</strong><span className="text-sm font-semibold text-slate-700"><span className="mr-1 font-normal md:hidden">Открытий:</span>{coverage ? row.visits : '—'}</span><span className="col-start-1 row-start-2 text-sm tabular-nums text-slate-600 md:col-auto md:row-auto"><span className="mr-1 text-xs text-slate-500 md:hidden">Первое:</span>{openings.at(-1)?time(openings.at(-1)!.at):'—'}</span><span className="col-span-2 col-start-2 row-start-2 text-right text-sm tabular-nums text-slate-600 md:col-auto md:row-auto md:text-left"><span className="mr-1 text-xs text-slate-500 md:hidden">Последнее:</span>{openings[0]?time(openings[0].at):'—'}</span><ChevronDown className={`col-start-3 row-start-1 h-4 w-4 text-[#945e3b] md:col-auto md:row-auto ${section===row.id?'rotate-180':''}`}/>
                </button>
                {section===row.id&&<div className="max-h-60 overflow-y-auto border-t border-slate-100 bg-[#fbf8f4] px-4 py-2">{openings.length?openings.map(e=><div key={e.id} className="flex items-start gap-3 py-2"><time className="w-[70px] shrink-0 text-sm tabular-nums text-slate-500">{time(e.at)}</time><p className="text-sm">Открыл «{row.label}»</p></div>):<p className="py-2 text-sm text-slate-600">Открытия этой вкладки не зафиксированы. Сохранённое действие само по себе не считается посещением.</p>}</div>}
              </div>;})}
            </div>
          </section>
          </details>
          <section aria-labelledby="activity-tasks-title"><h3 id="activity-tasks-title" className="mb-2 text-sm font-bold text-slate-950">Поручения и результат</h3>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              {obligations.length > 0 && <div className="hidden grid-cols-[minmax(200px,1fr)_90px_110px_170px_16px] gap-3 bg-slate-50 px-4 py-2 text-xs text-slate-500 md:grid"><span>Что требовалось</span><span>Отправлено</span><span>Открыл</span><span>Результат</span><span/></div>}
              {!obligations.length&&<p className="px-4 py-4 text-sm text-slate-500">За этот день поручений не отправлялось.</p>}
              {obligations.map(n=><div key={n.id} className="border-t border-slate-100 first:border-t-0">
                <button onClick={()=>setNotice(v=>v===n.id?null:n.id)} aria-expanded={notice===n.id} className="grid w-full grid-cols-2 items-start gap-3 px-4 py-3 text-left hover:bg-[#fbf0e5] md:grid-cols-[minmax(200px,1fr)_90px_110px_170px_16px]">
                  <strong className="col-span-2 text-sm md:col-span-1">{n.title}</strong><span className="text-sm tabular-nums"><small className="block text-slate-500 md:hidden">Отправлено</small>{time(n.sentAt)}</span><span className="text-sm tabular-nums"><small className="block text-slate-500 md:hidden">Открыл</small>{n.openedAt?<>{dateLabel(n.openedAt)!==dateLabel(n.sentAt)&&<small className="block">{dateLabel(n.openedAt)}</small>}{time(n.openedAt)}</>:<span className="text-xs text-slate-500">Не подтверждено</span>}</span><span className={`text-sm ${['Выполнение не подтверждено','Информационное сообщение'].includes(n.result)?'text-slate-500':'font-semibold text-emerald-800'}`}>{n.result}</span><ChevronDown className={`h-4 w-4 justify-self-end text-[#945e3b] ${notice===n.id?'rotate-180':''}`}/>
                </button>
                {notice===n.id&&<div className="space-y-2 border-t border-slate-100 bg-[#fbf8f4] px-4 py-3 text-sm"><p>{n.body}</p>{n.resultAt&&<p>Результат: {dateLabel(n.resultAt)}, {time(n.resultAt)}</p>}<p>{n.note}</p><p className="text-xs text-slate-500">{n.push}</p>{!n.openedAt&&n.legacyReadAt&&<p className="text-xs text-slate-500">Есть прежняя отметка прочтения ({dateLabel(n.legacyReadAt)}, {time(n.legacyReadAt)}). Она могла быть проставлена автоматически и не считается доказательством открытия.</p>}</div>}
              </div>)}
            </div>
          </section>
          {information.length > 0 && <details className="mt-3 rounded-xl border border-slate-200"><summary className="cursor-pointer px-4 py-3 text-sm text-slate-600 hover:bg-[#fbf0e5]">Информационные сообщения · {information.length}</summary><div className="border-t border-slate-100 px-4 py-2">{information.map(n=><div key={n.id} className="py-2"><p className="text-sm font-medium">{n.title}</p><p className="mt-1 text-xs text-slate-500">Отправлено {time(n.sentAt)} · {n.openedAt ? `Открыто ${dateLabel(n.openedAt)}, ${time(n.openedAt)}` : 'Открытие не подтверждено'}</p><p className="mt-1 text-xs text-slate-500">Не требует выполнения.</p></div>)}</div></details>}
          <details className="mt-4 text-xs text-slate-500"><summary className="w-fit cursor-pointer">Как читать эту историю</summary><p className="mt-2 leading-5">Открытие раздела фиксируется, даже если ничего не сохранено. Оно не подтверждает прочтение. Действия показаны отдельными событиями, когда есть сохранённые сведения; не все нажатия записываются.</p><p className="mt-2 leading-5">{data.startedAt ? `Посещения записываются с ${dateLabel(data.startedAt)}, ${time(data.startedAt)}, после обновления приложения сотрудника. ` : 'Сбор посещений пока не включён. '}Предыдущие переходы восстановить нельзя. Проверка администратором исключена. История хранится {data.retentionDays} дней.</p></details>
        </>}
      </div>
      <footer className="shrink-0 border-t px-5 py-3 text-xs text-slate-500 sm:px-6">{data?`Обновлено ${time(data.checkedAt)}. `:''}Открытие раздела и выполнение поручения — разные события.</footer>
    </div>
  </dialog>;
}
