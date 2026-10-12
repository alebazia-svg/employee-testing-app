'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ChevronRight, CheckCheck } from 'lucide-react';
import type { AdminInboxViewItem } from '@/lib/admin-inbox-data';
import { startVisibleSync } from '@/lib/visible-sync';

type View = 'attention' | 'history' | 'system';
const PAGE_SIZE = 30;
const when = (value: string) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(new Date(value));

export function AdminInboxListClient({ initialItems, initialAttention, initialView, technicalCount }: {
  initialItems: AdminInboxViewItem[]; initialAttention: AdminInboxViewItem[]; initialView: View; technicalCount: number;
}) {
  const router = useRouter();
  const [shown, setShown] = useState(PAGE_SIZE);
  const [error, setError] = useState('');
  const [showSystemHistory, setShowSystemHistory] = useState(false);
  useEffect(() => startVisibleSync(() => router.refresh(), 60_000), [router]);
  const view = initialView;
  const items = view === 'attention' ? initialAttention : initialItems.filter(i => view === 'system' ? (showSystemHistory ? i.meta.category === 'system' || i.event.type === 'terminal_fiscal_review.created' : i.meta.category === 'system' && i.sourceState.active) : i.meta.category !== 'system' && i.event.type !== 'terminal_fiscal_review.created');
  const unread = initialItems.some(i => !i.readAt);
  async function open(item: AdminInboxViewItem) {
    if (item.eventId && !item.readAt) await fetch(`/api/admin/inbox/${encodeURIComponent(item.id)}/read`, { method: 'POST' }).catch(() => null);
    router.push(item.event.href);
  }
  async function markAll() {
    setError('');
    const result = await fetch('/api/admin/inbox/read-all', { method: 'POST' }).catch(() => null);
    if (!result?.ok) { setError('Не удалось отметить сообщения прочитанными. Повторите.'); return; }
    router.refresh();
  }
  return <section className='mx-auto w-full max-w-[1200px]'>
    <nav aria-label='Разделы уведомлений' className='admin-section-tabs mb-4'>
      {([{ key: 'attention', label: 'Требуют внимания', count: initialAttention.length }, { key: 'history', label: 'История' }, { key: 'system', label: 'Система', count: technicalCount }] as const).map(tab =>
        <button key={tab.key} type='button' aria-current={view === tab.key ? 'page' : undefined} className='admin-section-tab' onClick={() => { setShown(PAGE_SIZE); router.push(`/admin/inbox?view=${tab.key}`); }}>{tab.label}{'count' in tab && tab.count > 0 && <span className='admin-section-tab-count'>{tab.count}</span>}</button>)}
    </nav>
    <div className='overflow-hidden rounded-2xl border border-slate-200 bg-white'>
      <div className='flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4'>
        <div><h2 className='font-bold text-slate-950'>{view === 'attention' ? `Нерешённых дел: ${initialAttention.length}` : view === 'system' ? 'Работа системы' : 'История рабочих сообщений'}</h2>
          <p className='mt-1 text-xs leading-relaxed text-slate-500'>{view === 'attention' ? 'Сначала ближайшие сроки и срочные заявки. Плановые оплаты — за день до срока.' : view === 'system' ? 'Короткие сбои — без push. Проблемы дольше часа объединяются в одно предупреждение; рабочие заявки остаются выше.' : 'Последние сообщения. Отметка «прочитано» не закрывает нерешённые дела.'}</p></div>
        {view !== 'attention' && unread && <button type='button' onClick={() => void markAll()} className='flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600'><CheckCheck className='h-4 w-4' />Прочитать историю</button>}
      </div>
      {view === 'system' && <button type='button' aria-expanded={showSystemHistory} onClick={() => { setShowSystemHistory(v => !v); setShown(PAGE_SIZE); }} className='mx-5 my-3 text-xs font-semibold text-[#925b38]'>{showSystemHistory ? 'Показать только активные сбои' : 'Открыть журнал сбоев, восстановлений и проверок'}</button>}
      {error && <p role='alert' className='px-5 py-3 text-sm text-rose-700'>{error}</p>}
      {!items.length ? <div className='px-6 py-14 text-center'><Bell className='mx-auto h-8 w-8 text-[#a66d45]' /><p className='mt-3 font-semibold text-slate-900'>{view === 'attention' ? 'Сейчас нет дел, требующих решения' : view === 'system' && !showSystemHistory ? 'Активных сбоев нет' : 'Сообщений пока нет'}</p><p className='mt-1 text-sm text-slate-500'>{view === 'attention' ? 'Срочные заявки появятся сразу, плановые оплаты — за день до срока. Все планы доступны в закупках.' : 'Новые события появятся в этом разделе.'}</p></div> :
        <div className='divide-y divide-slate-100'>{items.slice(0, shown).map(item => <button key={item.id} type='button' onClick={() => void open(item)} className='flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-[#faf7f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a66d45] sm:px-5'>
          <div className='min-w-0 flex-1'><div className='flex flex-wrap items-center gap-x-3 gap-y-1'><span className='text-sm font-bold text-slate-950'>{item.event.title}</span>{(view === 'system' && !showSystemHistory) && <span className='text-[11px] font-semibold text-[#925b38]'>{item.sourceState.label}</span>}</div>
          <p className='mt-1 max-w-[850px] break-words text-sm leading-relaxed text-slate-600'>{item.event.body}</p>
          <p className='mt-1.5 text-xs text-slate-400'>{when(item.event.occurredAt)}{view !== 'attention' && ` · ${item.meta.typeLabel}`}</p></div><ChevronRight className='h-4 w-4 shrink-0 text-[#a66d45]' />
        </button>)}</div>}
      {shown < items.length && <button type='button' onClick={() => setShown(n => n + PAGE_SIZE)} className='block w-full border-t border-slate-100 px-4 py-3 text-sm font-semibold text-[#925b38]'>Показать ещё · осталось {items.length - shown}</button>}
    </div>
  </section>;
}
