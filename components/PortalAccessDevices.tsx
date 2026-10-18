'use client';
import React, { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Monitor, Smartphone, Search, Check, BellOff, Clock3, X, ChevronRight } from 'lucide-react';
import type { AccessJournalRow } from './PortalAccessJournal';
import { accessPushView, accessWhen, groupAccessRows, accessLatestVisits, accessOverviewRows, groupServiceConnections, accessNotificationDetail, accessModeLabel, accessLastPushView, accessRecentPushFailure, accessIsAdministrative, accessSystemLabel } from '../lib/portal-access-view';
import { startVisibleSync } from '../lib/visible-sync';
import { appUpdateStatus } from '../lib/portal-app-update-view';
import type { AppRelease } from '../lib/employee-app-update';
import { accessConnectionCode } from '../lib/portal-access-identity';

export type AccessDevicesProps = { rows: AccessJournalRow[]; query: string; history: boolean; service?: boolean; page: number; hasMore: boolean; unavailable: boolean; nowIso: string; basePath?: string; currentRelease?: AppRelease | null; onRefresh?: () => void; refreshing?: boolean; onRequestUpdate?: (id: string) => Promise<void>; onSetService?: (id: string, value: boolean) => Promise<void>; onSetOwner?: (id: string, value: boolean, label?: string) => Promise<void>; renderDeviceExtra?: (row: AccessJournalRow) => React.ReactNode; renderDetailExtra?: (row: AccessJournalRow) => React.ReactNode; presentation?: 'observed-snapshot'; };

export function PortalAccessDevices(props: AccessDevicesProps) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  useEffect(() => {
    if (props.history) return;
    let lastRefresh = Date.now();
    return startVisibleSync(() => { if (Date.now() - lastRefresh < 5000) return; lastRefresh = Date.now(); startRefresh(() => router.refresh()); }, 15000);
  }, [router, props.history]);
  async function requestUpdate(id: string) {
    const abort = new AbortController(); const timer = window.setTimeout(() => abort.abort(), 10000);
    try {
      const response = await fetch('/api/admin/employees/access/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: id }), signal: abort.signal });
      const result = await response.json();
      if (!response.ok) throw Error(typeof result.error === 'string' ? result.error : 'Не удалось подтвердить запрос.');
      router.refresh();
    } finally { window.clearTimeout(timer); }
  }
  async function setService(id: string, isService: boolean) {
    const abort = new AbortController(); const timer = window.setTimeout(() => abort.abort(), 10000);
    try {
      const response = await fetch('/api/admin/employees/access/service', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: id, isService }), signal: abort.signal });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Не удалось сохранить отметку.');
      router.refresh();
    } finally { window.clearTimeout(timer); }
  }
  async function setOwner(id: string, owned: boolean, label?: string) {
    const abort = new AbortController(); const timer = window.setTimeout(() => abort.abort(), 10000);
    try {
      const response = await fetch('/api/admin/employees/access/owner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: id, owned, ...(label !== undefined ? { label } : {}) }), signal: abort.signal });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Не удалось сохранить отметку.');
      router.refresh();
    } finally { window.clearTimeout(timer); }
  }
  return <PortalAccessDevicesView {...props} onRefresh={() => startRefresh(() => router.refresh())} refreshing={refreshing} onRequestUpdate={requestUpdate} onSetService={setService} onSetOwner={setOwner} />;
}

