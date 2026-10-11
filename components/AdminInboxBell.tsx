'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ChevronRight, X } from 'lucide-react';
import { syncPwaAppBadge } from '@/lib/pwa-app-badge';
import { startVisibleSync } from '@/lib/visible-sync';

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
  const [groups, setGroups] = useState({ expenses: 0, accountable: 0, procurement: 0, other: 0 });
  const [technicalCount, setTechnicalCount] = useState(0);
  const [pushConnected, setPushConnected] = useState(false);
  const [pushRegistrationAllowed, setPushRegistrationAllowed] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');

  async function connectPush(requestPermission: boolean) {
    setPushBusy(true);
    setPushError('');
    try {
      const configResponse = await fetch('/api/admin/push-subscription', { cache: 'no-store' });
      const config = await configResponse.json();
      if (!configResponse.ok) throw new Error('Push-уведомления ещё не настроены.');
      if (config.registrationAllowed === false) {
        setPushRegistrationAllowed(false);
        return;
      }
      setPushRegistrationAllowed(true);
      if (!config.publicKey) { setPushRegistrationAllowed(false); return; }
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Уведомления не поддерживаются на этом устройстве.');
      const permission = requestPermission ? await Notification.requestPermission() : Notification.permission;
      if (permission !== 'granted') throw new Error('Разрешите уведомления в настройках устройства.');
      const registration = await navigator.serviceWorker.register('/workday-sw.js', { scope: '/' });
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.publicKey) });
      const response = await fetch('/api/admin/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
      if (!response.ok) throw new Error('Не удалось сохранить разрешение на уведомления.');
      setPushConnected(true);
      void load();
    } catch (error) {
      setPushConnected(false);
      if (requestPermission) setPushError(error instanceof Error ? error.message : 'Не удалось включить уведомления.');
    } finally {
      setPushBusy(false);
    }
  }

  async function load() {
    const response = await fetch('/api/admin/inbox?view=attention&limit=8', { cache: 'no-store' }).catch(() => null);
    const payload = response?.ok ? await response.json().catch(() => null) : null;
    if (payload) {
      setItems(Array.isArray(payload.items) ? payload.items : []);
      const nextUnreadCount = Number(payload.attentionCount) || 0;
      setUnreadCount(nextUnreadCount);
      setTechnicalCount(Number(payload.technicalCount) || 0);
      if (payload.groups) setGroups(payload.groups);
      void syncPwaAppBadge(nextUnreadCount);
      if (nextUnreadCount === 0 && 'serviceWorker' in navigator) navigator.serviceWorker.controller?.postMessage({ type: 'ADMIN_ATTENTION_CLEARED' });
    }
  }

  useEffect(() => {
    const stopVisibleSync = startVisibleSync(load, 60_000);
    void connectPush(false);
    function close(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', escape);
    document.addEventListener('mousedown', close);
    return () => { document.removeEventListener('keydown', escape); stopVisibleSync(); document.removeEventListener('mousedown', close); };
  }, []);

  async function openItem(item: InboxItem) {
    if (!item.readAt) await fetch(`/api/admin/inbox/${encodeURIComponent(item.id)}/read`, { method: 'POST' });
    // Reading never resolves the underlying business task or clears its badge.
    setOpen(false);
    router.push(item.event.href);
  }

  return (
    <div ref={root} className='relative'>
      <button type='button' onClick={() => { setOpen((value) => !value); if (!open) void load(); }} aria-label='Уведомления администратора' className='admin-material-control relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 transition hover:-translate-y-0.5 hover:text-slate-950'>
        <Bell className='h-5 w-5' />
        {unreadCount > 0 && <span className='absolute -right-1 -top-1 min-w-5 rounded-full bg-amber-400 px-1.5 py-1 text-center text-[10px] font-extrabold leading-none text-slate-950 ring-2 ring-[#f7faf8]'>{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && (
        <div className='admin-dialog-panel fixed flex flex-col inset-x-3 top-4 z-50 max-h-[calc(100vh-2rem)] w-auto overflow-hidden rounded-2xl bg-white text-left ring-1 ring-slate-200 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:max-h-[calc(100dvh-7rem)] sm:w-[min(92vw,400px)]'>
          <div className='flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3'>
            <div><p className='font-extrabold text-slate-950'>Требуют внимания</p><p className='text-xs font-medium text-slate-500'>{unreadCount ? `Нерешённых дел: ${unreadCount}` : 'Всё обработано'}</p></div>
            <button type='button' onClick={() => setOpen(false)} aria-label='Закрыть уведомления' className='rounded-lg p-2 text-slate-500 hover:bg-slate-100'><X className='h-4 w-4' /></button>
          </div>
          {unreadCount > 0 && <p className='border-b border-slate-100 px-4 py-2 text-xs leading-relaxed text-slate-600'>{[groups.expenses && `Расход: ${groups.expenses}`, groups.accountable && `Подотчёт: ${groups.accountable}`, groups.procurement && `Закупки: ${groups.procurement}`, groups.other && `Другие дела: ${groups.other}`].filter(Boolean).join(' · ')}</p>}
          {pushRegistrationAllowed && !pushConnected && (
            <div className='border-b border-[#d8dfe8] bg-[#f2f5f9] px-4 py-3'>
              <p className='text-xs font-bold leading-relaxed text-[#263b5c]'>Получайте новые заявки и запросы сотрудников, даже когда портал закрыт.</p>
              <button type='button' disabled={pushBusy} onClick={() => void connectPush(true)} className='admin-material-primary mt-2 rounded-lg px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50'>{pushBusy ? 'Подключаем…' : 'Включить уведомления'}</button>
              {pushError && <p className='mt-2 text-xs font-bold text-rose-700'>{pushError}</p>}
            </div>
          )}
          {items.length === 0 ? <p className='px-5 py-10 text-center text-sm font-medium text-slate-500'>Нерешённых дел нет.</p> : (
            <div className='min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5'>{items.map((item) => (
              <button key={item.id} type='button' onClick={() => void openItem(item)} className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition hover:-translate-y-0.5 ${item.readAt ? 'admin-material-control border-white/80 bg-white' : 'border-amber-200 bg-amber-50/80 shadow-[3px_4px_10px_rgba(120,92,28,0.12),inset_0_1px_rgba(255,255,255,0.7)]'}`}>
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? 'bg-slate-200' : 'bg-amber-400'}`} />
                <span className='min-w-0 flex-1'><span className='block text-sm font-extrabold text-slate-950'>{item.event.title}</span><span className='mt-0.5 line-clamp-2 text-xs font-medium leading-relaxed text-slate-600'>{item.event.body}</span><span className='mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-400'><span>{when(item.event.occurredAt)}</span><span>· {item.meta.typeLabel}</span></span></span>
                <ChevronRight className='mt-1 h-4 w-4 shrink-0 text-[#a66d45]' />
              </button>
            ))}</div>
          )}
          <button type='button' onClick={() => { setOpen(false); router.push('/admin/inbox?view=attention'); }} className='mx-3 mb-2 shrink-0 block w-[calc(100%_-_1.5rem)] rounded-xl border border-[#d7b99f] px-4 py-2.5 text-center text-sm font-bold text-[#925b38] hover:bg-[#faf5f0]'>Все дела{unreadCount > 8 ? ` (${unreadCount})` : ''}</button>
          <button type='button' onClick={() => { setOpen(false); router.push('/admin/inbox?view=system'); }} className='mb-3 block w-full shrink-0 px-4 py-1 text-center text-xs text-slate-500 hover:text-slate-900'>Система{technicalCount ? ` · сбоев: ${technicalCount}` : ' · активных сбоев нет'}</button>
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
