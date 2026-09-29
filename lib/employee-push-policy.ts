// Owner policy: no employee push dispatch from 22:00 through 08:29:59 Moscow.
// Portal messages remain durable; provider acceptance is not proof of display.
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
export function employeePushNotBefore(now: Date): Date {
  const moscow = new Date(now.getTime() + MOSCOW_OFFSET_MS);
  const minutes = moscow.getUTCHours() * 60 + moscow.getUTCMinutes();
  if (minutes >= 510 && minutes < 1320) return now;
  const next = new Date(moscow);
  if (minutes >= 1320) next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(8, 30, 0, 0);
  return new Date(next.getTime() - MOSCOW_OFFSET_MS);
}

// Let an offline device receive a neutral notification later today, not only
// within five minutes. Expire queued pushes before the next quiet period.
export function employeePushTtl(now: Date): number {
  if (employeePushNotBefore(now).getTime() !== now.getTime()) return 0;
  const moscow = new Date(now.getTime() + MOSCOW_OFFSET_MS);
  moscow.setUTCHours(22, 0, 0, 0);
  return Math.max(0, Math.floor((moscow.getTime() - MOSCOW_OFFSET_MS - now.getTime()) / 1000));
}

export const DELIVERY_PUSH_COPY = {
  title: 'Пополнение подотчёта',
  body: 'Обновлена информация о выдаче. Проверьте сумму и кассу в календаре.',
};
