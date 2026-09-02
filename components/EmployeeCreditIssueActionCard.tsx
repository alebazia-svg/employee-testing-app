'use client';

import { useState } from 'react';
import { BillListIcon as PremiumBillListIcon, QuestionCircleIcon as PremiumQuestionIcon, UserCrossIcon as PremiumUserCrossIcon } from '@solar-icons/react/bold-duotone';
import { Card } from '@/components/ui/card';

type State = 'normal' | 'exceptions' | 'not_found' | 'not_mine';

export function EmployeeCreditIssueActionCard(props: { issueId: number; title: string; instruction: string; notFoundLabel: string }) {
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

  return <Card className='rounded-[24px] border-amber-200 bg-amber-50'>
    <div className='flex gap-3'><span className='employee-material-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-amber-700'><PremiumBillListIcon color='#a85a08' secondaryColor='#f6d58b' secondaryOpacity={0.9} className='h-7 w-7' /></span><div><h1 className='text-xl font-black leading-snug'>{props.title}</h1><p className='mt-2 text-sm font-bold leading-relaxed text-slate-700'>{props.instruction} После этого задача исчезнет автоматически.</p></div></div>
    {state === 'normal' ? <button type='button' onClick={() => setState('exceptions')} className='mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-3 text-sm font-black text-slate-800'><PremiumQuestionIcon color='#566269' secondaryColor='#c7cfcb' secondaryOpacity={0.9} className='h-7 w-7 shrink-0' />Не могу исправить</button> : null}
    {state === 'exceptions' ? <div className='mt-4 grid grid-cols-2 gap-2'><button type='button' disabled={busy} onClick={() => void act('not_found')} className='flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-3 text-sm font-black text-slate-800 disabled:opacity-50'><PremiumQuestionIcon color='#566269' secondaryColor='#c7cfcb' secondaryOpacity={0.9} className='h-7 w-7 shrink-0' />{props.notFoundLabel}</button><button type='button' disabled={busy} onClick={() => void act('not_mine')} className='flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-3 text-sm font-black text-slate-800 disabled:opacity-50'><PremiumUserCrossIcon color='#566269' secondaryColor='#c7cfcb' secondaryOpacity={0.9} className='h-7 w-7 shrink-0' />Продажа не моя</button></div> : null}
    {state === 'not_found' ? <div className='mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-bold text-slate-800'><p className='font-black'>Администратор получил уведомление</p><p className='mt-1 text-xs text-slate-600'>Больше ничего делать не нужно.</p></div> : null}
    {state === 'not_mine' ? <div className='mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-bold text-slate-800'><p className='font-black'>Администратор проверит ответственного</p><p className='mt-1 text-xs text-slate-600'>Больше ничего делать не нужно.</p></div> : null}
    {error ? <p className='mt-3 text-xs font-bold text-rose-700'>{error}</p> : null}
  </Card>;
}
