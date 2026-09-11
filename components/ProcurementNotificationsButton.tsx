'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCircle2, ChevronRight, XCircle } from 'lucide-react';

type ProcurementNotification = {
  id: number;
  kind: string;
  title: string;
  body: string;
  href: string;
};

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function ProcurementNotificationsButton() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ProcurementNotification[]>([]);
  const [pushConnected, setPushConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const response = await fetch('/api/employee/workday-notifications', { cache: 'no-store' }).catch(() => null);
    if (!response?.ok) return;
    const payload = await response.json().catch(() => null);
    setItems(Array.isArray(payload?.notifications) ? payload.notifications : []);
  }, []);

  const connectPush = useCallback(async (requestPermission: boolean) => {
    setBusy(true);
    setError('');
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Уведомления не поддерживаются на этом устройстве.');
      }
      const permission = requestPermission ? await Notification.requestPermission() : Notification.permission;
      if (permission !== 'granted') throw new Error('Разрешите уведомления в настройках браузера.');
      const configResponse = await fetch('/api/employee/push-subscription', { cache: 'no-store' });
      const config = await configResponse.json();
      if (!configResponse.ok || !config.publicKey) throw new Error('Push-уведомления ещё не настроены.');
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
      if (!response.ok) throw new Error('Не удалось подключить уведомления.');
      setPushConnected(true);
    } catch (caught) {
      setPushConnected(false);
      if (requestPermission) setError(caught instanceof Error ? caught.message : 'Не удалось включить уведомления.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/workday-sw.js', { scope: '/' }).catch(() => undefined);
    if ('Notification' in window && Notification.permission === 'granted') void connectPush(false);
    const timer = window.setInterval(() => void refresh(), 30_000);
    function close(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('mousedown', close);
    };
  }, [connectPush, refresh]);

  async function openItem(item: ProcurementNotification) {
    setItems((current) => current.filter((notification) => notification.id !== item.id));
    await fetch('/api/employee/workday-notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    }).catch(() => null);
    setOpen(false);
    router.push(item.href || '/procurement');
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Уведомления"
        aria-expanded={open}
        className="admin-material-control procurement-notification-trigger relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 transition hover:-translate-y-0.5 hover:text-slate-950"
      >
        <Bell className="h-5 w-5" />
        {items.length > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-slate-950 ring-2 ring-[#f7faf8]">
            {items.length > 99 ? '99+' : items.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="admin-dialog-panel fixed inset-x-3 top-4 z-50 max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[min(92vw,390px)]">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="font-extrabold text-slate-950">Уведомления</p>
            <p className="text-xs font-medium text-slate-500">Решения по вашим оплатам</p>
          </div>
          {!pushConnected ? (
            <div className="border-b border-green-100 bg-green-50 px-4 py-3">
              <p className="text-xs font-bold leading-relaxed text-green-950">Узнавайте сразу, когда оплату согласовали или отменили.</p>
              <button type="button" disabled={busy} onClick={() => void connectPush(true)} className="admin-material-primary mt-2 rounded-lg px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50">
                {busy ? 'Подключаем…' : 'Включить уведомления'}
              </button>
              {error ? <p className="mt-2 text-xs font-bold text-rose-700">{error}</p> : null}
            </div>
          ) : null}
          {items.length ? (
            <div className="max-h-[360px] overflow-y-auto p-2.5">
              {items.map((item) => {
                const cancelled = item.kind === 'procurement_payment_cancelled';
                return (
                  <button key={item.id} type="button" onClick={() => void openItem(item)} className="admin-material-control mb-2 flex w-full items-start gap-3 rounded-xl bg-white px-3.5 py-3 text-left last:mb-0">
                    {cancelled ? <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold text-slate-950">{item.title}</span>
                      <span className="mt-0.5 block text-xs font-medium leading-relaxed text-slate-600">{item.body}</span>
                    </span>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                );
              })}
            </div>
          ) : <p className="px-5 py-8 text-center text-sm font-medium text-slate-500">Новых уведомлений нет.</p>}
        </div>
      ) : null}
    </div>
  );
}