function OwnerClassification({ row, onSave, onDone }: { row: AccessJournalRow; onSave: NonNullable<AccessDevicesProps['onSetOwner']>; onDone: () => void }) {
  const [confirm, setConfirm] = useState<'save' | 'remove' | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [label, setLabel] = useState(row.connectionLabel ?? '');
  return <section className='access-delivery-detail'><h3>Название подключения</h3>
    <p>{row.isCurrentBrowser ? `Введите название с именем владельца, например «${row.device === 'iPhone' ? 'iPhone' : 'Mac'} Бэлы». Оно будет одинаковым во всех кабинетах.` : 'Укажите подтверждённое название, например «Mac Бэлы» или «Служебный браузер Codex». Все администраторы увидят одно и то же название.'}</p>
    <p className='access-note'>{row.isCurrentBrowser ? 'Вы подтверждаете только подключение, из которого открыт этот экран.' : 'Это другое подключение. Назначайте владельца только если он подтверждён: одинаковое название Mac или IP не доказывает принадлежность.'} Safari и приложение с домашнего экрана могут потребовать отдельного подтверждения. После очистки данных браузера отметку может понадобиться установить заново.</p>
    {!row.browserInstanceId ? <p>Для старой записи идентификатор не сохранён. При следующем открытии обновлённого портала в этом браузере под любым кабинетом появится подключение, которое можно назначить владельцу.</p> : <>
      <label className='access-name-field'>Название устройства или служебного браузера<input maxLength={80} value={label} onChange={e => setLabel(e.target.value)} placeholder={row.device === 'iPhone' ? 'Например, iPhone Бэлы' : 'Например, Mac Бэлы'} disabled={busy} /></label>
      {confirm ? <><p>{confirm === 'remove' ? 'Убрать название и назначение владельца? Если браузер использовался под администратором, он останется в проверках; общий рабочий компьютер можно вернуть сотруднику отдельно.' : `Подтвердить «${label.trim()}» как устройство администратора? Его входы под сотрудниками перейдут в «Администраторы и проверки». Доступ и подписки не изменятся.`}</p><div className='flex flex-wrap gap-2 mt-3'><button className='access-secondary' disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await onSave(row.id, confirm !== 'remove', confirm === 'remove' ? '' : label.trim()); onDone(); } catch { setError('Сохранение не подтверждено. Обновите список перед повтором.'); } finally { setBusy(false); } }}>{busy ? 'Сохраняем…' : 'Подтвердить'}</button><button className='access-secondary' disabled={busy} onClick={() => setConfirm(null)}>Отмена</button></div></> : <div className='flex flex-wrap gap-2 mt-3'><button className='access-secondary' disabled={!label.trim()} onClick={() => setConfirm('save')}>Назвать и отделить проверки</button>{row.ownerBrowser || row.ownerInspection ? <button className='access-secondary' onClick={() => setConfirm('remove')}>Убрать отметку</button> : null}</div>}
    </>}
    {error ? <p role='alert'>{error}</p> : null}
  </section>;
}

function CurrentConnectionNaming({ row, onSave, onDone, onClose }: { row: AccessJournalRow; onSave: NonNullable<AccessDevicesProps['onSetOwner']>; onDone: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    return () => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={dialog} className='access-dialog' onClose={onClose} aria-labelledby='access-name-title'>
    <div className='access-dialog-content'>
      <header><div><h2 id='access-name-title'>Назвать это устройство</h2><p>{row.device} · {row.browser} · {accessModeLabel(row.displayMode)}</p></div><button type='button' onClick={() => dialog.current?.close()} aria-label='Закрыть название устройства'><X size={20} /></button></header>
      <p className='access-current-marker'>Это подключение · кабинет {row.name}</p>
      <OwnerClassification row={row} onSave={onSave} onDone={onDone} />
    </div>
  </dialog>;
}

function ServiceClassification({ row, onSave, onDone }: { row: AccessJournalRow; onSave: NonNullable<AccessDevicesProps['onSetService']>; onDone: () => void }) {
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const administrative = accessIsAdministrative(row);
  return <section className='access-delivery-detail'>
    <h3>Назначение подключения</h3>
    <p>{row.adminObserved ? 'Этот же браузер использовался под администратором. Если это общий компьютер, с которого сотрудник действительно работает, подтвердите рабочее назначение для его кабинета.' : 'Отмечайте служебными подключения для проверки чужих кабинетов. Рабочее устройство сотрудника должно оставаться в основном списке.'}</p>
    {confirm ? <><p>{administrative ? 'Показывать это подключение как рабочее устройство сотрудника?' : 'Убрать это подключение из рабочего списка и его предупреждений?'} История, доступ и подписки сохранятся.</p><div className='flex flex-wrap gap-2 mt-3'><button className='access-secondary' disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await onSave(row.id, !administrative); onDone(); } catch { setError('Сохранение не подтверждено. Обновите список перед повтором.'); } finally { setBusy(false); } }}>{busy ? 'Сохраняем…' : 'Подтвердить'}</button><button className='access-secondary' disabled={busy} onClick={() => setConfirm(false)}>Отмена</button></div></> : <button className='access-secondary mt-3' onClick={() => setConfirm(true)}>{administrative ? 'Это рабочее подключение сотрудника' : 'Отметить как служебное'}</button>}
    {error ? <p role='alert'>{error}</p> : null}
  </section>;
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
  return <span className={`access-badge access-badge-${accessIsAdministrative(row) && push.tone !== 'ok' ? 'unknown' : push.tone}`}><Icon size={14} aria-hidden />{push.label}</span>;
}

