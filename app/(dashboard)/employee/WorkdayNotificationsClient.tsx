'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';

type WorkdayNotification = {
  id: number;
  title: string;
  body: string;
  readAt: string | null;
};

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function WorkdayNotificationsClient() {
  const [notification, setNotification] = useState<WorkdayNotification | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const response = await fetch('/api/employee/workday-notifications', { cache: 'no-store' }).catch(() => null);
    if (!response?.ok) return;
    const payload = await response.json();
    const unread = Array.isArray(payload.notifications)
      ? payload.notifications.find((item: WorkdayNotification) => !item.readAt) ?? null
      : null;
    setNotification(unread);
  }, []);

  useEffect(() => {
    setPermission('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window ? Notification.permission : 'unsupported');
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function enablePush() {
    setBusy(true);
    setError('');
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Уведомления не поддерживаются на этом устройстве.');
      const nextPermission = await Notification.requestPermission();
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось включить уведомления.');
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    if (!notification) return;
    const id = notification.id;
    setNotification(null);
    await fetch('/api/employee/workday-notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => null);
  }

  return (
    <>
      {permission !== 'granted' && (
        <div className='mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-950'>
          <div className='flex items-start gap-2'>
            <BellOff className='mt-0.5 h-4 w-4 shrink-0' />
            <div className='min-w-0 flex-1'>
              <p className='text-sm font-extrabold'>Включите напоминания</p>
              <p className='mt-0.5 text-xs font-semibold leading-snug text-blue-800'>Портал напомнит о проверках вашей смены. На iPhone откройте установленное приложение OFFONIKA.</p>
              <button type='button' disabled={busy || permission === 'unsupported'} onClick={() => void enablePush()} className='mt-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50'>
                {busy ? 'Подключаем…' : 'Разрешить уведомления'}
              </button>
              {error && <p className='mt-2 text-xs font-bold text-rose-700'>{error}</p>}
            </div>
          </div>
        </div>
      )}
      {notification && (
        <div className='mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950'>
          <div className='flex items-start gap-2'>
            <Bell className='mt-0.5 h-4 w-4 shrink-0' />
            <div className='min-w-0 flex-1'>
              <p className='text-sm font-extrabold'>{notification.title}</p>
              <p className='mt-0.5 text-xs font-semibold leading-snug text-amber-900'>{notification.body}</p>
            </div>
            <button type='button' onClick={() => void dismiss()} aria-label='Закрыть уведомление' className='rounded-md p-1 text-amber-800'><X className='h-4 w-4' /></button>
          </div>
        </div>
      )}
    </>
  );
}
