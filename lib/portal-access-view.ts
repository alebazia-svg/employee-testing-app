import type { AccessJournalRow } from '../components/PortalAccessJournal';

/** Coarse OS family only. A saved device label cannot prove an OS version,
 * hardware model, owner, or whether an ambiguous desktop Safari was an iPad. */
export function accessSystemLabel(device: string): string | null {
  if (device === 'Mac') return 'macOS';
  if (device === 'Mac / iPad') return 'macOS / iPadOS · не уточнено';
  if (device === 'iPhone') return 'iOS';
  if (device === 'iPad') return 'iPadOS';
  if (device === 'Компьютер Windows') return 'Windows';
  if (device === 'Телефон Android' || device === 'Планшет Android') return 'Android';
  if (device === 'Компьютер Linux') return 'Linux';
  if (device === 'Chromebook') return 'ChromeOS';
  return null;
}

export function accessOwnerView(ownerId: number | undefined, sessionUserId: number, viewerId: number) {
  return { ownerInspection: ownerId !== undefined && ownerId !== sessionUserId, ownerBrowser: ownerId === sessionUserId, canMarkOwner: ownerId === undefined || ownerId === viewerId };
}

/** Shared browser identity is evidence of cross-account use, not of a person.
 * An explicit per-account working classification overrides that inference. */
export function accessIsAdministrative(row: Pick<AccessJournalRow, 'role' | 'isService' | 'ownerInspection' | 'adminObserved' | 'serviceMarkedAt'>) {
  return row.role === 'ADMIN' || Boolean(row.isService || row.ownerInspection || (row.adminObserved && !row.serviceMarkedAt));
}


export function accessModeLabel(mode?: string | null) {
  return mode === 'app' ? 'Приложение' : mode === 'browser' ? 'Вкладка браузера' : 'Не определён';
}

export function accessLastPushForUser(sub: { userId: number; lastPushUserId: number | null; lastPushAttemptAt: Date | null; lastPushResultAt: Date | null; lastPushOutcome: string | null; lastPushErrorCode: string | null } | null, userId: number): AccessJournalRow['lastPush'] {
  if (!sub || sub.userId !== userId || sub.lastPushUserId !== userId || !sub.lastPushAttemptAt || !sub.lastPushResultAt || !sub.lastPushOutcome) return null;
  return { attemptedAt: sub.lastPushAttemptAt.toISOString(), resultAt: sub.lastPushResultAt.toISOString(), outcome: sub.lastPushOutcome, errorCode: sub.lastPushErrorCode };
}

export function accessLastPushView(push: AccessJournalRow['lastPush']) {
  if (!push) return { label: 'Нет сохранённого результата', explanation: 'Результат появится после новой отправки на эту подписку. Это не означает, что раньше уведомлений не было.' };
  if (push.outcome === 'accepted') return { label: 'Принято сервисом доставки', explanation: 'Сервис принял уведомление для этой подписки. Показ на устройстве, прочтение и звук этим не подтверждаются.' };
  if (push.errorCode === 'HTTP_404' || push.errorCode === 'HTTP_410') return { label: 'Подписка больше не действует', explanation: 'Сервис отклонил отправку: подписка истекла или удалена. Нужно заново подключить уведомления на этом устройстве.' };
  if (push.errorCode === 'HTTP_429') return { label: 'Сервис временно ограничил отправку', explanation: 'Попытка отклонена сервисом доставки. Это не запрет уведомлений на телефоне.' };
  if (push.outcome === 'rejected') return { label: 'Сервис отклонил отправку', explanation: 'Сбой отправки на стороне сервиса или настройки портала. Не нужно менять разрешения телефона только из-за этой ошибки.' };
  if (push.outcome === 'failed') return { label: 'Нет подтверждения от сервиса', explanation: 'При отправке произошла ошибка связи. Доставка не подтверждена; это не доказывает отключение уведомлений.' };
  return { label: 'Результат не определён', explanation: 'Сохранённые сведения не позволяют подтвердить результат отправки.' };
}

