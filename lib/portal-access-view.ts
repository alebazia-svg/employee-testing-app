import type { AccessJournalRow } from '../components/PortalAccessJournal';

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
