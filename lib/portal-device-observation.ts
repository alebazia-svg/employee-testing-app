/** Bounded browser diagnostics. These are reports, never hardware or owner proof. */
const deviceFields = ['platform', 'platformVersion', 'browserVersion', 'architecture', 'model'] as const;
type DeviceField = typeof deviceFields[number];
type DeviceSource = 'client-hints' | 'user-agent';
export type DeviceObservation = {
  platform?: string; platformVersion?: string; browserVersion?: string;
  architecture?: string; model?: string; source: DeviceSource;
  fieldSources?: Partial<Record<DeviceField, DeviceSource>>;
  collectedAt?: string;
  hintsState?: 'unsupported' | 'complete' | 'partial' | 'timeout' | 'error';
};
const clean = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim()) && value.length <= 80 && !/[\u0000-\u001f\u007f]/.test(value);
export function parseDeviceObservation(value: unknown): DeviceObservation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => ![...deviceFields, 'source', 'fieldSources', 'hintsState', 'collectedAt'].includes(key)) || !['client-hints', 'user-agent'].includes(String(row.source))) return null;
  for (const key of deviceFields) if (row[key] !== undefined && !clean(row[key])) return null;
  if (row.collectedAt !== undefined && (typeof row.collectedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.collectedAt) || (!Number.isFinite(Date.parse(row.collectedAt)) || new Date(row.collectedAt).toISOString() !== row.collectedAt))) return null;
  if (row.hintsState !== undefined && !['unsupported', 'complete', 'partial', 'timeout', 'error'].includes(String(row.hintsState))) return null;
  if (row.fieldSources !== undefined) {
    if (!row.fieldSources || typeof row.fieldSources !== 'object' || Array.isArray(row.fieldSources)) return null;
    for (const [key, source] of Object.entries(row.fieldSources)) {
      if (!deviceFields.includes(key as DeviceField) || row[key] === undefined || !['client-hints', 'user-agent'].includes(String(source)) || source === 'client-hints' && row.source !== 'client-hints') return null;
    }
    // A new-format report must explain every field, not silently inherit a global source.
    for (const key of deviceFields) if (row[key] !== undefined && !(key in row.fieldSources)) return null;
  }
  return row as DeviceObservation;
}

/** Preserve reported values for diagnostics; presentation must account for UA reduction. */
export function deviceObservationFromUa(userAgent: string): DeviceObservation {
  const ua = userAgent.slice(0, 2048);
  const browserVersion = ua.match(/Edg(?:e|A|iOS)?\/([\d.]+)/)?.[1]
    ?? ua.match(/OPR\/([\d.]+)/)?.[1] ?? ua.match(/SamsungBrowser\/([\d.]+)/)?.[1]
    ?? ua.match(/(?:Firefox|FxiOS|CriOS|Chrome)\/([\d.]+)/)?.[1]
    ?? ua.match(/Version\/([\d.]+).*Safari/)?.[1];
  const platform = /iPhone|iPad|iPod/.test(ua) ? 'iOS / iPadOS' : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows' : /Macintosh|Mac OS X/.test(ua) ? 'macOS / iPadOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : undefined;
  const platformVersion = ua.match(/(?:CPU (?:iPhone )?OS|iPhone OS) ([\d_]+)/)?.[1]?.replaceAll('_', '.')
    ?? ua.match(/Android ([\d.]+)/)?.[1];
  const result: DeviceObservation = { source: 'user-agent', ...(platform ? { platform } : {}), ...(platformVersion ? { platformVersion } : {}), ...(browserVersion ? { browserVersion } : {}) };
  result.fieldSources = Object.fromEntries(deviceFields.filter(key => result[key]).map(key => [key, 'user-agent']));
  return result;
}

type HintsNavigator = { userAgent: string; userAgentData?: { platform?: string; getHighEntropyValues: (keys: string[]) => Promise<Record<string, unknown>> } };
export async function collectDeviceObservation(nav: HintsNavigator): Promise<DeviceObservation> {
  const fallback = deviceObservationFromUa(nav.userAgent);
  fallback.collectedAt = new Date().toISOString();
  if (clean(nav.userAgentData?.platform)) {
    if (nav.userAgentData.platform !== fallback.platform) { delete fallback.platformVersion; delete fallback.fieldSources!.platformVersion; }
    fallback.platform = nav.userAgentData.platform; fallback.fieldSources!.platform = 'client-hints'; fallback.source = 'client-hints';
  }
  if (!nav.userAgentData) return { ...fallback, hintsState: 'unsupported' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const hints = await Promise.race([
      nav.userAgentData.getHighEntropyValues(['platformVersion', 'fullVersionList', 'architecture', 'model']),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 700); }),
    ]);
    if (!hints) return { ...fallback, hintsState: 'timeout' };
    const result: DeviceObservation = { ...fallback, fieldSources: { ...fallback.fieldSources } };
    const set = (key: DeviceField, value: unknown) => {
      if (clean(value) && (!key.endsWith('Version') || /^[\d.]{1,40}$/.test(value))) {
        result[key] = value; result.fieldSources![key] = 'client-hints'; result.source = 'client-hints';
      }
    };
    // Never attach an Android fallback version to a differently reported platform.
    if (clean(hints.platform) && hints.platform !== fallback.platform) {
      delete result.platformVersion; delete result.fieldSources!.platformVersion;
    }
    for (const key of ['platform', 'platformVersion', 'architecture', 'model'] as const) set(key, hints[key]);
    const brands = Array.isArray(hints.fullVersionList) ? hints.fullVersionList : [];
    const expected = /Edg\//.test(nav.userAgent) ? 'Microsoft Edge' : /OPR\//.test(nav.userAgent) ? 'Opera' : /SamsungBrowser\//.test(nav.userAgent) ? 'Samsung Internet' : /Chrome\//.test(nav.userAgent) ? 'Google Chrome' : '';
    const brand = brands.find(b => b && b.brand === expected);
    if (brand) set('browserVersion', brand.version);
    result.hintsState = result.fieldSources?.platformVersion === 'client-hints' && result.fieldSources.browserVersion === 'client-hints' ? 'complete' : 'partial';
    return parseDeviceObservation(result) ?? { ...fallback, hintsState: 'error' };
  } catch { return { ...fallback, hintsState: 'error' }; } finally { clearTimeout(timer); }
}

