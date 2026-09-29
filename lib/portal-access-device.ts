/** Coarse, reported browser identity, not a physical device fingerprint. Never persist raw UA. */
export function accessDevice(userAgent: string) {
  const ua = userAgent.slice(0, 2048);
  const device = /iPad/i.test(ua) ? 'iPad' : /iPhone|iPod/i.test(ua) ? 'iPhone' : /Android/i.test(ua)
    ? (/Mobile/i.test(ua) ? 'Телефон Android' : 'Планшет Android') : /Windows/i.test(ua) ? 'Компьютер Windows'
      : /Macintosh|Mac OS X/i.test(ua) ? (/Edg\/|Chrome\/|Firefox\//i.test(ua) ? 'Mac' : 'Mac / iPad') : /CrOS/i.test(ua) ? 'Chromebook' : /Linux/i.test(ua) ? 'Компьютер Linux' : 'Устройство не определено';
  const browser = /Edg(?:e|A|iOS)?\//i.test(ua) ? 'Edge' : /OPR\/|Opera/i.test(ua) ? 'Opera'
    : /SamsungBrowser\//i.test(ua) ? 'Samsung Internet' : /Firefox\/|FxiOS\//i.test(ua) ? 'Firefox'
      : /Chrome\/|CriOS\//i.test(ua) ? 'Chrome' : /Safari\//i.test(ua) ? 'Safari' : 'Браузер не определён';
  return { device, browser };
}
export type AccessPushState = 'unknown' | 'connected' | 'not_connected' | 'blocked' | 'unsupported';
export function accessPushLabel(state: string, subscription: { userId: number; disabledAt: unknown } | null, userId: number) {
  if (state === 'connected') return subscription && subscription.userId === userId && !subscription.disabledAt ? 'Подключены' : 'Подписка не активна';
  if (state === 'blocked') return 'Запрещены в браузере';
  if (state === 'unsupported') return 'Не поддерживаются';
  if (state === 'not_connected') return 'Не подключены';
  return 'Не проверены';
}
