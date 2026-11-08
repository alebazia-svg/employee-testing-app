// Share only requests still in flight. Never retain old attention counts or
// configuration after a read finishes; both responsive bells remain mounted.
export function createSharedJsonReader(fetcher: typeof fetch = fetch, timeoutMs = 15_000) {
  const pending = new Map<string, Promise<{ ok: boolean; payload: any }>>();
  return (url: string) => {
    const existing = pending.get(url);
    if (existing) return existing;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const request = (async () => {
      try {
        const response = await fetcher(url, { cache: 'no-store', signal: controller.signal });
        const payload = await response.json().catch(() => null);
        return { ok: response.ok, payload };
      } finally { clearTimeout(timer); }
    })();
    pending.set(url, request);
    void request.then(() => pending.delete(url), () => pending.delete(url));
    return request;
  };
}
export const readAdminInboxJson = createSharedJsonReader();