export function accessRecentPushFailure(row: AccessJournalRow, now: Date) {
  if (!row.lastPush || !['rejected', 'failed'].includes(row.lastPush.outcome)) return false;
  const age = now.getTime() - Date.parse(row.lastPush.resultAt);
  return age >= -300000 && age <= 86400000;
}


const dayKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export function accessWhen(value: string, now: Date) {
  const date = new Date(value);
  const time = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }).format(date);
  if (dayKey(date) === dayKey(now)) return `Сегодня, ${time}`;
  if (dayKey(date) === dayKey(new Date(now.getTime() - 86400000))) return `Вчера, ${time}`;
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}
export function accessPushView(row: AccessJournalRow, now: Date) {
  const checked = row.pushCheckedAt ? Date.parse(row.pushCheckedAt) : NaN;
  const fresh = Number.isFinite(checked) && checked <= now.getTime() + 300000 && now.getTime() - checked <= 86400000;
  if (!fresh || row.pushLabel === 'Не проверены') return { label: 'Нет свежей проверки', tone: 'unknown' as const };
  return { label: row.pushLabel, tone: row.pushLabel === 'Подключены' ? 'ok' as const : 'warning' as const };
}
export function filterAccessRows(rows: AccessJournalRow[], query: string, attention: boolean, now: Date) {
  const needle = query.trim().toLocaleLowerCase('ru-RU');
  return rows.filter(row => `${row.name} ${row.login} ${row.device} ${row.browser}`.toLocaleLowerCase('ru-RU').includes(needle)
    && (!attention || accessPushView(row, now).tone !== 'ok'));
}
export function groupAccessRows(rows: AccessJournalRow[]) {
  // Login is unique. A display name or user agent does not identify a person/device.
  const groups = new Map<string, AccessJournalRow[]>();
  for (const row of rows) groups.set(row.login, [...(groups.get(row.login) ?? []), row]);
  return [...groups.values()]
    .map(group => group.sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt) || a.id.localeCompare(b.id)))
    .sort((a, b) => Date.parse(b[0].lastSeenAt) - Date.parse(a[0].lastSeenAt)
      || a[0].name.localeCompare(b[0].name, 'ru') || a[0].login.localeCompare(b[0].login));
}

/** An old observation is not evidence of a broken subscription. */
export function accessNotificationDetail(row: AccessJournalRow, now: Date) {
  const view = accessPushView(row, now);
  if (view.tone === 'unknown') return { ...view, label: 'Нет свежих данных', hint: 'Обновятся при открытии портала', explanation: 'Свежего подтверждения от этого подключения пока нет. Это не означает, что уведомления отключены. После открытия портала проверка обновится автоматически.' };
  if (row.pushLabel === 'Подключены') return { ...view, hint: 'Для этого кабинета', explanation: 'Уведомления подключены для этого кабинета на устройстве. Это не подтверждает показ или звук каждого уведомления. Результат последней отправки — ниже.' };
  if (row.pushLabel === 'Запрещены в браузере') return { ...view, label: 'Запрещены', hint: 'Проверить разрешение на устройстве', explanation: 'При последней проверке браузер сообщил запрет уведомлений. Разрешение нужно проверить на самом устройстве; администратор не может включить его удалённо.' };
  if (row.pushLabel === 'Не поддерживаются') return { ...view, label: 'Недоступны в этом режиме', hint: 'Проверить установленное приложение', explanation: 'В этом сеансе браузер не предоставил необходимые функции push. Откройте установленное приложение и проверьте подключение уведомлений там.' };
  return { ...view, label: row.pushLabel === 'Подписка не активна' ? 'Подписка не активна' : 'Не подключены', hint: 'Подключить в этом кабинете на устройстве', explanation: 'Активная подписка для этого подключения и этой учётной записи не подтверждена. Откройте нужный кабинет на устройстве и проверьте раздел уведомлений. Подключение под другой учётной записью не подтверждает подписку здесь.' };
}

