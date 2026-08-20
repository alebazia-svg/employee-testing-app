'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, ChevronRight } from 'lucide-react';
import type { AdminInboxViewItem } from '@/lib/admin-inbox-data';

type Filter = 'all' | 'unread' | 'decisions' | 'messages' | 'requests' | 'system';
const PAGE_SIZE = 30;

const filters: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'Все' }, { key: 'unread', label: 'Новые' }, { key: 'decisions', label: 'Мои решения' },
  { key: 'messages', label: 'Сообщения' }, { key: 'requests', label: 'Заявки' }, { key: 'system', label: 'Система' },
];

function when(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(date);
}

function stateClass(tone: AdminInboxViewItem['sourceState']['tone']) {
  if (tone === 'attention') return 'bg-amber-100 text-amber-800';
  if (tone === 'active') return 'bg-blue-100 text-blue-800';
  if (tone === 'resolved') return 'bg-green-100 text-green-800';
  return 'bg-slate-100 text-slate-600';
}

export function AdminInboxListClient({ initialItems }: { initialItems: AdminInboxViewItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PAGE_SIZE);
  const unread = items.filter((item) => !item.readAt).length;
  const filtered = useMemo(() => items.filter((item) => filter === 'all' || (filter === 'unread' ? !item.readAt : item.meta.category === filter)), [filter, items]);
  const visible = filtered.slice(0, shown);

  async function markRead(id: string) {
    const item = items.find((candidate) => candidate.id === id);
    if (!item || item.readAt) return;
    const response = await fetch(`/api/admin/inbox/${encodeURIComponent(id)}/read`, { method: 'POST' });
    if (!response.ok) return;
    setItems((current) => current.map((candidate) => candidate.id === id ? { ...candidate, readAt: new Date().toISOString() } : candidate));
  }

  async function open(item: AdminInboxViewItem) {
    await markRead(item.id);
    router.push(item.event.href);
  }

  async function markAll() {
    const response = await fetch('/api/admin/inbox/read-all', { method: 'POST' });
    if (!response.ok) return;
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
  }

  return (
    <section className='mt-5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80'>
      <div className='border-b border-slate-200 px-4 py-4 sm:px-5'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div><h2 className='text-lg font-extrabold text-slate-950'>События</h2><p className='mt-1 text-xs font-medium text-slate-500'>Непрочитанных: {unread}</p></div>
          {unread > 0 && <button type='button' onClick={() => void markAll()} className='inline-flex w-fit items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white'><CheckCheck className='h-4 w-4' />Прочитать все</button>}
        </div>
        <div className='mt-4 flex gap-2 overflow-x-auto pb-1'>
          {filters.map((item) => <button key={item.key} type='button' onClick={() => { setFilter(item.key); setShown(PAGE_SIZE); }} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold transition ${filter === item.key ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{item.label}</button>)}
        </div>
      </div>
      {visible.length === 0 ? <div className='px-6 py-14 text-center'><Bell className='mx-auto h-10 w-10 text-slate-300' /><p className='mt-3 font-extrabold text-slate-950'>В этой категории событий нет</p></div> : (
        <><div className='divide-y divide-slate-100'>{visible.map((item) => (
          <div key={item.id} className={`flex items-start gap-3 px-4 py-4 sm:px-5 ${item.readAt ? 'bg-white' : 'bg-amber-50/55'}`}>
            <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? 'bg-slate-200' : 'bg-amber-400'}`} />
            <button type='button' onClick={() => void open(item)} className='min-w-0 flex-1 text-left'>
              <span className='flex flex-wrap items-center gap-2'><span className='text-sm font-extrabold text-slate-950'>{item.event.title}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${stateClass(item.sourceState.tone)}`}>{item.sourceState.label}</span></span>
              <span className='mt-1 block text-sm font-medium leading-relaxed text-slate-600'>{item.event.body}</span>
              <span className='mt-1 block text-xs font-semibold text-slate-400'>{when(item.event.occurredAt)} · {item.meta.typeLabel}</span>
              <span className='mt-2 block text-xs font-extrabold text-green-700'>{item.meta.actionLabel}</span>
            </button>
            {!item.readAt && <button type='button' onClick={() => void markRead(item.id)} title='Отметить прочитанным' className='rounded-lg p-2 text-slate-400 hover:bg-white hover:text-green-700'><Check className='h-4 w-4' /></button>}
            <button type='button' onClick={() => void open(item)} title='Открыть объект' className='rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-900'><ChevronRight className='h-4 w-4' /></button>
          </div>
        ))}</div>{shown < filtered.length && <div className='border-t border-slate-100 px-4 py-4 text-center'><button type='button' onClick={() => setShown((value) => value + PAGE_SIZE)} className='rounded-xl bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-700 transition hover:bg-slate-200'>Показать ещё {Math.min(PAGE_SIZE, filtered.length - shown)}</button></div>}</>
      )}
    </section>
  );
}
