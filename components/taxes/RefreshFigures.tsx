'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

// One click for a fresh server calculation; shows what changed afterwards.
export function RefreshFigures({ demo = false }: { demo?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; changes: string[] } | null>(null);
  async function refresh() {
    if (demo) { setResult({ ok: true, message: 'В демонстрации пересчёт не запускается.', changes: [] }); return; }
    setBusy(true); setResult(null);
    try {
      const response = await fetch('/api/admin/taxes/refresh', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      setResult({ ok: response.ok, message: payload.processing?.message || (response.ok ? 'Цифры пересчитаны.' : 'Не удалось пересчитать цифры.'), changes: Array.isArray(payload.changes) ? payload.changes : [] });
      if (response.ok) router.refresh();
    } catch { setResult({ ok: false, message: 'Нет связи с порталом. Попробуйте ещё раз.', changes: [] }); }
    finally { setBusy(false); }
  }
  return <div className='mt-2'>
    <button type='button' onClick={refresh} disabled={busy} className='admin-material-primary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-60'><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{busy ? 'Пересчитываем — до нескольких минут…' : 'Обновить цифры сейчас'}</button>
    {result && <div className='tax-callout mt-2' data-tone={result.ok ? 'ok' : 'error'}><p><strong>{result.message}</strong></p>{result.changes.length > 0 && <ul className='mt-1 space-y-0.5'>{result.changes.map((change, index) => <li key={index}>• {change}</li>)}</ul>}</div>}
  </div>;
}
