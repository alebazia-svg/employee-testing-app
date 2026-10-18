export const accessBrowserCookie = 'mobo_access_browser';
export function validAccessBrowserId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}

/** Request-local observation, never ownership or authentication evidence.
 * Do not fall back to IP, user agent, account, label or missing IDs. */
export function isCurrentAccessBrowser(recordId: unknown, cookieId: unknown) {
  return validAccessBrowserId(recordId) && validAccessBrowserId(cookieId) && recordId === cookieId;
}