function ConnectionHelp({ row, now, onClose, extra, settings, snapshot }: { row: AccessJournalRow; now: Date; onClose: () => void; extra?: React.ReactNode; settings?: React.ReactNode; snapshot?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    return () => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, []);
  const status = accessNotificationDetail(row, now);
  const lastPush = accessLastPushView(row.lastPush);
  return <dialog ref={dialog} className='access-dialog' onClose={onClose} aria-labelledby='access-detail-title' onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
    <div className='access-dialog-content'>
      <header><div><h2 id='access-detail-title'>{row.connectionLabel || row.device} · {row.browser}</h2><p>Кабинет: {row.name} · {row.login}</p></div><button type='button' onClick={() => dialog.current?.close()} aria-label='Закрыть подробности'><X size={20} /></button></header>
      {row.isCurrentBrowser ? <p className='access-current-marker'>Этот браузер · из него открыт экран</p> : null}
      {row.unidentifiedCount ? <p className='access-note'>Показано последнее из {row.unidentifiedCount} похожих подключений. Старые записи не позволяют определить, одно это устройство или несколько. Все события сохранены в истории; служебная отметка относится только к показанному подключению.</p> : null}
      <PushBadge row={row} now={now} /><p className='access-help-main'>{status.explanation}</p>
      {row.connectionLabel ? <p className='access-note'>Название подтверждено администратором · {row.device}. Оно не определяет, кто именно пользовался устройством.</p> : row.role === 'ADMIN' || row.adminObserved ? <p className='access-note'>Владелец не подтверждён. Аккаунт администратора сам по себе не определяет человека.</p> : null}
      {row.adminObserved && row.role !== 'ADMIN' ? <p className='access-note'>Этот же идентификатор браузера замечен под администратором. Это подтверждает использование разных кабинетов, но не личность человека.</p> : null}
      {extra}
      <dl className='access-facts'>
        <div><dt>Устройство</dt><dd>{row.device}</dd></div>
        <div><dt>Система</dt><dd>{accessSystemLabel(row.device) ?? 'Не определена'}</dd></div>
        <div><dt>Браузер</dt><dd>{row.browser}</dd></div>
        <div><dt>Последнее обращение к порталу</dt><dd>{accessWhen(row.lastSeenAt, now)}</dd></div>
        {row.loginAt ? <div><dt>Последняя авторизация</dt><dd>{accessWhen(row.loginAt, now)}</dd></div> : null}
        <div><dt>Способ открытия</dt><dd>{accessModeLabel(row.displayMode)}</dd></div>
      </dl>
      <details className='access-connection-settings'><summary>Технические сведения и доставка уведомлений</summary>
      <dl className='access-facts'>
        <div><dt>Проверка уведомлений</dt><dd>{row.pushCheckedAt ? accessWhen(row.pushCheckedAt, now) : 'Ещё не поступала'}</dd></div>
        {status.tone === 'unknown' ? <div><dt>Результат прежней проверки</dt><dd>{row.pushLabel}</dd></div> : null}
        {row.contextCheckedAt ? <div><dt>Способ открытия проверен</dt><dd>{accessWhen(row.contextCheckedAt, now)}</dd></div> : null}
        {!snapshot ? <div><dt>IP последнего подключения</dt><dd>{row.lastIp ?? 'Ещё не записан'}</dd></div> : null}
        {row.ipCheckedAt ? <div><dt>IP проверен</dt><dd>{accessWhen(row.ipCheckedAt, now)}</dd></div> : null}
        {!snapshot ? <div><dt>Различение подключений</dt><dd>{row.browserInstanceId ? 'Постоянный идентификатор браузера / приложения' : 'Старая запись без идентификатора'}</dd></div> : null}
      </dl>
      <section className='access-delivery-detail' aria-label='Последняя отправка push'><h3>Последняя отправка на эту подписку</h3><strong>{lastPush.label}</strong>
        {row.lastPush ? <p className='access-note'>Попытка: {accessWhen(row.lastPush.attemptedAt, now)} · Результат: {accessWhen(row.lastPush.resultAt, now)}</p> : null}
        <p>{lastPush.explanation}</p>
      </section>
      <p className='access-note'>IP обозначает сеть и может совпадать у разных людей. По нему устройства не объединяются. Точная модель телефона доступна не во всех браузерах.</p>
      {!snapshot && accessConnectionCode(row.browserInstanceId) ? <div className='access-delivery-detail'><h3>Код подключения</h3><code className='block break-all select-all'>{accessConnectionCode(row.browserInstanceId)}</code><p>Для точной сверки откройте /connection в проверяемом браузере. Совпадение кода не подтверждает владельца.</p></div> : null}
      </details>
      {settings ? <details className='access-connection-settings' open={row.isCurrentBrowser && row.canMarkOwner && !row.connectionLabel || undefined}><summary>Название и назначение</summary>{settings}</details> : null}
      <footer><button type='button' onClick={() => dialog.current?.close()}>Понятно</button></footer>
    </div>
  </dialog>;
}

