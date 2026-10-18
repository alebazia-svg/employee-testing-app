import type { AccessJournalRow } from '../components/PortalAccessJournal';

export const ACCESS_RECENT_DAYS = 7;
export const accessRecentSince = (now: Date) => new Date(now.getTime() - ACCESS_RECENT_DAYS * 86400000);

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

/** Visibility only: never expires a session or disables a push subscription. */
export function accessRecentConnections(rows: AccessJournalRow[], now: Date) {
  const since = accessRecentSince(now).getTime();
  return accessCurrentConnections(rows.filter(row => !row.loggedOutAt
    && Date.parse(row.expiresAt) > now.getTime()
    && Date.parse(row.lastSeenAt) >= since));
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
  return [...groups.values()].sort((a, b) => a[0].name.localeCompare(b[0].name, 'ru') || a[0].login.localeCompare(b[0].login));
}

/** An old observation is not evidence of a broken subscription. */
export function accessNotificationDetail(row: AccessJournalRow, now: Date) {
  const view = accessPushView(row, now);
  if (view.tone === 'unknown') return { ...view, label: 'Нужна свежая проверка', hint: 'Открыть портал на этом устройстве', explanation: 'Телефон или браузер давно не сообщал статус. Это не означает, что уведомления отключены. После открытия портала проверка обновится автоматически.' };
  if (row.pushLabel === 'Подключены') return { ...view, hint: 'Подписка подтверждена', explanation: 'При последней проверке устройство сообщило о подписке. Портал подтвердил, что она активна для этой учётной записи.' };
  if (row.pushLabel === 'Запрещены в браузере') return { ...view, label: 'Запрещены', hint: 'Проверить разрешение на устройстве', explanation: 'При последней проверке браузер сообщил запрет уведомлений. Разрешение нужно проверить на самом устройстве; администратор не может включить его удалённо.' };
  if (row.pushLabel === 'Не поддерживаются') return { ...view, label: 'Недоступны в этом режиме', hint: 'Проверить установленное приложение', explanation: 'В этом сеансе браузер не предоставил необходимые функции push. Откройте установленное приложение и проверьте подключение уведомлений там.' };
  return { ...view, label: row.pushLabel === 'Подписка не активна' ? 'Подписка не активна' : 'Не подключены', hint: 'Подключить в этом кабинете на устройстве', explanation: 'Активная подписка для этого подключения и этой учётной записи не подтверждена. Откройте нужный кабинет на устройстве и проверьте раздел уведомлений. Подключение под другой учётной записью не подтверждает подписку здесь.' };
}

export function accessAccountSummary(rows: AccessJournalRow[], now: Date) {
  const connected = rows.filter(row => accessPushView(row, now).tone === 'ok').length;
  const warning = rows.filter(row => accessPushView(row, now).tone === 'warning').length;
  return { connected, warning, unknown: rows.length - connected - warning,
    label: connected ? `Уведомления подключены · ${connected} из ${rows.length}` : warning ? 'Нет подтверждённой подписки' : 'Нужна проверка уведомлений',
    tone: connected ? 'ok' as const : warning ? 'warning' as const : 'unknown' as const };
}

/** Merge only verified identical subscriptions, never identical phone names.
 * Session history remains intact. */
export function accessCurrentConnections(rows: AccessJournalRow[]) {
  const groups = new Map<string, AccessJournalRow>();
  for (const row of rows) {
    const key = row.pushLabel === 'Подключены' && row.pushSubscriptionId
      ? `${row.login}:subscription:${row.pushSubscriptionId}` : `session:${row.id}`;
    const previous = groups.get(key);
    if (!previous || Date.parse(row.lastSeenAt) > Date.parse(previous.lastSeenAt)) groups.set(key, row);
  }
  return [...groups.values()].sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt) || a.id.localeCompare(b.id));
}
