export type PortalDisplayMode = 'app' | 'browser' | 'unknown';

/** Report this window's mode, not whether an app is installed elsewhere. */
export function portalDisplayMode(matches: (query: string) => boolean, iosStandalone?: boolean): PortalDisplayMode {
  try {
    if (iosStandalone === true || ['standalone', 'minimal-ui', 'window-controls-overlay'].some(mode => matches(`(display-mode: ${mode})`))) return 'app';
    if (matches('(display-mode: browser)')) return 'browser';
  } catch { /* An unsupported API is not evidence of browser mode. */ }
  return 'unknown';
}
