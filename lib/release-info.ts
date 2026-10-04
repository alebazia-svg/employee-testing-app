/** Public build identity only; no runtime secrets or API requests. */
export function getReleaseInfo() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION || 'не определена';
  const builtAt = process.env.NEXT_PUBLIC_APP_BUILT_AT;
  const date = builtAt && Number.isFinite(Date.parse(builtAt))
    ? new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow',
    }).format(new Date(builtAt))
    : null;
  return { version, date, preview: version.includes('-'),
    revision: process.env.NEXT_PUBLIC_APP_REVISION,
    source: process.env.NEXT_PUBLIC_APP_SOURCE };
}
