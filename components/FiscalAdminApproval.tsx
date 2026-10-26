'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function FiscalAdminApproval({ reviewId, recipients, primary, confidence, compact = false, onDone, onBusyChange }: { reviewId: string; recipients: Array<{ id: number; name: string }>; primary: { id: number; name: string } | null; confidence: 'high' | 'uncertain';compact?:boolean;onDone?:()=>void;onBusyChange?:(busy:boolean)=>void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  async function send() {
    setBusy(true); onBusyChange?.(true); setError('');
    try {
      const response = await fetch(`/api/admin/terminal-fiscal/reviews/${reviewId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientIds: recipients.map((u) => u.id) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось передать проверку. Повторите попытку.');
      if(onDone)onDone();else router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось передать проверку.'); }
    finally { setBusy(false); onBusyChange?.(false); }
  }
  const personal = confidence === 'high' && primary;
  return <section className='space-y-3'>
    {(!compact||!personal)&&<p className='text-sm leading-relaxed text-stone-600'>{!recipients.length ? 'Получатели пока не определены. Проверка сохранена у вас; после появления отметок смены откройте её снова.' : personal ? `Ответственный по рабочему месту и смене: ${primary.name}. Менеджер сможет уточнить, чья это оплата.` : `Ответственного по смене однозначно определить не удалось. Получат: ${recipients.map((u) => u.name).join(', ')}.`}</p>}
    <button type='button' disabled={busy || !recipients.length} onClick={send} className='admin-material-primary min-h-11 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45'>{busy ? 'Передаём…' : personal ? 'Передать менеджеру на проверку' : 'Передать менеджерам на проверку'}</button>
    {error && <p role='alert' className='mt-3 text-sm text-red-700'>{error}</p>}
  </section>;
}
