'use client';
import { useRef, useState } from 'react';

export function TeamCalendarCorrection({ employeeId, date, correctionId, active, canMarkWorking }: {
  employeeId: number; date: string; correctionId: string | null; active: boolean; canMarkWorking: boolean;
}) {
  const [mode, setMode] = useState<'working' | 'reset' | null>(null);
  const [reason, setReason] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [stale, setStale] = useState(false);
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const open = (next: 'working' | 'reset') => { setMode(next); setReason(''); setError(''); operation.current = null; };
  async function save() {
    if (!mode || busy || !reason.trim()) return;
    setBusy(true); setError('');
    const signature = `${mode}:${reason.trim()}`;
    if (operation.current?.signature !== signature) operation.current = { signature, id: crypto.randomUUID() };
    try {
      const response = await fetch('/api/admin/workday/corrections', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_calendar_working', userId: employeeId, date, reason: reason.trim(), status: mode,
          requestId: operation.current.id, expectedCorrectionId: correctionId }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setStale(response.status === 409); throw new Error(data?.error || 'Исправление не сохранено. Повторите попытку.'); }
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Нет связи. Текст причины сохранён в этой форме. Повторите попытку.'); }
    finally { setBusy(false); }
  }
  if (!mode) return <div className='mt-4 flex flex-wrap gap-2'>
    {canMarkWorking && <button type='button' className='team-button' onClick={() => open('working')}>Работал, но забыл QR</button>}
    {active && <button type='button' className='team-button' onClick={() => open('reset')}>Отменить ручное исправление</button>}
  </div>;
  return <form className='mt-4 rounded-xl border border-stone-200 p-4' onSubmit={event => { event.preventDefault(); void save(); }}>
    <p className='font-semibold'>{mode === 'working' ? 'Учесть день как рабочий' : 'Отменить ручное исправление'}</p>
    <p className='mt-2 text-sm text-stone-600'>{mode === 'working' ? 'Изменится только отметка в календаре. QR и время прихода задним числом не создаются.' : 'Календарь снова определит день по QR и времени окончания работы. История исправления сохранится.'}</p>
    <label className='mt-3 block text-sm font-medium'>Причина исправления
      <textarea required maxLength={500} rows={3} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} className='mt-1 w-full rounded-lg border border-stone-300 p-2' />
    </label>
    {error && <p role='alert' className='mt-2 text-sm text-red-700'>{error}</p>}
    <div className='mt-3 flex flex-wrap gap-2'>
      {stale ? <button type='button' className='team-button' onClick={() => window.location.reload()}>Обновить день</button> : <button type='submit' className='team-button' disabled={busy || !reason.trim()}>{busy ? 'Сохраняем…' : mode === 'working' ? 'Сохранить рабочий день' : 'Отменить исправление'}</button>}
      <button type='button' className='team-button' disabled={busy} onClick={() => { setMode(null); setStale(false); }}>Назад</button>
    </div>
  </form>;
}