export function PortalAccessDevicesView({ rows, query, history, service = false, page, hasMore, unavailable, nowIso, basePath = '/admin/employees/access', renderDeviceExtra, renderDetailExtra, currentRelease, onRequestUpdate, onSetService, onSetOwner, onRefresh, refreshing, presentation }: AccessDevicesProps) {
  const [search, setSearch] = useState(query);
  const [filter, setFilter] = useState<'all' | 'warning' | 'unknown' | 'updates'>('all');
  const [detail, setDetail] = useState<AccessJournalRow | null>(null);
  const [namingCurrent, setNamingCurrent] = useState(false);
  const [notice, setNotice] = useState('');
  const saved = (message: string) => { setDetail(null); setNamingCurrent(false); setNotice(message); };
  useEffect(() => { setSearch(query); setDetail(null); setFilter('all'); setNotice(''); }, [query, history, service]);
  const snapshot = presentation === 'observed-snapshot';
  useEffect(() => { setDetail(previous => previous ? (history || snapshot ? rows : accessLatestVisits(rows)).find(row => row.id === previous.id) ?? null : null); }, [rows, history, snapshot]);
  const now = new Date(nowIso);
  const currentConnection = accessLatestVisits(rows).find(row => row.isCurrentBrowser && row.role === 'ADMIN' && row.canMarkOwner);
  // A UI snapshot already contains grouped rows and deliberately omits private IDs.
  // Do not invent identifiers or regroup those displayed records by their names.
  const candidates = (snapshot ? rows : accessLatestVisits(rows)).filter(row => accessIsAdministrative(row) === service);
  const connections = snapshot ? candidates : accessOverviewRows(candidates);
  const archivedCount = candidates.length - connections.length;
  const needle = search.trim().toLocaleLowerCase('ru-RU');
  const groups = (service ? groupServiceConnections(connections) : groupAccessRows(connections)).filter(group => group.some(row => `${row.name} ${row.login} ${row.device} ${accessSystemLabel(row.device) ?? ''} ${row.browser} ${row.connectionLabel ?? ''}`.toLocaleLowerCase('ru-RU').includes(needle)));
  const needsAttention = (row: AccessJournalRow) => accessPushView(row, now).tone === 'warning';
  const needsUpdate = (row: AccessJournalRow) => appUpdateStatus(row.appUpdate, currentRelease, now).needsUpdate;
  const needsData = (row: AccessJournalRow) => accessPushView(row, now).tone === 'unknown' || Boolean(currentRelease && (!row.appUpdate || (!needsUpdate(row) && appUpdateStatus(row.appUpdate, currentRelease, now).tone === 'unknown')));
  const visible = groups.filter(group => filter === 'all' || group.some(row => filter === 'updates' ? needsUpdate(row) : filter === 'warning' ? needsAttention(row) : needsData(row)));
  const updates = groups.filter(group => group.some(needsUpdate)).length;
  const warning = groups.filter(group => group.some(needsAttention)).length;
  const unknown = groups.filter(group => group.some(needsData)).length;
  const href = (next: number) => `${basePath}?${new URLSearchParams({ view: 'history', q: query, page: String(next) })}`;
  return <section aria-label={history ? 'История входов' : 'Устройства сотрудников'} className='access-screen mx-auto max-w-6xl'>
    <nav className='admin-section-tabs access-tabs' aria-label='Устройства и история'>
      <Link className={`admin-section-tab ${!history && !service ? 'is-active' : ''}`} aria-current={!history && !service ? 'page' : undefined} href={basePath}>Сотрудники</Link>
      <Link className={`admin-section-tab ${service ? 'is-active' : ''}`} aria-current={service ? 'page' : undefined} href={`${basePath}?view=service`}>Администраторы и проверки</Link>
      <Link className={`admin-section-tab ${history ? 'is-active' : ''}`} aria-current={history ? 'page' : undefined} href={`${basePath}?view=history`}>История входов</Link>
    </nav>
    {!snapshot && !history && !unavailable ? <div className='access-current-connection'>
      {currentConnection ? <><div><strong>Этот браузер · {currentConnection.connectionLabel || `${currentConnection.device} · ${currentConnection.browser}`}</strong>{!currentConnection.connectionLabel ? <p>Назовите его, чтобы отделить свои проверки.</p> : null}</div><button className='access-secondary' type='button' onClick={() => onSetOwner ? setNamingCurrent(true) : setDetail(currentConnection)}>{onSetOwner ? currentConnection.connectionLabel ? 'Изменить название' : 'Назвать это устройство' : 'Подробности подключения'}</button></> : <div><strong>Текущий браузер пока не сопоставлен</strong></div>}
    </div> : null}
    {notice ? <div role='status' className='access-saved'><Check size={17} aria-hidden /><span>{notice}</span><button type='button' aria-label='Скрыть подтверждение' onClick={() => setNotice('')}><X size={17} /></button></div> : null}
    {!history && service ? <p className='access-period'>Каждое подключение — один блок. Ниже видно, какие кабинеты из него открывали.</p> : null}
    <div className='access-toolbar'><form method='get' action={basePath} onSubmit={history ? undefined : e => e.preventDefault()}>
      {history ? <input type='hidden' name='view' value='history' /> : null}
      <label><Search size={17} aria-hidden /><span className='sr-only'>Поиск сотрудника или устройства</span><input name='q' value={search} maxLength={100} onChange={e => setSearch(e.target.value)} placeholder='Сотрудник, телефон или браузер' /></label>
      {history ? <button type='submit' className='access-secondary'>Найти</button> : null}
    </form>{!history && !unavailable ? <span className='access-note'>{service ? 'Подключений' : 'Сотрудников'}: {groups.length}</span> : null}{onRefresh ? <button className='access-secondary' title={`Сведения: ${accessWhen(nowIso, now)}. Обновляются автоматически.`} disabled={refreshing} onClick={onRefresh}>{refreshing ? 'Обновляем…' : 'Обновить'}</button> : null}</div>
    {unavailable ? <p role='alert' className='access-unavailable'>Журнал временно недоступен. Это не означает, что сотрудники вышли из портала или отключили уведомления.</p> : <>
      {!history ? <>
        {!service ? <>
        <label className='access-mobile-filter'><span className='sr-only'>Показать подключения</span><select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
          <option value='all'>Все сотрудники</option><option value='warning'>Не подключены · {warning}</option><option value='unknown'>Нет свежих данных · {unknown}</option>
          {currentRelease ? <option value='updates'>Нужно обновить · {updates}</option> : null}
        </select></label>
        <div className='access-filters' aria-label='Фильтр подключений'>
          <button type='button' aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Все сотрудники</button>
          <button type='button' aria-pressed={filter === 'warning'} onClick={() => setFilter('warning')}>Не подключены <span className={warning ? 'access-count-warning' : ''}>{warning}</span></button>
          <button type='button' aria-pressed={filter === 'unknown'} onClick={() => setFilter('unknown')}>Нет свежих данных <span>{unknown}</span></button>
          {currentRelease ? <button type='button' aria-pressed={filter === 'updates'} onClick={() => setFilter('updates')}>Нужно обновить <span className={updates ? 'access-count-warning' : ''}>{updates}</span></button> : null}
        </div>
        </> : null}
        <div className='access-accounts'>{visible.map(group => {
          return <section className='access-account' key={service ? group[0].browserInstanceId || group[0].id : group[0].login} aria-label={service ? group[0].connectionLabel || `${group[0].device} · ${group[0].browser}` : group[0].name}>
            <header className='access-account-header'><h2>{service ? group[0].connectionLabel || `${group[0].device} · ${group[0].browser}` : group[0].name}</h2><span>{service ? group[0].connectionLabel ? `${group[0].browser} · Администраторские проверки` : 'Владелец не подтверждён' : `Подключений: ${group.length}`}</span></header>
            <div className='access-column-head' aria-hidden><span>{service ? 'Кабинет' : 'Устройство'}</span><span>Был в портале</span><span>Уведомления</span><span>Версия портала</span><span /></div>
            {group.map(row => {
              const Icon = /iPhone|iPad|Android|Телефон|Планшет/.test(row.device) ? Smartphone : Monitor;
              const sameNames = group.filter(other => other.device === row.device && other.browser === row.browser)
                .sort((a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt) || a.id.localeCompare(b.id));
              const number = sameNames.findIndex(other => other.id === row.id) + 1;
              const push = accessNotificationDetail(row, now);
              const version = appUpdateStatus(row.appUpdate, currentRelease, now);
              return <article className='access-connection' key={row.id} aria-label={`${row.name} · ${row.device} · ${row.browser}${sameNames.length > 1 ? ` · подключение ${number}` : ''}`}>
                <div className='access-device'><span className='access-device-icon'><Icon size={20} aria-hidden /></span><div><h3>{service ? row.name : row.connectionLabel || row.device}{!service ? <span> · {row.browser}</span> : null}</h3><p>{[accessSystemLabel(row.device), row.displayMode && row.displayMode !== 'unknown' ? accessModeLabel(row.displayMode) : null, !service && sameNames.length > 1 ? `Подключение ${number}` : null].filter(Boolean).join(' · ')}</p>{!snapshot && !row.browserInstanceId ? <p>Последние известные сведения</p> : null}{renderDeviceExtra?.(row)}</div></div>
                <div className='access-last-seen'>{row.isCurrentBrowser ? <span className='access-current-marker'>Этот браузер</span> : null}<span className='access-mobile-label'>Был в портале</span><time dateTime={row.lastSeenAt}>{accessWhen(row.lastSeenAt, now)}</time></div>
                <div className='access-push'><PushBadge row={row} now={now} />{!service && (accessRecentPushFailure(row, now) || push.tone === 'warning') ? <p className='access-send-warning'>{accessRecentPushFailure(row, now) ? 'Последняя отправка не подтверждена' : push.hint}</p> : null}</div>
                <div className='access-version'><span className='access-mobile-label'>Версия портала</span>{row.appUpdate ? <><strong>{row.appUpdate.version}</strong><span className={`access-version-state access-summary-${version.tone}`}>{version.label}</span></> : <span className='access-note'>Нет данных</span>}</div>
                <button type='button' className='access-detail-button' onClick={() => setDetail(row)} aria-label={`Подробнее: ${row.name}, ${row.device}, ${row.browser}, подключение ${number}`}>Подробнее<ChevronRight size={14} aria-hidden /></button>
              </article>;
            })}
          </section>;
        })}{!visible.length ? <div className='access-empty'>{connections.length ? <><h2>Нет совпадений</h2><p>Измените поиск или выберите «Все сотрудники».</p><button type='button' className='access-secondary' onClick={() => { setFilter('all'); setSearch(''); }}>Сбросить фильтры</button></> : <><h2>{service ? 'Администраторских подключений пока нет' : 'Посещений пока нет'}</h2><p>{service ? 'Здесь появятся подключения администраторов и отмеченные проверки.' : 'Записи появятся после открытия портала сотрудниками.'}</p></>}</div> : null}</div>
        {archivedCount > 0 ? <p className='access-note mt-3'>Предыдущие записи ({archivedCount}) сохранены в <Link className='underline' href={`${basePath}?view=history`}>истории входов</Link>.</p> : null}
      </> : <div className='access-history'>
        <div className='access-history-title'><h2>История входов и подключений</h2><p>Здесь остаются и старые подключения. Вход — авторизация; связь — последнее обращение портала. Записи не удаляются, подписки не отключаются.</p></div>
        <div className='access-history-head' aria-hidden><span>Сотрудник</span><span>Устройство</span><span>Вход</span><span>Выход</span></div>
        {rows.map(row => <article key={row.id} className='access-history-row'><div><h3>{row.name}</h3><p>{row.login}{row.isService ? ' · Служебное' : ''}</p></div><div><p>{row.connectionLabel || row.device} · {row.browser}</p>{accessSystemLabel(row.device) ? <p className='access-note'>{accessSystemLabel(row.device)}</p> : null}<p className='access-note'>Связь: {accessWhen(row.lastSeenAt, now)}</p><button type='button' className='access-detail-button' onClick={() => setDetail(row)} aria-label={`Подробнее: ${row.name}, ${row.device}, ${row.browser}`}>Уведомления и подробности</button></div>
          <div><span className='access-mobile-label'>Вход</span>{row.loginAt ? accessWhen(row.loginAt, now) : 'Не зафиксирован'}</div>
          <div><span className='access-mobile-label'>Выход</span>{row.loggedOutAt ? accessWhen(row.loggedOutAt, now) : new Date(row.expiresAt) <= now ? 'Срок входа истёк' : 'Не зафиксирован'}</div>
        </article>)}{!rows.length ? <p className='access-empty'>{query ? 'Совпадений нет. Измените поиск.' : 'Записей пока нет.'}</p> : null}
      </div>}
      {history && (page > 1 || hasMore) ? <nav aria-label='Страницы истории' className='access-pagination'>{page > 1 ? <Link href={href(page - 1)}>Назад</Link> : null}<span>Страница {page}</span>{hasMore ? <Link href={href(page + 1)}>Далее</Link> : null}</nav> : null}
    </>}
    <p className='access-footnote'>Время московское. «Был в портале» — последнее обращение приложения или вкладки, в том числе автоматическое. Это не означает, что сотрудник сейчас онлайн.</p>
    {namingCurrent && currentConnection && onSetOwner ? <CurrentConnectionNaming row={currentConnection} onSave={onSetOwner} onClose={() => setNamingCurrent(false)} onDone={() => saved('Название сохранено. Входы из этого подключения под сотрудниками отделены. Доступ и уведомления не изменены.')} /> : null}
    {detail ? <ConnectionHelp row={detail} now={now} snapshot={snapshot}
      extra={<>
        {currentRelease || detail.appUpdate ? <AppUpdateDetails key={detail.id} row={detail} now={now} currentRelease={currentRelease} onRequest={history || detail.loggedOutAt || Date.parse(detail.expiresAt) <= now.getTime() ? undefined : onRequestUpdate} /> : null}
        {renderDetailExtra?.(detail)}
      </>}
      settings={detail.ownerInspection || (detail.canMarkOwner && onSetOwner) || (onSetService && !detail.ownerBrowser) ? <>
        {detail.ownerInspection && !detail.canMarkOwner ? <section className='access-delivery-detail'><h3>Проверка с администраторского подключения</h3><p>Назначение подтверждено другим администратором. Изменение доступно из его учётной записи.</p></section> : null}
        {detail.canMarkOwner && onSetOwner ? <OwnerClassification key={`owner-${detail.id}`} row={detail} onSave={onSetOwner} onDone={() => saved('Название и назначение сохранены. Список обновляется. Подписки не изменены.')} /> : null}
        {onSetService && detail.role !== 'ADMIN' && !detail.ownerInspection && !detail.ownerBrowser ? <ServiceClassification key={`service-${detail.id}`} row={detail} onSave={onSetService} onDone={() => saved(accessIsAdministrative(detail) ? 'Подключение возвращено в рабочий список.' : 'Подключение перенесено в проверки. Подписки не изменены.')} /> : null}
      </> : undefined}
      onClose={() => setDetail(null)} /> : null}
  </section>;
}
