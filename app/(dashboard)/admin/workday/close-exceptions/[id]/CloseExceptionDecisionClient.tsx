'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function CloseExceptionDecisionClient({ requestId }: { requestId: string }) {
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function decide(status: 'approved' | 'rejected') {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/workday/close-exceptions/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, decisionComment: comment }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось сохранить решение');
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить решение');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className='mt-5 space-y-3 border-t border-slate-200 pt-5'>
      <label className='block text-sm font-extrabold text-slate-800'>Комментарий к решению</label>
      <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={3} className='w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-green-500' placeholder='Необязательно при разрешении' />
      {error && <p className='text-sm font-bold text-red-700'>{error}</p>}
      <div className='grid gap-2 sm:grid-cols-2'>
        <Button disabled={saving} onClick={() => decide('approved')} className='font-extrabold'>Разрешить завершить день</Button>
        <Button disabled={saving} onClick={() => decide('rejected')} className='bg-white font-extrabold text-red-700 ring-1 ring-red-200 shadow-none hover:bg-red-50'>Не разрешать</Button>
      </div>
    </div>
  );
}
