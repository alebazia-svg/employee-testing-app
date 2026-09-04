'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function FiscalAdminApproval({ reviewId, recipients }: { reviewId: string; recipients: Array<{ id: number; name: string }> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  async function send() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/terminal-fiscal/reviews/${reviewId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientIds: recipients.map((u) => u.id) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось передать проверку. Повторите попытку.');
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось передать проверку.'); }
    finally { setBusy(false); }
  }
  return <section className='mt-5'>
    <p className='mt-2 text-sm text-slate-700'>{recipients.length ? `Получат: ${recipients.map((u) => u.name).join(', ')}` : 'За этот день нет отмеченных сотрудников розницы. Проверка остаётся у вас.'}</p>
    <button type='button' disabled={busy || !recipients.length} onClick={send} className='mt-4 min-h-12 w-full rounded-xl bg-green-700 px-4 py-3 font-bold text-white disabled:opacity-50'>{busy ? 'Передаём…' : 'Передать менеджерам'}</button>
    {error && <p role='alert' className='mt-3 text-sm text-red-700'>{error}</p>}
  </section>;
}
