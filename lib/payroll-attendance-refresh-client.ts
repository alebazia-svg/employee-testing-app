import type { PayrollAttendancePreviewResponse } from './payroll-calculation-engine';

/** A shared source lock means busy, not failed. Never clear a real source error. */
export async function refreshPayrollAttendanceClient(endpoint: string, options: {
  baseline?: string; signal?: AbortSignal;
  fetcher?: typeof fetch; wait?: (signal?: AbortSignal) => Promise<void>;
} = {}): Promise<PayrollAttendancePreviewResponse> {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? ((signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, 5000);
    signal?.addEventListener('abort', abort, { once: true });
  }));
  for (;;) {
    options.signal?.throwIfAborted();
    const response = await fetcher(endpoint, { method: 'POST', cache: 'no-store', signal: options.signal });
    if (response.status !== 409) {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Не удалось обновить данные о рабочих днях.');
      return payload as PayrollAttendancePreviewResponse;
    }
    await wait(options.signal);
    const stored = await fetcher(endpoint, { cache: 'no-store', signal: options.signal });
    if (!stored.ok) {
      if (stored.status === 404) continue;
      throw new Error('Не удалось открыть сохранённые данные о рабочих днях.');
    }
    const payload = await stored.json() as PayrollAttendancePreviewResponse;
    const checked = payload.snapshot?.sourceCheckedAt;
    if (checked && Number.isFinite(Date.parse(checked)) && (!options.baseline || checked > options.baseline)) return payload;
    // The other task may be refreshing a different month/source. Retry our
    // ordinary guarded refresh; never infer success from an unchanged snapshot.
  }
}