export function accessAccountSummary(rows: AccessJournalRow[], now: Date) {
  const connected = rows.filter(row => accessPushView(row, now).tone === 'ok').length;
  const warning = rows.filter(row => accessPushView(row, now).tone === 'warning').length;
  return { connected, warning, unknown: rows.length - connected - warning,
    label: connected ? `Уведомления подключены · ${connected} из ${rows.length}` : warning ? 'Нет подтверждённой подписки' : 'Уведомления: нет свежих данных',
    tone: connected ? 'ok' as const : warning ? 'warning' as const : 'unknown' as const };
}

/** Merge only verified identical subscriptions, never identical phone names.
 * Session history remains intact. */
export function accessCurrentConnections(rows: AccessJournalRow[]) {
  const groups = new Map<string, AccessJournalRow[]>();
  for (const row of rows) {
    const key = row.browserInstanceId ? `${row.login}:browser:${row.browserInstanceId}` : row.pushLabel === 'Подключены' && row.pushSubscriptionId
      ? `${row.login}:subscription:${row.pushSubscriptionId}` : `session:${row.id}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map(group => {
    const latest = [...group].sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt) || a.id.localeCompare(b.id))[0];
    const marked = group.filter(row => row.serviceMarkedAt).sort((a, b) => Date.parse(b.serviceMarkedAt!) - Date.parse(a.serviceMarkedAt!))[0];
    return marked ? { ...latest, isService: !latest.ownerBrowser && Boolean(marked.isService || latest.ownerInspection), serviceMarkedAt: marked.serviceMarkedAt } : latest;
  }).sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt) || a.id.localeCompare(b.id));
}

/** A summary of old reported types, not a claim of physical-device identity. */
export function accessLatestVisits(rows: AccessJournalRow[]) {
  const summaries = new Map<string, AccessJournalRow>();
  for (const row of accessCurrentConnections(rows)) {
    const unidentified = !row.browserInstanceId && !(row.pushLabel === 'Подключены' && row.pushSubscriptionId);
    const key = unidentified ? JSON.stringify([row.login, row.device, row.browser, row.displayMode ?? 'unknown', !!row.isService]) : row.id;
    const prior = summaries.get(key);
    if (!prior) summaries.set(key, row);
    else summaries.set(key, { ...prior, unidentifiedCount: (prior.unidentifiedCount ?? 1) + (row.unidentifiedCount ?? 1) });
  }
  return [...summaries.values()];
}

/** Presentation only: retain identified connections and the latest unidentifiable
 * visit for each device/browser type not yet replaced by an identified record.
 * Never infer that two similar names are the same physical device. */
export function accessOverviewRows(rows: AccessJournalRow[]) {
  return groupAccessRows(rows).flatMap(group => {
    const hasIdentity = (row: AccessJournalRow) => Boolean(row.browserInstanceId || (row.pushLabel === 'Подключены' && row.pushSubscriptionId));
    const identified = group.filter(hasIdentity);
    const legacy = group.filter(row => !hasIdentity(row));
    const retained = new Map<string, AccessJournalRow>();
    for (const row of legacy) {
      const key = JSON.stringify([row.device, row.browser]);
      // A known subscription may be older than the latest unidentifiable visit.
      // Never hide a more recent observation just because the older one has an ID.
      if (!retained.has(key) && !identified.some(r => r.device === row.device && r.browser === row.browser && Date.parse(r.lastSeenAt) >= Date.parse(row.lastSeenAt))) retained.set(key, row);
    }
    return [...identified, ...retained.values()].sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt) || a.id.localeCompare(b.id));
  });
}

/** Service view groups accounts only by an exact stable browser identifier.
 * Same labels, IPs, browser names or OS never join independent connections. */
export function groupServiceConnections(rows: AccessJournalRow[]) {
  const groups = new Map<string, AccessJournalRow[]>();
  for (const row of rows) {
    const key = row.browserInstanceId ? `browser:${row.browserInstanceId}` : `legacy:${row.id}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map(group => [...group].sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt) || a.id.localeCompare(b.id)))
    .sort((a, b) => Date.parse(b[0].lastSeenAt) - Date.parse(a[0].lastSeenAt) || a[0].id.localeCompare(b[0].id));
}
