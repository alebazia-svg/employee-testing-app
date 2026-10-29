/** Display-only freshness; never turns an unavailable source into a confirmed result. */
export function procurementMobileFreshness(checkedAt: string, now: Date, refreshing = false, unavailable = false) {
  if (refreshing) return 'Обновляем…';
  const date = new Date(checkedAt);
  if (!checkedAt || !Number.isFinite(date.getTime())) return 'Данные не обновлены';
  const day = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
  const time = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', ...(day(date) !== day(now) ? { day: '2-digit', month: '2-digit' } as const : {}) }).format(date);
  return `${unavailable ? 'Сохранено:' : 'Обновлено в'} ${time}`;
}
