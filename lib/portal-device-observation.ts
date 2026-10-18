/** Explicit, bounded browser diagnostics, never a hardware fingerprint or owner proof. */
export type DeviceObservation = {
  platform?: string; platformVersion?: string; browserVersion?: string;
  architecture?: string; model?: string; source: 'client-hints' | 'user-agent';
};
const keys = ['platform', 'platformVersion', 'browserVersion', 'architecture', 'model', 'source'];
export function parseDeviceObservation(value: unknown): DeviceObservation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !keys.includes(key)) || !['client-hints', 'user-agent'].includes(String(row.source))) return null;
  for (const key of keys.filter(key => key !== 'source')) {
    const item = row[key];
    if (item !== undefined && (typeof item !== 'string' || !item.trim() || item.length > 80 || /[\u0000-\u001f\u007f]/.test(item))) return null;
  }
  return row as DeviceObservation;
}

/** UA versions can be reduced/frozen. Keep source visible; never infer a Mac model. */
export function deviceObservationFromUa(userAgent: string): DeviceObservation {
  const ua = userAgent.slice(0, 2048);
  const browserVersion = ua.match(/Edg(?:e|A|iOS)?\/([\d.]+)/)?.[1]
    ?? ua.match(/OPR\/([\d.]+)/)?.[1] ?? ua.match(/SamsungBrowser\/([\d.]+)/)?.[1]
    ?? ua.match(/(?:Firefox|FxiOS|CriOS|Chrome)\/([\d.]+)/)?.[1]
    ?? ua.match(/Version\/([\d.]+).*Safari/)?.[1];
  const platform = /iPhone|iPad|iPod/.test(ua) ? 'iOS / iPadOS' : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows' : /Macintosh|Mac OS X/.test(ua) ? 'macOS / iPadOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : undefined;
  // Windows NT and frozen macOS tokens are NOT the installed OS version.
  const platformVersion = ua.match(/(?:CPU (?:iPhone )?OS|iPhone OS) ([\d_]+)/)?.[1]?.replaceAll('_', '.')
    ?? ua.match(/Android ([\d.]+)/)?.[1];
  return { source: 'user-agent', ...(platform ? { platform } : {}), ...(platformVersion ? { platformVersion } : {}), ...(browserVersion ? { browserVersion } : {}) };
}

type HintsNavigator = { userAgent: string; userAgentData?: { getHighEntropyValues: (keys: string[]) => Promise<Record<string, unknown>> } };
export async function collectDeviceObservation(nav: HintsNavigator): Promise<DeviceObservation> {
  const fallback = deviceObservationFromUa(nav.userAgent);
  if (!nav.userAgentData) return fallback;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const hints = await Promise.race([
      nav.userAgentData.getHighEntropyValues(['platformVersion', 'fullVersionList', 'architecture', 'model']),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 700); }),
    ]);
    if (!hints) return fallback;
    const result: DeviceObservation = { ...fallback, source: 'client-hints' };
    for (const key of ['platform', 'platformVersion', 'architecture', 'model'] as const) {
      const value = hints[key];
      if (typeof value === 'string' && value.trim() && value.length <= 80 && !/[\u0000-\u001f\u007f]/.test(value)) result[key] = value;
    }
    // Prefer the actual browser, not GREASE or an arbitrary Chromium brand.
    const brands = Array.isArray(hints.fullVersionList) ? hints.fullVersionList : [];
    const expected = /Edg\//.test(nav.userAgent) ? 'Microsoft Edge' : /OPR\//.test(nav.userAgent) ? 'Opera' : /Chrome\//.test(nav.userAgent) ? 'Google Chrome' : '';
    const brand = brands.find(b => b && b.brand === expected);
    if (brand && typeof brand.version === 'string' && /^[\d.]{1,40}$/.test(brand.version)) result.browserVersion = brand.version;
    return parseDeviceObservation(result) ?? fallback;
  } catch { return fallback; } finally { clearTimeout(timer); }
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
