'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, ChevronRight } from 'lucide-react';

type Item = {
  id: string;
  readAt: string | null;
  event: { type: string; title: string; body: string; href: string; occurredAt: string };
};

function when(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow',
  }).format(date);
}
function eventType(value: string) {
  return ({ 'expense_request.created': 'Новая заявка на расход' } as Record<string, string>)[value] ?? value;
}

export function AdminInboxListClient({ initialItems }: { initialItems: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const unread = items.filter((item) => !item.readAt).length;

  async function markRead(id: string) {
    await fetch(`/api/admin/inbox/${encodeURIComponent(id)}/read`, { method: 'POST' });
    setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
  }

  async function open(item: Item) {
    if (!item.readAt) await markRead(item.id);
    router.push(item.event.href);
  }

  async function markAll() {
    await fetch('/api/admin/inbox/read-all', { method: 'POST' });
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
  }

  return (
    <section className='mt-5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80'>
      <div className='flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4'>
        <div><h2 className='text-lg font-extrabold text-slate-950'>Все события</h2><p className='mt-1 text-xs font-medium text-slate-500'>Непрочитанных: {unread}</p></div>
        {unread > 0 && <button type='button' onClick={() => void markAll()} className='inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white'><CheckCheck className='h-4 w-4' />Отметить все прочитанными</button>}
      </div>
      {items.length === 0 ? <div className='px-6 py-14 text-center'><Bell className='mx-auto h-10 w-10 text-slate-300' /><p className='mt-3 font-extrabold text-slate-950'>Событий пока нет</p></div> : (
        <div className='divide-y divide-slate-100'>{items.map((item) => (
          <div key={item.id} className={`flex items-start gap-3 px-5 py-4 ${item.readAt ? 'bg-white' : 'bg-amber-50/60'}`}>
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? 'bg-slate-200' : 'bg-amber-400'}`} />
            <button type='button' onClick={() => void open(item)} className='min-w-0 flex-1 text-left'>
              <span className='block text-sm font-extrabold text-slate-950'>{item.event.title}</span>
              <span className='mt-1 block text-sm font-medium leading-relaxed text-slate-600'>{item.event.body}</span>
              <span className='mt-1 block text-xs font-semibold text-slate-400'>{when(item.event.occurredAt)} · {eventType(item.event.type)}</span>
            </button>
            {!item.readAt && <button type='button' onClick={() => void markRead(item.id)} title='Отметить прочитанным' className='rounded-lg p-2 text-slate-400 hover:bg-white hover:text-green-700'><Check className='h-4 w-4' /></button>}
            <button type='button' onClick={() => void open(item)} title='Открыть объект' className='rounded-lg p-2 text-slate-400 hover:bg-white hover:text-slate-900'><ChevronRight className='h-4 w-4' /></button>
          </div>
        ))}</div>
      )}
    </section>
  );
}
