'use client';

import { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { Card } from '@/components/ui/card';

type State = 'normal' | 'exceptions' | 'not_found' | 'not_mine';

export function EmployeeCreditIssueActionCard(props: { issueId: number; title: string; instruction: string; notFoundLabel: string; closeBlocked?: boolean }) {
  const [state, setState] = useState<State>('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function act(action: 'not_found' | 'not_mine') {
    if (busy) return;
    setBusy(true); setError('');
    const result = await fetch(`/api/employee/workday-issues/${props.issueId}/actions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    }).then(async (response) => ({ ok: response.ok, body: await response.json().catch(() => null) })).catch(() => null);
    if (!result?.ok) { setError(result?.body?.error || 'Не удалось отправить. Попробуйте ещё раз.'); setBusy(false); return; }
    setState(action); setBusy(false);
  }

  return <Card className='rounded-[24px] border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(31,47,66,0.07)]'>
    <div className='flex gap-3'>
      <ReceiptText className='employee-material-alert-symbol mt-0.5 h-6 w-6 shrink-0 text-[#9a5a13]' strokeWidth={2} />
      <div className='min-w-0'><p className='text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#9a5a13]'>Нужно исправить</p><h1 className='mt-1 text-xl font-black leading-snug text-slate-950'>{props.title}</h1><p className='mt-3 text-sm font-bold leading-relaxed text-slate-700'>{props.instruction}</p></div>
    </div>
    {state === 'normal' ? <button type='button' onClick={() => setState('exceptions')} className='mt-4 min-h-11 w-full text-sm font-extrabold text-[#455a78] underline decoration-slate-300 underline-offset-4'>Не получается исправить</button> : null}
    {state === 'exceptions' ? <div className='mt-4 grid gap-2'><button type='button' disabled={busy} onClick={() => void act('not_found')} className='employee-material-secondary-action min-h-12 rounded-xl px-3 text-sm font-black disabled:opacity-50'>{props.notFoundLabel}</button><button type='button' disabled={busy} onClick={() => void act('not_mine')} className='employee-material-secondary-action min-h-12 rounded-xl px-3 text-sm font-black disabled:opacity-50'>Продажа не моя</button></div> : null}
    {state === 'not_found' || state === 'not_mine' ? <div className='mt-4 rounded-2xl bg-[#edf2f7] px-4 py-3 text-sm font-bold text-slate-800'><p className='font-black'>{state === 'not_found' ? 'Администратор уведомлён' : 'Администратор проверит ответственного'}</p><p className='mt-1 text-xs text-slate-600'>{props.closeBlocked ? 'Смена открыта до решения.' : 'Ответ сохранён.'}</p></div> : null}
    {error ? <p className='mt-3 text-xs font-bold text-rose-700'>{error}</p> : null}
  </Card>;
}
