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
  const [pushConnected, setPushConnected] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');

  async function connectPush(requestPermission: boolean) {
    setPushBusy(true);
    setPushError('');
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Уведомления не поддерживаются на этом устройстве.');
      const permission = requestPermission ? await Notification.requestPermission() : Notification.permission;
      if (permission !== 'granted') throw new Error('Разрешите уведомления в настройках устройства.');
      const configResponse = await fetch('/api/admin/push-subscription', { cache: 'no-store' });
      const config = await configResponse.json();
      if (!configResponse.ok || !config.publicKey) throw new Error('Push-уведомления ещё не настроены.');
      const registration = await navigator.serviceWorker.register('/workday-sw.js', { scope: '/' });
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.publicKey) });
      const response = await fetch('/api/admin/push-subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) });
      if (!response.ok) throw new Error('Не удалось сохранить разрешение на уведомления.');
      setPushConnected(true);
    } catch (error) {
      setPushConnected(false);
      if (requestPermission) setPushError(error instanceof Error ? error.message : 'Не удалось включить уведомления.');
    } finally {
      setPushBusy(false);
    }
  }

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
    if ('Notification' in window && Notification.permission === 'granted') void connectPush(false);
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
      <button type='button' onClick={() => { setOpen((value) => !value); if (!open) void load(); }} aria-label='Уведомления администратора' className='admin-material-control relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 transition hover:-translate-y-0.5 hover:text-slate-950'>
        <Bell className='h-5 w-5' />
        {unreadCount > 0 && <span className='absolute -right-1 -top-1 min-w-5 rounded-full bg-amber-400 px-1.5 py-1 text-center text-[10px] font-extrabold leading-none text-slate-950 ring-2 ring-[#f7faf8]'>{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && (
        <div className='admin-dialog-panel fixed inset-x-3 top-4 z-50 max-h-[calc(100vh-2rem)] w-auto overflow-hidden rounded-2xl bg-white text-left ring-1 ring-slate-200 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:max-h-none sm:w-[min(92vw,400px)]'>
          <div className='flex items-center justify-between border-b border-slate-200 px-4 py-3'>
            <div><p className='font-extrabold text-slate-950'>Уведомления</p><p className='text-xs font-medium text-slate-500'>{unreadCount ? `Непрочитанных: ${unreadCount}` : 'Новых нет'}</p></div>
            {unreadCount > 0 && <button type='button' onClick={() => void markAll()} className='admin-material-control inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-green-700'><CheckCheck className='h-4 w-4' />Прочитать все</button>}
          </div>
          {!pushConnected && (
            <div className='border-b border-green-100 bg-green-50 px-4 py-3'>
              <p className='text-xs font-bold leading-relaxed text-green-950'>Получайте новые заявки и запросы сотрудников, даже когда портал закрыт.</p>
              <button type='button' disabled={pushBusy} onClick={() => void connectPush(true)} className='admin-material-primary mt-2 rounded-lg px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50'>{pushBusy ? 'Подключаем…' : 'Включить уведомления'}</button>
              {pushError && <p className='mt-2 text-xs font-bold text-rose-700'>{pushError}</p>}
            </div>
          )}
          {items.length === 0 ? <p className='px-5 py-10 text-center text-sm font-medium text-slate-500'>Уведомлений пока нет.</p> : (
            <div className='max-h-[420px] space-y-2 overflow-y-auto p-2.5'>{items.map((item) => (
              <button key={item.id} type='button' onClick={() => void openItem(item)} className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition hover:-translate-y-0.5 ${item.readAt ? 'admin-material-control border-white/80 bg-white' : 'border-amber-200 bg-amber-50/80 shadow-[3px_4px_10px_rgba(120,92,28,0.12),inset_0_1px_rgba(255,255,255,0.7)]'}`}>
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? 'bg-slate-200' : 'bg-amber-400'}`} />
                <span className='min-w-0 flex-1'><span className='block text-sm font-extrabold text-slate-950'>{item.event.title}</span><span className='mt-0.5 block text-xs font-medium leading-relaxed text-slate-600'>{item.event.body}</span><span className='mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-400'><span>{when(item.event.occurredAt)}</span><span>· {item.meta.typeLabel}</span>{item.sourceState.active && <span className='rounded-full bg-amber-100 px-1.5 py-0.5 font-extrabold text-amber-800'>{item.sourceState.label}</span>}</span></span>
                <ChevronRight className='mt-1 h-4 w-4 shrink-0 text-slate-400' />
              </button>
            ))}</div>
          )}
          <button type='button' onClick={() => { setOpen(false); router.push('/admin/inbox'); }} className='admin-material-filter-active mx-3 mb-3 block w-[calc(100%_-_1.5rem)] rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-bold text-white transition hover:-translate-y-0.5'>Открыть историю уведомлений</button>
        </div>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}
