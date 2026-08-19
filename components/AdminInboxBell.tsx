'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';

type InboxItem = {
  id: string;
  readAt: string | null;
  event: { type: string; title: string; body: string; href: string; occurredAt: string };
  meta: { typeLabel: string; actionLabel: string; category: string };
  sourceState: { active: boolean; label: string; tone: string };
};

function when(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow',
  }).format(date);
}

export function AdminInboxBell() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  async function load() {
    const response = await fetch('/api/admin/inbox?limit=8', { cache: 'no-store' }).catch(() => null);
    const payload = response?.ok ? await response.json().catch(() => null) : null;
    if (payload) {
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setUnreadCount(Number(payload.unreadCount) || 0);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    function close(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => { window.clearInterval(timer); document.removeEventListener('mousedown', close); };
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/admin/inbox/${encodeURIComponent(id)}/read`, { method: 'POST' });
    setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    setUnreadCount((current) => Math.max(0, current - (items.find((item) => item.id === id)?.readAt ? 0 : 1)));
  }

  async function openItem(item: InboxItem) {
    if (!item.readAt) await markRead(item.id);
    setOpen(false);
    router.push(item.event.href);
  }

  async function markAll() {
    await fetch('/api/admin/inbox/read-all', { method: 'POST' });
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
  }

  return (
    <div ref={root} className='relative'>
      <button type='button' onClick={() => { setOpen((value) => !value); if (!open) void load(); }} aria-label='Уведомления администратора' className='relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200/80 transition hover:text-slate-950'>
        <Bell className='h-5 w-5' />
        {unreadCount > 0 && <span className='absolute -right-1 -top-1 min-w-5 rounded-full bg-amber-400 px-1.5 py-1 text-center text-[10px] font-extrabold leading-none text-slate-950 ring-2 ring-[#f7faf8]'>{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && (
        <div className='fixed inset-x-3 top-4 z-50 max-h-[calc(100vh-2rem)] w-auto overflow-hidden rounded-2xl bg-white text-left shadow-2xl ring-1 ring-slate-200 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:max-h-none sm:w-[min(92vw,400px)]'>
          <div className='flex items-center justify-between border-b border-slate-200 px-4 py-3'>
            <div><p className='font-extrabold text-slate-950'>Уведомления</p><p className='text-xs font-medium text-slate-500'>{unreadCount ? `Непрочитанных: ${unreadCount}` : 'Новых нет'}</p></div>
            {unreadCount > 0 && <button type='button' onClick={() => void markAll()} className='inline-flex items-center gap-1 text-xs font-bold text-green-700'><CheckCheck className='h-4 w-4' />Прочитать все</button>}
          </div>
          {items.length === 0 ? <p className='px-5 py-10 text-center text-sm font-medium text-slate-500'>Уведомлений пока нет.</p> : (
            <div className='max-h-[420px] divide-y divide-slate-100 overflow-y-auto'>{items.map((item) => (
              <button key={item.id} type='button' onClick={() => void openItem(item)} className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${item.readAt ? 'bg-white' : 'bg-amber-50/70'}`}>
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? 'bg-slate-200' : 'bg-amber-400'}`} />
                <span className='min-w-0 flex-1'><span className='block text-sm font-extrabold text-slate-950'>{item.event.title}</span><span className='mt-0.5 block text-xs font-medium leading-relaxed text-slate-600'>{item.event.body}</span><span className='mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-400'><span>{when(item.event.occurredAt)}</span><span>· {item.meta.typeLabel}</span>{item.sourceState.active && <span className='rounded-full bg-amber-100 px-1.5 py-0.5 font-extrabold text-amber-800'>{item.sourceState.label}</span>}</span></span>
                <ChevronRight className='mt-1 h-4 w-4 shrink-0 text-slate-400' />
              </button>
            ))}</div>
          )}
          <button type='button' onClick={() => { setOpen(false); router.push('/admin/inbox'); }} className='block w-full border-t border-slate-200 px-4 py-3 text-center text-sm font-bold text-green-700 hover:bg-slate-50'>Открыть историю уведомлений</button>
        </div>
      )}
    </div>
  );
}
