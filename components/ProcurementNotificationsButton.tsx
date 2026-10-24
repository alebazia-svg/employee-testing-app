'use client';
import { sendEmployeeActivity } from './EmployeeActivityTracker';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';
import { savePushSubscription } from '@/lib/push-subscription-client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import {EmployeeNotificationInbox,type EmployeeInboxItem} from './workday/EmployeeNotificationInbox';
import {acknowledgeEmployeeNotification,isNewEmployeeNotification} from '@/lib/employee-inbox-view';
import { syncPwaAppBadge } from '@/lib/pwa-app-badge';
import {employeeNotificationOpening,safeNotificationHref} from '@/lib/notification-opening';
import {NotificationRecordDialog,type NotificationSelection} from './NotificationRecordDialog';

type ProcurementNotification = EmployeeInboxItem;

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function ProcurementNotificationsButton() {
  const router = useRouter();
  const preview = useEmployeePreview();
  const refreshSequence = useRef(0);
  const failedRead=useRef<ProcurementNotification|null>(null);
  const [open, setOpen] = useState(false);
  const [selected,setSelected]=useState<NotificationSelection|null>(null);
  const [items, setItems] = useState<ProcurementNotification[]>([]);
  const [pushConnected, setPushConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inboxError,setInboxError]=useState('');
  const [readError,setReadError]=useState('');
  const [loading,setLoading]=useState(true);
  const unreadCount=items.filter(isNewEmployeeNotification).length;

  const refresh = useCallback(async () => {
    const sequence=++refreshSequence.current;
    const response = await (preview?.request ?? fetch)('/api/employee/workday-notifications', { cache: 'no-store' }).catch(() => null);
    const payload = response?.ok ? await response.json().catch(() => null) : null;
    if(sequence!==refreshSequence.current)return;
    setLoading(false);
    if(!Array.isArray(payload?.notifications)){setInboxError('Не удалось обновить уведомления. Показан последний загруженный список.');return;}
    setInboxError('');
    const nextItems:ProcurementNotification[]=payload.notifications;
    setItems(nextItems);
    if (!preview) void syncPwaAppBadge(nextItems.filter(isNewEmployeeNotification).length);
  }, [preview]);

  const connectPush = useCallback(async (requestPermission: boolean) => {
    if (preview) { preview.blocked(); return; }
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
      await savePushSubscription('/api/employee/push-subscription', subscription);
      setPushConnected(true);
    } catch (caught) {
      setPushConnected(false);
      if (requestPermission) setError(caught instanceof Error ? caught.message : 'Не удалось включить уведомления.');
    } finally {
      setBusy(false);
    }
  }, [preview]);

  useEffect(() => {
    void refresh();
    if (!preview && 'serviceWorker' in navigator) void navigator.serviceWorker.register('/workday-sw.js', { scope: '/' }).catch(() => undefined);
    if (!preview && 'Notification' in window && Notification.permission === 'granted') void connectPush(false);
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      window.clearInterval(timer);
      refreshSequence.current++;
    };
  }, [connectPush, refresh, preview]);

  async function openItem(item: ProcurementNotification) {
    if (!preview) sendEmployeeActivity({ kind: 'notification_open', notificationId: item.id });
    if(item.active===false&&employeeNotificationOpening(item)==='page'){void dismiss(item);return;}
    setOpen(false);
    if(preview || employeeNotificationOpening(item)!=='page'){setSelected({...item,audience:'employee'});return;}
    router.push(safeNotificationHref(item.href,'/procurement'));
    await dismiss(item);
  }
  async function dismiss(item:ProcurementNotification) {
    if (preview) return;
    const response=await fetch('/api/employee/workday-notifications', {
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id}),
    }).catch(()=>null);
    if(!response?.ok){failedRead.current=item;setReadError('Не удалось отметить сообщение прочитанным. Повторите попытку.');return;}
    failedRead.current=null;
    setReadError('');
    refreshSequence.current++;
    setItems((current) => {
      const next = acknowledgeEmployeeNotification(current,item,new Date().toISOString());
      void syncPwaAppBadge(next.filter(isNewEmployeeNotification).length);
      return next;
    });
  }

  return (
    <div className="relative">
      {selected&&<NotificationRecordDialog key={selected.id} item={selected} readOnly={!!preview} onViewed={()=>{const item=items.find(n=>n.id===Number(selected.id));if(item)void dismiss(item);}} onClose={()=>setSelected(null)}/>}
      <button
        type="button"
        onClick={() => {if (!open && !preview) sendEmployeeActivity({ kind: 'visit', section: 'notifications' });setOpen(true);void refresh();}}
        aria-label="Уведомления"
        aria-expanded={open}
        className="admin-material-control procurement-notification-trigger relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 transition hover:-translate-y-0.5 hover:text-slate-950"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-slate-950 ring-2 ring-[#f7faf8]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? <EmployeeNotificationInbox items={items} compact loading={loading} error={inboxError||readError} onRetry={()=>{if(!inboxError&&failedRead.current)void dismiss(failedRead.current);else void refresh();}} onClose={()=>setOpen(false)} onChoose={item=>void openItem(item)} permission={
          !preview && !pushConnected ? (
            <div className="border-b border-green-100 bg-green-50 px-4 py-3">
              <p className="text-xs font-bold leading-relaxed text-green-950">Узнавайте сразу, когда оплату согласовали или отменили.</p>
              <button type="button" disabled={busy} onClick={() => void connectPush(true)} className="admin-material-primary mt-2 rounded-lg px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50">
                {busy ? 'Подключаем…' : 'Включить уведомления'}
              </button>
              {error ? <p className="mt-2 text-xs font-bold text-rose-700">{error}</p> : null}
            </div>
          ) : null
      }/> : null}
    </div>
  );
}
