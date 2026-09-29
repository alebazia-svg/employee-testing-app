import Link from 'next/link';
import React from 'react';

export type AccessJournalRow = {
  id: string; name: string; login: string; role: string; device: string; browser: string;
  firstSeenAt: string; loginAt: string | null; lastSeenAt: string; loggedOutAt: string | null; expiresAt: string;
  pushLabel: string; pushCheckedAt: string | null;
};
const when = (value: string) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export function PortalAccessJournal({ rows, query, page, hasMore, unavailable, now = new Date() }: {
  rows: AccessJournalRow[]; query: string; page: number; hasMore: boolean; unavailable: boolean; now?: Date;
}) {
  const href = (next: number) => `/admin/employees/access?${new URLSearchParams({ q: query, page: String(next) })}`;
  return <section aria-label='Журнал входов' className='mt-5 max-w-6xl space-y-4'>
    <form method='get' action='/admin/employees/access' className='flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4'>
      <label className='min-w-0 flex-1 text-sm font-semibold text-slate-700'>Сотрудник или логин
        <input name='q' defaultValue={query} maxLength={100} placeholder='Например, Астемир' className='mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3 font-normal' />
      </label>
      <button className='min-h-11 rounded-xl bg-[#263b5c] px-5 text-sm font-bold text-white'>Найти</button>
      {query ? <Link href='/admin/employees/access' className='inline-flex min-h-11 items-center px-3 text-sm text-slate-600'>Сбросить</Link> : null}
    </form>
    {unavailable ? <p role='alert' className='rounded-xl bg-amber-50 p-4 text-sm text-amber-900'>Журнал временно недоступен. Это не означает, что входов не было.</p> : <>
      <div className='hidden grid-cols-[1.1fr_1fr_1.4fr_1fr] gap-4 px-5 text-xs font-bold text-slate-500 lg:grid' aria-hidden='true'>
        <span>Учётная запись</span><span>Устройство и браузер</span><span>Вход и последнее обращение</span><span>Уведомления</span>
      </div>
      <div className='space-y-2'>
        {rows.map(row => <article key={row.id} aria-label={`${row.name} · ${row.device} · ${row.browser}`} className='grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1.4fr_1fr] lg:p-5'>
          <div className='min-w-0'><h2 className='break-words text-sm font-bold text-slate-950'>{row.name}</h2><p className='mt-1 break-words text-xs text-slate-500'>{row.login}{row.role === 'ADMIN' ? ' · Администратор' : ''}</p></div>
          <div><p className='text-sm font-semibold text-slate-800'>{row.device}</p><p className='mt-1 text-xs text-slate-500'>{row.browser}</p></div>
          <div className='text-xs text-slate-600'>
            <p>{row.loginAt ? `Вход: ${when(row.loginAt)}` : `Обнаружен: ${when(row.firstSeenAt)}`}</p>
            {!row.loginAt ? <p className='mt-1 text-slate-400'>Время входа не записано</p> : null}
            <p className='mt-1 font-semibold text-slate-800'>Последнее обращение: {when(row.lastSeenAt)}</p>
            {row.loggedOutAt ? <p className='mt-1 text-slate-500'>Выход: {when(row.loggedOutAt)}</p> : new Date(row.expiresAt) <= now ? <p className='mt-1 text-slate-500'>Срок входа истёк</p> : null}
          </div>
          <div><p className='mb-1 text-xs text-slate-500 lg:hidden'>Уведомления</p><p className={`text-sm font-semibold ${row.pushLabel === 'Подключены' ? 'text-emerald-800' : 'text-slate-600'}`}>{row.pushLabel}</p>
            {row.pushCheckedAt ? <p className='mt-1 text-xs text-slate-400'>Проверено {when(row.pushCheckedAt)}</p> : null}
          </div>
        </article>)}
        {!rows.length ? <div className='rounded-2xl border border-slate-200 bg-white p-8 text-center'><p className='font-semibold text-slate-800'>{query ? 'Совпадений нет' : 'Записей пока нет'}</p><p className='mt-2 text-sm text-slate-500'>{query ? 'Проверьте имя или сбросьте поиск.' : 'Журнал начнёт заполняться при входе или открытии портала. Прошлые входы не восстановлены.'}</p></div> : null}
      </div>
      {page > 1 || hasMore ? <nav aria-label='Страницы журнала' className='flex items-center gap-4 text-sm'>
        {page > 1 ? <Link href={href(page - 1)} className='rounded-xl border bg-white px-4 py-3'>Назад</Link> : null}
        <span>Страница {page}</span>{hasMore ? <Link href={href(page + 1)} className='rounded-xl border bg-white px-4 py-3'>Далее</Link> : null}
      </nav> : null}
    </>}
    <details className='text-xs text-slate-500'><summary className='cursor-pointer py-2'>Как читать журнал</summary>
      <p className='max-w-3xl leading-relaxed'>Каждая строка — отдельный браузерный сеанс учётной записи, а не доказательство, кто держал устройство. Новые подключения показаны первыми. Время — московское. Последнее обращение обновляется примерно раз в минуту, пока страница видна; это не время последнего действия человека. Названия устройств определяются по данным браузера: iPad иногда представляется как Mac. Уведомления проверяются для этого браузера и не подтверждают доставку каждого пуша. IP-адреса, геолокация и пароли в журнал не записываются.</p>
    </details>
  </section>;
}