/** One in-flight query; retry incomplete reads on later heartbeats, never prompt or spin. */
export function createDeviceObservationCollector(nav: HintsNavigator, clock = Date.now, collect = collectDeviceObservation) {
  let cached: DeviceObservation | undefined, pending: Promise<DeviceObservation> | undefined;
  let checkedAt = 0, failures = 0;
  return async () => {
    if (pending) return pending;
    const now = clock();
    if (cached && (cached.hintsState === 'unsupported' || now - checkedAt < (failures ? 60000 : 300000) || failures >= 3)) return cached;
    pending = collect(nav).then(result => {
      cached = result; checkedAt = clock();
      failures = ['partial', 'timeout', 'error'].includes(result.hintsState ?? '') ? failures + 1 : 0;
      return result;
    }).finally(() => { pending = undefined; });
    return pending;
  };
}

/** Old mixed-source observations cannot establish provenance for individual fields. */
export function deviceFieldSource(observation: DeviceObservation, field: DeviceField) {
  return observation.fieldSources?.[field] ?? (observation.source === 'user-agent' ? 'user-agent' : 'legacy');
}
export function deviceSourceLabel(observation: DeviceObservation, field: DeviceField) {
  const source = deviceFieldSource(observation, field);
  return source === 'client-hints' ? 'Расширенные сведения браузера' : source === 'user-agent' ? 'Описание браузера; значение может быть ограничено' : 'Старая запись; источник этого значения не уточнён';
}
export function deviceSystemSummary(observation?: DeviceObservation | null) {
  if (!observation?.platform) return null;
  return observation.platformVersion && deviceFieldSource(observation, 'platformVersion') === 'client-hints'
    ? reportedSystem(observation) : [observation.platform, observation.platformVersion ? 'версия не подтверждена' : null].filter(Boolean).join(' · ');
}
export function deviceSystemExplanation(observation: DeviceObservation) {
  if (deviceFieldSource(observation, 'platformVersion') === 'client-hints' && observation.platformVersion) return 'Версия сообщена расширенным API браузера. Это не независимая проверка устройства.';
  if (/iOS|iPadOS/.test(observation.platform ?? '')) return 'Точная версия iOS / iPadOS не подтверждена. Safari может сообщать фиксированную версию 18.x даже на более новой системе. Исходное значение сохранено в технических сведениях.';
  return 'Точная версия системы не подтверждена. Ограниченное описание браузера может содержать условное значение. Исходные сведения сохранены ниже.';
}

export function reportedSystem(observation?: DeviceObservation | null) {
  if (!observation?.platform) return null;
  let version = observation.platformVersion;
  if (observation.platform === 'Windows') {
    // Chromium platformVersion is a Windows contract version, not the marketing OS version.
    const major = version && /^\d+(\.\d+)*$/.test(version) ? Number(version.split('.')[0]) : null;
    return major === null ? 'Windows' : major >= 13 ? 'Windows 11 или новее' : major >= 1 && major <= 10 ? 'Windows 10' : 'Windows';
  }
  return [observation.platform, version].filter(Boolean).join(' ');
}

export function connectionMismatch(bound?: string | null, observed?: string | null) {
  return Boolean(bound && observed && bound !== observed);
}

/** Only portal origin, never query strings, paths, credentials or arbitrary referrers. */
export function portalObservationOrigin(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && url.origin.length <= 200 ? url.origin : undefined;
  } catch { return undefined; }
}

/** Diagnostic only: Next.js can reconstruct req.url with the container host.
 * Prefer the browser's Origin when it matches the HTTP Host. Never trust an
 * arbitrary forwarded host or use this value for authentication/IP attribution. */
export function portalRequestOrigin(req: Request) {
  const host = req.headers.get('host')?.toLowerCase();
  const origin = req.headers.get('origin');
  if (host && origin) {
    try {
      const url = new URL(origin);
      if (url.host.toLowerCase() === host && url.origin === origin) return portalObservationOrigin(origin);
    } catch { /* Invalid browser origin is not recorded. */ }
  }
  try {
    const url = new URL(req.url);
    return !host || url.host.toLowerCase() === host ? portalObservationOrigin(req.url) : undefined;
  } catch { return undefined; }
}
