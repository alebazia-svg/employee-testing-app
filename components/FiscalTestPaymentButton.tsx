'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function FiscalTestPaymentButton({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    setBusy(true); setError('');
    const response = await fetch(`/api/admin/terminal-fiscal/reviews/${reviewId}/test-payment`, { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setError(payload.error || 'Не удалось закрыть проверку.'); setBusy(false); return; }
    router.push('/admin'); router.refresh();
  }
  if (!confirming) return <button type='button' onClick={() => setConfirming(true)} className='mt-3 text-sm font-bold text-slate-600 underline decoration-dotted underline-offset-4'>Это тестовая оплата</button>;
  return <div className='mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm'><p className='font-semibold text-slate-700'>Исключить эту операцию из контроля чеков?</p><div className='mt-2 flex gap-2'><button type='button' disabled={busy} onClick={submit} className='rounded-lg bg-slate-900 px-3 py-2 font-bold text-white disabled:opacity-50'>{busy ? 'Закрываю…' : 'Да, это тест'}</button><button type='button' disabled={busy} onClick={() => setConfirming(false)} className='rounded-lg px-3 py-2 font-bold text-slate-600'>Отмена</button></div>{error && <p className='mt-2 font-semibold text-red-700'>{error}</p>}</div>;
}
