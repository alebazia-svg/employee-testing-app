'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function FiscalDayReconciledButton({
  reviewId,
  onDone,
  onBusyChange,
}: {
  reviewId: string;
  onDone?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    const response = await fetch(`/api/admin/terminal-fiscal/reviews/${reviewId}/day-reconciled`, { method: 'POST' }).catch(() => null);
    const payload = await response?.json().catch(() => ({})) ?? {};
    if (!response?.ok) {
      setError(payload.error || 'Не удалось закрыть проверку.');
      setBusy(false);
      onBusyChange?.(false);
      return;
    }
    setBusy(false);
    onBusyChange?.(false);
    setConfirming(false);
    if (onDone) onDone();
    else {
      router.push('/admin');
      router.refresh();
    }
  }

  if (!confirming) {
    return <button type='button' onClick={() => setConfirming(true)} className='min-h-10 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600'>Итог дня сходится</button>;
  }
  return <div className='mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm'>
    <p className='font-semibold text-slate-700'>Закрыть эту проверку после сверки итогов дня?</p>
    <p className='mt-1 text-xs text-slate-500'>Карточка больше не откроется при следующей ночной проверке.</p>
    <div className='mt-2 flex gap-2'>
      <button type='button' disabled={busy} onClick={submit} className='admin-material-primary min-h-11 rounded-lg px-3 py-2 font-semibold text-white disabled:opacity-50'>{busy ? 'Закрываю…' : 'Да, итог подтверждён'}</button>
      <button type='button' disabled={busy} onClick={() => setConfirming(false)} className='rounded-lg px-3 py-2 font-bold text-slate-600'>Отмена</button>
    </div>
    {error && <p className='mt-2 font-semibold text-red-700'>{error}</p>}
  </div>;
}
