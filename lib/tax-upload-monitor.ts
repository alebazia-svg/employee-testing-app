import type { TaxUploadStatus } from './tax-upload-state';

export async function followTaxProcessing(attempt: number, id: string, since: string, options: {
  update: (attempt: number, patch: Partial<TaxUploadStatus>) => void;
  refresh: () => void;
  fetchStatus?: typeof fetch;
  pause?: (ms: number) => Promise<void>;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const pause = options.pause ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const fetchStatus = options.fetchStatus ?? fetch;
  const started = now();
  while (now() - started < 25 * 60_000) {
    await pause(8_000);
    const response = await fetchStatus(`/api/admin/taxes/documents/status?id=${encodeURIComponent(id)}&since=${encodeURIComponent(since)}`, { cache: 'no-store' }).catch(() => null);
    if (!response?.ok) continue;
    const payload = await response.json().catch(() => ({}));
    if (payload.state === 'done') {
      options.update(attempt, { progress: 'done', message: 'Файл учтён, цифры и сверка пересчитаны.', changes: Array.isArray(payload.changes) ? payload.changes.filter((item: unknown): item is string => typeof item === 'string') : [] });
      options.refresh();
      return;
    }
    if (payload.state === 'failed') {
      options.update(attempt, { progress: 'failed', message: payload.message || 'Сервер не смог обработать файл. Загрузите его ещё раз.' });
      options.refresh();
      return;
    }
  }
  options.update(attempt, { progress: 'waiting', message: 'Пересчёт идёт дольше обычного. Результат появится в «Истории загрузок»; если там будет «Не обработан» — загрузите файл ещё раз.' });
}

