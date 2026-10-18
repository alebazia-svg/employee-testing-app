'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Monitor, Smartphone, Search, Check, BellOff, Clock3, X, Info, ChevronRight } from 'lucide-react';
import type { AccessJournalRow } from './PortalAccessJournal';
import { accessPushView, accessWhen, groupAccessRows, accessRecentConnections, accessAccountSummary, accessNotificationDetail, accessModeLabel, accessLastPushView, accessRecentPushFailure } from '../lib/portal-access-view';
import { startVisibleSync } from '../lib/visible-sync';
import { appUpdateStatus } from '../lib/portal-app-update-view';
import type { AppRelease } from '../lib/employee-app-update';

export type AccessDevicesProps = { rows: AccessJournalRow[]; query: string; history: boolean; page: number; hasMore: boolean; unavailable: boolean; nowIso: string; basePath?: string; currentRelease?: AppRelease | null; onRequestUpdate?: (id: string) => Promise<void>; renderDeviceExtra?: (row: AccessJournalRow) => React.ReactNode; renderDetailExtra?: (row: AccessJournalRow) => React.ReactNode; };

export function PortalAccessDevices(props: AccessDevicesProps) {
  const router = useRouter();
  useEffect(() => {
    let lastRefresh = Date.now();
    return startVisibleSync(() => { if (Date.now() - lastRefresh < 60000) return; lastRefresh = Date.now(); router.refresh(); }, 60000);
  }, [router]);
  async function requestUpdate(id: string) {
    const abort = new AbortController(); const timer = window.setTimeout(() => abort.abort(), 10000);
    try {
      const response = await fetch('/api/admin/employees/access/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: id }), signal: abort.signal });
      const result = await response.json();
      if (!response.ok) throw Error(typeof result.error === 'string' ? result.error : 'Не удалось подтвердить запрос.');
      router.refresh();
    } finally { window.clearTimeout(timer); }
  }
  return <PortalAccessDevicesView {...props} onRequestUpdate={requestUpdate} />;
}

function AppUpdateDetails({ row, now, currentRelease, onRequest }: { row: AccessJournalRow; now: Date; currentRelease?: AppRelease | null; onRequest?: (id: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState('');
  useEffect(() => { if (row.appUpdate?.command) setSent(false); }, [row.appUpdate?.command?.requestedAt]);
  const status = appUpdateStatus(row.appUpdate, currentRelease, now);
  async function request() {
    if (!onRequest || busy) return;
    setBusy(true); setError('');
    try { await onRequest(row.id); setSent(true); }
    catch (e) { setError(e instanceof Error && e.name !== 'AbortError' ? e.message : 'Ответ не получен. Обновите список перед повторным запросом.'); }
    finally { setBusy(false); }
  }
  return <section className='access-delivery-detail' aria-label='Версия приложения'>
    <h3>Версия приложения</h3>
    <div className='flex flex-wrap items-center justify-between gap-2'><strong>{row.appUpdate?.version ?? 'Не определена'}</strong><span className={`access-badge access-badge-${status.tone}`}>{sent && status.canRequest ? 'Запрос отправлен' : status.label}</span></div>
    <p>{sent && status.canRequest ? 'Ждём подтверждения от устройства. Работа сотрудника не прерывается.' : status.reason}</p>
    {row.appUpdate ? <p className='access-note'>Сообщено: {accessWhen(row.appUpdate.checkedAt, now)}{currentRelease ? ` · Актуальная версия: ${currentRelease.version}` : ''}</p> : null}
    {row.appUpdate?.command ? <p className='access-note'>Запрос: {accessWhen(row.appUpdate.command.requestedAt, now)}{row.appUpdate.command.completedAt ? ` · Новая версия подтверждена: ${accessWhen(row.appUpdate.command.completedAt, now)}` : row.appUpdate.command.receivedAt ? ' · Получен подключением' : ' · Ответ ещё не поступил'}</p> : null}
    {status.canRequest && onRequest ? <button className='access-secondary mt-3' disabled={busy || sent} onClick={request}>{busy ? 'Отправляем…' : sent ? 'Запрос отправлен' : 'Запросить обновление'}</button> : null}
    {error ? <p role='alert' className='access-send-warning'>{error}</p> : null}
  </section>;
}

function PushBadge({ row, now }: { row: AccessJournalRow; now: Date }) {
  const push = accessNotificationDetail(row, now);
  const Icon = push.tone === 'ok' ? Check : push.tone === 'warning' ? BellOff : Clock3;
  return <span className={`access-badge access-badge-${push.tone}`}><Icon size={14} aria-hidden />{push.label}</span>;
}

function ConnectionHelp({ row, now, onClose, extra }: { row: AccessJournalRow; now: Date; onClose: () => void; extra?: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const status = accessNotificationDetail(row, now);
  const lastPush = accessLastPushView(row.lastPush);
  return <dialog ref={dialog} className='access-dialog' onClose={onClose} aria-labelledby='access-detail-title' onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
    <div className='access-dialog-content'>
      <header><div><h2 id='access-detail-title'>{row.device} · {row.browser}</h2><p>{row.name} · {row.login}</p></div><button type='button' onClick={() => dialog.current?.close()} aria-label='Закрыть подробности'><X size={20} /></button></header>
      {extra}
      <PushBadge row={row} now={now} /><p className='access-help-main'>{status.explanation}</p>
      <dl className='access-facts'>
        <div><dt>Последняя связь с порталом</dt><dd>{accessWhen(row.lastSeenAt, now)}</dd></div>
        <div><dt>Проверка уведомлений</dt><dd>{row.pushCheckedAt ? accessWhen(row.pushCheckedAt, now) : 'Ещё не поступала'}</dd></div>
        {status.tone === 'unknown' ? <div><dt>Результат прежней проверки</dt><dd>{row.pushLabel}</dd></div> : null}
        {row.loginAt ? <div><dt>Последний вход в этом подключении</dt><dd>{accessWhen(row.loginAt, now)}</dd></div> : null}
        <div><dt>Последний способ открытия</dt><dd>{accessModeLabel(row.displayMode)}</dd></div>
        {row.contextCheckedAt ? <div><dt>Способ открытия проверен</dt><dd>{accessWhen(row.contextCheckedAt, now)}</dd></div> : null}
      </dl>
      <section className='access-delivery-detail' aria-label='Последняя отправка push'><h3>Последняя отправка на эту подписку</h3><strong>{lastPush.label}</strong>
        {row.lastPush ? <p className='access-note'>Попытка: {accessWhen(row.lastPush.attemptedAt, now)} · Результат: {accessWhen(row.lastPush.resultAt, now)}</p> : null}
        <p>{lastPush.explanation}</p>
      </section>
      <p className='access-note'>{!row.displayMode || row.displayMode === 'unknown' ? 'Способ открытия определится после обращения обновлённого портала. ' : ''}Точную модель телефона и системные настройки звука портал не определяет.</p>
      <footer><button type='button' onClick={() => dialog.current?.close()}>Понятно</button></footer>
    </div>
  </dialog>;
}

export function PortalAccessDevicesView({ rows, query, history, page, hasMore, unavailable, nowIso, basePath = '/admin/employees/access', renderDeviceExtra, renderDetailExtra, currentRelease, onRequestUpdate }: AccessDevicesProps) {
  const [search, setSearch] = useState(query);
  const [filter, setFilter] = useState<'all' | 'warning' | 'unknown' | 'updates'>('all');
  const [detail, setDetail] = useState<AccessJournalRow | null>(null);
  useEffect(() => { setSearch(query); setDetail(null); }, [query, history]);
  useEffect(() => { setDetail(previous => previous ? rows.find(row => row.id === previous.id) ?? null : null); }, [rows]);
  const now = new Date(nowIso);
  const connections = accessRecentConnections(rows, now);
  const needle = search.trim().toLocaleLowerCase('ru-RU');
  const groups = groupAccessRows(connections).filter(group => group.some(row => `${row.name} ${row.login} ${row.device} ${row.browser}`.toLocaleLowerCase('ru-RU').includes(needle)));
  const needsAttention = (row: AccessJournalRow) => accessPushView(row, now).tone === 'warning' || accessRecentPushFailure(row, now);
  const needsUpdate = (row: AccessJournalRow) => appUpdateStatus(row.appUpdate, currentRelease, now).needsUpdate;
  const visible = groups.filter(group => filter === 'all' || group.some(row => filter === 'updates' ? needsUpdate(row) : filter === 'warning' ? needsAttention(row) : accessPushView(row, now).tone === filter));
  const updates = groups.filter(group => group.some(needsUpdate)).length;
  const warning = groups.filter(group => group.some(needsAttention)).length;
  const unknown = groups.filter(group => group.some(row => accessPushView(row, now).tone === 'unknown')).length;
  const href = (next: number) => `${basePath}?${new URLSearchParams({ view: 'history', q: query, page: String(next) })}`;
  return <section aria-label={history ? 'История входов' : 'Устройства сотрудников'} className='access-screen mx-auto max-w-6xl'>
    <nav className='admin-section-tabs access-tabs' aria-label='Устройства и история'>
      <Link className={`admin-section-tab ${!history ? 'is-active' : ''}`} aria-current={!history ? 'page' : undefined} href={basePath}>Подключения сотрудников</Link>
      <Link className={`admin-section-tab ${history ? 'is-active' : ''}`} aria-current={history ? 'page' : undefined} href={`${basePath}?view=history`}>История входов</Link>
    </nav>
    {!history ? <div className='access-period'><strong>Последние 7 дней</strong><span>По последней связи с порталом. Более ранние подключения — в истории.</span></div> : null}
    <div className='access-toolbar'><form method='get' action={basePath} onSubmit={history ? undefined : e => e.preventDefault()}>
      {history ? <input type='hidden' name='view' value='history' /> : null}
      <label><Search size={17} aria-hidden /><span className='sr-only'>Поиск сотрудника или устройства</span><input name='q' value={search} maxLength={100} onChange={e => setSearch(e.target.value)} placeholder='Сотрудник, телефон или браузер' /></label>
      {history ? <button type='submit' className='access-secondary'>Найти</button> : null}
    </form>{!history && !unavailable ? <span className='access-note'>Сотрудников: {groups.length} · Подключений: {groups.reduce((n, g) => n + g.length, 0)}</span> : null}</div>
    {unavailable ? <p role='alert' className='access-unavailable'>Журнал временно недоступен. Это не означает, что сотрудники вышли из портала или отключили уведомления.</p> : <>
      {!history ? <>
        <label className='access-mobile-filter'><span className='sr-only'>Показать подключения</span><select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
          <option value='all'>Все сотрудники</option><option value='warning'>Проверить уведомления · {warning}</option><option value='unknown'>Нет свежих данных · {unknown}</option>
          {currentRelease ? <option value='updates'>Нужно обновить · {updates}</option> : null}
        </select></label>
        <div className='access-filters' aria-label='Фильтр подключений'>
          <button type='button' aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Все сотрудники</button>
          <button type='button' aria-pressed={filter === 'warning'} onClick={() => setFilter('warning')}>Проверить уведомления <span className={warning ? 'access-count-warning' : ''}>{warning}</span></button>
          <button type='button' aria-pressed={filter === 'unknown'} onClick={() => setFilter('unknown')}>Нет свежих данных <span>{unknown}</span></button>
          {currentRelease ? <button type='button' aria-pressed={filter === 'updates'} onClick={() => setFilter('updates')}>Нужно обновить <span className={updates ? 'access-count-warning' : ''}>{updates}</span></button> : null}
        </div>
        <p className='access-context'><Info size={16} aria-hidden />Уведомления подключаются отдельно в каждом кабинете и браузере. Давняя проверка не означает отключение.</p>
        <div className='access-accounts'>{visible.map(group => {
          const summary = accessAccountSummary(group, now);
          return <section className='access-account' key={group[0].login} aria-label={group[0].name}>
            <header className='access-account-header'><div><h2>{group[0].name}</h2><span>{group[0].login}{group[0].role === 'ADMIN' ? ' · Администратор' : ''}</span></div><p className={`access-account-summary access-summary-${summary.tone}`}>{summary.label}</p></header>
            <div className='access-column-head' aria-hidden><span>Устройство и браузер</span><span>Последняя связь</span><span>Уведомления</span><span /></div>
            {group.map(row => {
              const Icon = /iPhone|iPad|Android|Телефон|Планшет/.test(row.device) ? Smartphone : Monitor;
              const sameNames = group.filter(other => other.device === row.device && other.browser === row.browser)
                .sort((a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt) || a.id.localeCompare(b.id));
              const number = sameNames.findIndex(other => other.id === row.id) + 1;
              const push = accessNotificationDetail(row, now);
              return <article className='access-connection' key={row.id} aria-label={`${row.name} · ${row.device} · ${row.browser}${sameNames.length > 1 ? ` · подключение ${number}` : ''}`}>
                <div className='access-device'><span className='access-device-icon'><Icon size={20} aria-hidden /></span><div><h3>{row.device}<span> · {row.browser}</span></h3>{row.displayMode && row.displayMode !== 'unknown' ? <p>{accessModeLabel(row.displayMode)}{sameNames.length > 1 ? ` · Подключение ${number}` : ''}</p> : sameNames.length > 1 ? <p>Подключение {number}</p> : null}{row.appUpdate ? <div className='access-app-version'><p>Версия {row.appUpdate.version}</p><span className={`access-badge access-badge-${appUpdateStatus(row.appUpdate, currentRelease, now).tone}`}>{appUpdateStatus(row.appUpdate, currentRelease, now).label}</span></div> : null}{renderDeviceExtra?.(row)}</div></div>
                <div className='access-last-seen'><span className='access-mobile-label'>Связь</span><time dateTime={row.lastSeenAt}>{accessWhen(row.lastSeenAt, now)}</time></div>
                <div className='access-push'><PushBadge row={row} now={now} /><p className={accessRecentPushFailure(row, now) ? 'access-send-warning' : undefined}>{accessRecentPushFailure(row, now) ? 'Последняя отправка не подтверждена' : push.hint}</p></div>
                <button type='button' className='access-detail-button' onClick={() => setDetail(row)} aria-label={`Подробнее: ${row.name}, ${row.device}, ${row.browser}, подключение ${number}`}>Подробнее<ChevronRight size={14} aria-hidden /></button>
              </article>;
            })}
          </section>;
        })}{!visible.length ? <div className='access-empty'>{connections.length ? <><h2>Нет совпадений</h2><p>Измените поиск или выберите «Все сотрудники».</p><button type='button' className='access-secondary' onClick={() => { setFilter('all'); setSearch(''); }}>Сбросить фильтры</button></> : <><h2>Нет подключений за последние 7 дней</h2><p>Это не отключает уведомления. Прошлые подключения сохранены.</p><Link className='access-secondary' href={`${basePath}?view=history`}>Открыть историю</Link></>}</div> : null}</div>
      </> : <div className='access-history'>
        <div className='access-history-title'><h2>История входов и подключений</h2><p>Здесь остаются и старые подключения. Вход — авторизация; связь — последнее обращение портала. Записи не удаляются, подписки не отключаются.</p></div>
        <div className='access-history-head' aria-hidden><span>Сотрудник</span><span>Устройство</span><span>Вход</span><span>Выход</span></div>
        {rows.map(row => <article key={row.id} className='access-history-row'><div><h3>{row.name}</h3><p>{row.login}</p></div><div><p>{row.device} · {row.browser}</p><p className='access-note'>Связь: {accessWhen(row.lastSeenAt, now)}</p><button type='button' className='access-detail-button' onClick={() => setDetail(row)} aria-label={`Подробнее: ${row.name}, ${row.device}, ${row.browser}`}>Уведомления и подробности</button></div>
          <div><span className='access-mobile-label'>Вход</span>{row.loginAt ? accessWhen(row.loginAt, now) : 'Не зафиксирован'}</div>
          <div><span className='access-mobile-label'>Выход</span>{row.loggedOutAt ? accessWhen(row.loggedOutAt, now) : new Date(row.expiresAt) <= now ? 'Срок входа истёк' : 'Не зафиксирован'}</div>
        </article>)}{!rows.length ? <p className='access-empty'>{query ? 'Совпадений нет. Измените поиск.' : 'Записей пока нет.'}</p> : null}
      </div>}
      {history && (page > 1 || hasMore) ? <nav aria-label='Страницы истории' className='access-pagination'>{page > 1 ? <Link href={href(page - 1)}>Назад</Link> : null}<span>Страница {page}</span>{hasMore ? <Link href={href(page + 1)}>Далее</Link> : null}</nav> : null}
    </>}
    <p className='access-footnote'>Время московское. Последняя связь с порталом не означает, что сотрудник сейчас онлайн.</p>
    {detail ? <ConnectionHelp row={detail} now={now} extra={<>{currentRelease || detail.appUpdate ? <AppUpdateDetails key={detail.id} row={detail} now={now} currentRelease={currentRelease} onRequest={history ? undefined : onRequestUpdate} /> : null}{renderDetailExtra?.(detail)}</>} onClose={() => setDetail(null)} /> : null}
  </section>;
}
