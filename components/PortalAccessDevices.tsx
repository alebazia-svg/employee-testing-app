'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Monitor, Smartphone, Search, History, ArrowLeft, Check, BellOff, Clock3 } from 'lucide-react';
import type { AccessJournalRow } from './PortalAccessJournal';
import { accessPushView, accessWhen, filterAccessRows, groupAccessRows } from '../lib/portal-access-view';
import { startVisibleSync } from '../lib/visible-sync';

const columns = 'lg:grid-cols-[minmax(170px,1fr)_minmax(160px,.85fr)_minmax(190px,1.1fr)_minmax(200px,1.15fr)]';
export type AccessDevicesProps = {
  rows: AccessJournalRow[]; query: string; history: boolean; page: number;
  hasMore: boolean; unavailable: boolean; nowIso: string;
};

export function PortalAccessDevices(props: AccessDevicesProps) {
  const router = useRouter();
  useEffect(() => {
    let lastRefresh = Date.now();
    return startVisibleSync(() => {
      if (Date.now() - lastRefresh < 60000) return;
      lastRefresh = Date.now();
      router.refresh();
    }, 60000);
  }, [router]);
  return <PortalAccessDevicesView {...props} />;
}

export function PortalAccessDevicesView({ rows, query, history, page, hasMore, unavailable, nowIso }: AccessDevicesProps) {
  const [search, setSearch] = useState(query);
  const [attention, setAttention] = useState(false);
  useEffect(() => { setSearch(query); }, [query, history]);
  const now = new Date(nowIso);
  const visible = history ? rows : filterAccessRows(rows, search, attention, now);
  const attentionCount = filterAccessRows(rows, search, true, now).length;
  const href = (next: number) => `/admin/employees/access?${new URLSearchParams({ view: 'history', q: query, page: String(next) })}`;
  return <section aria-label={history ? 'История входов' : 'Устройства сотрудников'} className='mt-5 max-w-6xl'>
    <div className='mb-4 flex flex-wrap items-center gap-3'>
      <form method='get' action='/admin/employees/access' onSubmit={history ? undefined : e => e.preventDefault()} className='flex min-w-0 flex-1 items-center gap-2 lg:max-w-md'>
        {history ? <input type='hidden' name='view' value='history' /> : null}
        <label className='relative min-w-0 flex-1'><Search aria-hidden className='pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400' /><span className='sr-only'>Поиск сотрудника или устройства</span>
          <input name='q' value={search} maxLength={100} onChange={e => setSearch(e.target.value)} placeholder='Сотрудник или устройство' className='h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200' />
        </label>
        {history ? <button className='min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600'>Найти</button> : null}
      </form>
      {!history ? <button onClick={() => setAttention(v => !v)} aria-pressed={attention} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${attention ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-600'}`}>Требуют внимания{!unavailable ? <span className='ml-1 text-xs'>{attentionCount}</span> : null}</button> : null}
      <Link href={history ? '/admin/employees/access' : '/admin/employees/access?view=history'} className='ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600'>
        {history ? <ArrowLeft aria-hidden className='h-4 w-4' /> : <History aria-hidden className='h-4 w-4' />}{history ? 'К устройствам' : 'История входов'}
      </Link>
    </div>
    {unavailable ? <p role='alert' className='rounded-xl bg-amber-50 p-4 text-sm text-amber-900'>Журнал временно недоступен. Это не означает, что входов не было.</p> : <>
      {history ? <div className='overflow-hidden rounded-2xl border border-slate-200 bg-white'>
        <div className='border-b border-slate-200 px-5 py-4'><h2 className='font-bold text-slate-900'>История входов</h2><p className='mt-1 text-xs text-slate-500'>Текущие и завершённые сеансы. Новые — сверху.</p></div>
        <div className='hidden grid-cols-4 gap-4 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500 lg:grid' aria-hidden><span>Сотрудник</span><span>Устройство · браузер</span><span>Вход</span><span>Выход</span></div>
        {rows.map(row => <article key={row.id} className='grid gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4'>
          <div><h3 className='font-semibold'>{row.name}</h3><p className='mt-1 text-xs text-slate-500'>{row.login}</p></div>
          <p>{row.device} · {row.browser}</p>
          <div><span className='text-xs text-slate-500 lg:hidden'>Вход: </span>{row.loginAt ? accessWhen(row.loginAt, now) : <><p>Не зафиксирован</p><p className='mt-1 text-xs text-slate-500'>Обнаружен: {accessWhen(row.firstSeenAt, now)}</p></>}</div>
          <p><span className='text-xs text-slate-500 lg:hidden'>Выход: </span>{row.loggedOutAt ? accessWhen(row.loggedOutAt, now) : new Date(row.expiresAt) <= now ? 'Срок входа истёк' : 'Не зафиксирован'}</p>
        </article>)}
        {!rows.length ? <p className='p-8 text-center text-sm text-slate-500'>{query ? 'Совпадений нет. Измените поиск.' : 'Записей пока нет.'}</p> : null}
      </div> : <div className='overflow-hidden rounded-2xl border border-slate-200 bg-white'>
        <div className={`hidden gap-5 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500 lg:grid ${columns}`} aria-hidden><span>Сотрудник</span><span>Устройство · браузер</span><span>Последняя связь</span><span>Уведомления</span></div>
        {groupAccessRows(visible).map((group, groupIndex) => <section key={group[0].login} aria-label={group[0].name} className={groupIndex ? 'border-t-2 border-slate-200' : ''}>
          {group.map((row, index) => {
            const Icon = /iPhone|iPad|Android|Телефон|Планшет/.test(row.device) ? Smartphone : Monitor;
            const push = accessPushView(row, now);
            const StatusIcon = push.tone === 'ok' ? Check : push.tone === 'warning' ? BellOff : Clock3;
            return <article key={row.id} aria-label={`${row.name} · ${row.device} · ${row.browser}`} className={`grid gap-4 px-5 py-4 sm:grid-cols-2 lg:gap-5 ${columns} ${index ? 'border-t border-slate-100' : ''}`}>
              <div className={index ? 'hidden lg:block' : ''}>{index === 0 ? <><h2 className='text-sm font-bold text-slate-900'>{row.name}</h2><p className='mt-1 text-xs text-slate-500'>{row.login}</p></> : null}</div>
              <div className='flex items-start gap-3'><span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500'><Icon aria-hidden className='h-5 w-5' /></span><div><p className='text-sm font-semibold text-slate-800'>{row.device}</p><p className='mt-1 text-xs text-slate-500'>{row.browser}</p></div></div>
              <p className='text-sm font-semibold text-slate-800'><span className='lg:hidden'>Связь: </span>{accessWhen(row.lastSeenAt, now)}</p>
              <div><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${push.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : push.tone === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-600'}`}><StatusIcon aria-hidden className='h-3.5 w-3.5' />{push.label}</span>
                <p className='mt-1.5 text-[11px] leading-4 text-slate-500'>{row.pushCheckedAt ? `Проверено: ${accessWhen(row.pushCheckedAt, now)}` : 'Проверка не поступала'}</p>
              </div>
            </article>;
          })}
        </section>)}
        {!visible.length ? <p className='p-8 text-center text-sm text-slate-500'>{rows.length ? 'Совпадений нет. Измените поиск или отключите фильтр.' : 'Нет текущих сеансов. Прошлые входы доступны в истории.'}</p> : null}
      </div>}
      {history && (page > 1 || hasMore) ? <nav aria-label='Страницы истории' className='mt-4 flex items-center gap-4 text-sm'>{page > 1 ? <Link href={href(page - 1)} className='rounded-xl border bg-white px-4 py-3'>Назад</Link> : null}<span>Страница {page}</span>{hasMore ? <Link href={href(page + 1)} className='rounded-xl border bg-white px-4 py-3'>Далее</Link> : null}</nav> : null}
    </>}
    <p className='mt-3 text-xs leading-5 text-slate-500'>Время московское. «Связь» — последнее обращение браузера, не признак присутствия человека. Уведомления показаны на время проверки.</p>
    <details className='mt-2 text-xs text-slate-500'><summary className='cursor-pointer py-2'>Об устройствах и уведомлениях</summary><p className='max-w-3xl leading-relaxed'>Каждая строка — браузерный сеанс. Одинаковые названия не означают одно устройство; точная модель может быть недоступна, а iPad иногда определяется как Mac. Проверка уведомлений старше суток отмечается серым. Подключённая подписка не гарантирует доставку каждого уведомления. Список обновляется автоматически.</p></details>
  </section>;
}
