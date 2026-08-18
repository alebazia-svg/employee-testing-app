'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ChevronRight, X } from 'lucide-react';

type WorkdayNotification = {
  id: number;
  title: string;
  body: string;
  readAt: string | null;
  href: string;
};

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function syncAppBadge(count: number) {
  const badgeNavigator = navigator as BadgeNavigator;
  if (count > 0) void badgeNavigator.setAppBadge?.(count).catch(() => undefined);
  else void badgeNavigator.clearAppBadge?.().catch(() => undefined);
}

export function WorkdayNotificationsClient() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<WorkdayNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [pushConnected, setPushConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const response = await fetch('/api/employee/workday-notifications', { cache: 'no-store' }).catch(() => null);
    if (!response?.ok) return;
    const payload = await response.json();
    const nextNotifications = Array.isArray(payload.notifications)
      ? payload.notifications.filter((item: WorkdayNotification) => !item.readAt)
      : [];
    setNotifications(nextNotifications);
    syncAppBadge(nextNotifications.length);
  }, []);

  const connectPush = useCallback(async (requestPermission: boolean) => {
    setBusy(true);
    setError('');
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Уведомления не поддерживаются на этом устройстве.');
      const nextPermission = requestPermission ? await Notification.requestPermission() : Notification.permission;
      setPermission(nextPermission);
      if (nextPermission !== 'granted') throw new Error('Разрешите уведомления в настройках устройства.');
      const configResponse = await fetch('/api/employee/push-subscription', { cache: 'no-store' });
      const config = await configResponse.json();
      if (!configResponse.ok || !config.publicKey) throw new Error('Push-уведомления ещё не настроены администратором.');
      const registration = await navigator.serviceWorker.register('/workday-sw.js', { scope: '/' });
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });
      const response = await fetch('/api/employee/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
      if (!response.ok) throw new Error('Не удалось сохранить разрешение на уведомления.');
      setPushConnected(true);
    } catch (caught) {
      setPushConnected(false);
      setError(caught instanceof Error ? caught.message : 'Не удалось включить уведомления.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    const currentPermission = supported ? Notification.permission : 'unsupported';
    setPermission(currentPermission);
    if (currentPermission === 'granted') void connectPush(false);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [connectPush, refresh]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setOpen(false), 10_000);
    return () => window.clearTimeout(timer);
  }, [open]);

  async function dismiss(id: number) {
    setNotifications((current) => {
      const next = current.filter((notification) => notification.id !== id);
      syncAppBadge(next.length);
      return next;
    });
    await fetch('/api/employee/workday-notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => null);
  }

  async function openNotification(notification: WorkdayNotification) {
    await dismiss(notification.id);
    setOpen(false);
    router.push(notification.href || '/employee');
  }

  return (
    <div className='relative'>
      <button
        type='button'
        onClick={() => setOpen((current) => !current)}
        className='relative flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-white ring-1 ring-white/10 hover:bg-white/[0.12]'
        aria-label='Уведомления'
        aria-expanded={open}
      >
        <Bell className='h-[18px] w-[18px]' />
        {notifications.length > 0 && (
          <span className='absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-slate-950 ring-2 ring-[#111821]'>
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
        {!pushConnected && notifications.length === 0 && <span className='absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-[#111821]' />}
      </button>

      {open && (
        <div className='fixed inset-x-4 top-[6.5rem] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-80'>
          <div className='flex items-center justify-between border-b border-slate-100 px-4 py-3'>
            <p className='text-sm font-black'>Уведомления</p>
            <button type='button' onClick={() => setOpen(false)} className='rounded-md p-1 text-slate-500' aria-label='Закрыть уведомления'><X className='h-4 w-4' /></button>
          </div>

          {!pushConnected && (
            <div className='border-b border-blue-100 bg-blue-50 px-4 py-3'>
              <p className='text-xs font-bold text-blue-950'>Включите системные напоминания на этом устройстве.</p>
              <button type='button' disabled={busy || permission === 'unsupported'} onClick={() => void connectPush(true)} className='mt-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50'>
                {busy ? 'Подключаем…' : permission === 'granted' ? 'Подключить уведомления' : 'Разрешить уведомления'}
              </button>
              {error && <p className='mt-2 text-xs font-bold text-rose-700'>{error}</p>}
            </div>
          )}

          {notifications.length === 0 ? (
            <p className='px-4 py-5 text-center text-xs font-semibold text-slate-500'>Нет актуальных уведомлений</p>
          ) : (
            <div className='max-h-80 overflow-y-auto'>
              {notifications.map((notification) => (
                <button key={notification.id} type='button' onClick={() => void openNotification(notification)} className='flex w-full items-start gap-2 border-b border-slate-100 px-3 py-3 text-left last:border-b-0'>
                  <Bell className='mt-0.5 h-4 w-4 shrink-0 text-amber-600' />
                  <span className='min-w-0 flex-1'>
                    <p className='text-sm font-extrabold'>{notification.title}</p>
                    <p className='mt-0.5 text-xs font-semibold leading-snug text-slate-600'>{notification.body}</p>
                  </span>
                  <ChevronRight className='mt-0.5 h-4 w-4 shrink-0 text-slate-400' />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
