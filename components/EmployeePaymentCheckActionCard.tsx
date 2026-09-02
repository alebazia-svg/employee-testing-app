'use client';
import { useEffect, useState } from 'react';
import { BillListIcon as PremiumBillListIcon, QuestionCircleIcon as PremiumQuestionIcon, UserCrossIcon as PremiumUserCrossIcon } from '@solar-icons/react/bold-duotone';
import { Card } from '@/components/ui/card';

type State = 'pending' | 'help' | 'not_mine';
const money = (value: number) => `${(value / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
const time = (value: string) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));

export function EmployeePaymentCheckActionCard(props: { reviewId: string; amountKopecks: number; bankOperationAt: string; initialResponse: string; latestAdminMessage?: string | null }) {
  const [state, setState] = useState<State>(props.initialResponse === 'help' || props.initialResponse === 'not_mine' ? props.initialResponse : 'pending');
  const [handler, setHandler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function act(action: 'open' | 'help' | 'not_mine' | 'undo_not_mine') {
    if (busy) return;
    setBusy(true); setError('');
    const result = await fetch(`/api/employee/payment-checks/${props.reviewId}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }).then(async (request) => ({ ok: request.ok, body: await request.json().catch(() => null) })).catch(() => null);
    if (!result?.ok) { setError(result?.body?.error || 'Не удалось сохранить. Попробуйте ещё раз.'); setBusy(false); return; }
    setHandler(result.body.handlerName ?? null);
    setState(result.body.state === 'help' || result.body.state === 'not_mine' ? result.body.state : 'pending');
    setBusy(false);
  }
  useEffect(() => { void act('open'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const amount = money(props.amountKopecks);
  return <Card className='rounded-[24px] border-amber-200 bg-amber-50'>
    <div className='flex gap-3'><span className='employee-material-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-amber-700'><PremiumBillListIcon color='#a85a08' secondaryColor='#f6d58b' secondaryOpacity={0.9} className='h-7 w-7' /></span><div><h1 className='text-xl font-black leading-snug'>Пробейте чек на {amount}</h1><p className='mt-2 text-sm font-bold leading-relaxed text-slate-700'>Терминал принял оплату в {time(props.bankOperationAt)}, но в 1С чека нет. Пробейте чек — сообщение исчезнет автоматически.</p></div></div>
    {handler ? <p className='mt-4 rounded-xl bg-white/80 px-3 py-2 text-sm font-bold text-slate-700'>Уже проверяет: {handler}</p> : null}
    {state === 'pending' && !handler ? <div className='mt-4 grid grid-cols-2 gap-2'><button type='button' disabled={busy} onClick={() => void act('help')} className='flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-3 text-sm font-black text-slate-800 disabled:opacity-50'><PremiumQuestionIcon color='#566269' secondaryColor='#c7cfcb' secondaryOpacity={0.9} className='h-7 w-7 shrink-0' />Не нахожу чек</button><button type='button' disabled={busy} onClick={() => void act('not_mine')} className='flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-3 text-sm font-black text-slate-800 disabled:opacity-50'><PremiumUserCrossIcon color='#566269' secondaryColor='#c7cfcb' secondaryOpacity={0.9} className='h-7 w-7 shrink-0' />Не моя оплата</button></div> : null}
    {state === 'help' ? <div className='mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-bold text-slate-800'><p className='font-black'>Администратор получил уведомление</p><p className='mt-1 text-xs text-slate-600'>Больше ничего делать не нужно.</p></div> : null}
    {state === 'not_mine' ? <div className='mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-bold text-slate-800'><p className='font-black'>Передано сотруднику смены</p><p className='mt-1 text-xs text-slate-600'>Ошибка останется открытой до появления чека в 1С.</p><button type='button' disabled={busy} onClick={() => void act('undo_not_mine')} className='mt-2 text-xs font-black text-green-700 disabled:opacity-50'>Отменить</button></div> : null}
    {props.latestAdminMessage ? <div className='mt-4 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-950'><p className='font-black'>Ответ администратора</p><p className='mt-1 font-semibold'>{props.latestAdminMessage}</p></div> : null}
    {error ? <p className='mt-3 text-xs font-bold text-rose-700'>{error}</p> : null}
  </Card>;
}
