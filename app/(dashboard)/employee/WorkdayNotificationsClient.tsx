'use client';
import { EmployeeNotificationInbox, type EmployeeInboxItem } from '@/components/workday/EmployeeNotificationInbox';
import { EMPLOYEE_EXPENSE_KIND } from '@/lib/employee-expense-policy';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Bell, X } from 'lucide-react';
import {acknowledgeEmployeeNotification,isNewEmployeeNotification} from '@/lib/employee-inbox-view';
import { syncPwaAppBadge } from '@/lib/pwa-app-badge';
import { cn } from '@/lib/utils';
import { useCashIssue } from './CashIssueClient';
import { CASH_ISSUE_KIND } from '@/lib/procurement-cash-issue-policy';
import {employeeNotificationOpening,safeNotificationHref} from '@/lib/notification-opening';
import {NotificationRecordDialog,type NotificationSelection} from '@/components/NotificationRecordDialog';

type WorkdayNotification = EmployeeInboxItem;

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function WorkdayNotificationsClient() {
  const preview = useEmployeePreview();
  const requestRead = preview?.request ?? fetch;
  const router = useRouter();
  const cashIssue = useCashIssue();
  const [notifications, setNotifications] = useState<WorkdayNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [pushConnected, setPushConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected,setSelected]=useState<NotificationSelection|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inboxError,setInboxError]=useState('');
  const [readError,setReadError]=useState('');
  const [loading,setLoading]=useState(true);
  const knownIds = useRef<Set<string> | null>(null);
  const refreshSequence = useRef(0);
  const failedRead=useRef<WorkdayNotification|null>(null);
  const [banner, setBanner] = useState<WorkdayNotification | null>(null);
  const unreadCount = notifications.filter(isNewEmployeeNotification).length;

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const response = await requestRead('/api/employee/workday-notifications', { cache: 'no-store' }).catch(() => null);
    const payload=response?.ok?await response.json().catch(()=>null):null;
    if(sequence!==refreshSequence.current)return;
    setLoading(false);
    if(!Array.isArray(payload?.notifications)){setInboxError('Не удалось обновить уведомления. Показан последний загруженный список.');return;}
    setInboxError('');
    const nextNotifications=payload.notifications as WorkdayNotification[];
    const fresh = nextNotifications.find(item => isNewEmployeeNotification(item) && knownIds.current && !knownIds.current.has(`${item.id}:${item.sentAt ?? ""}`));
    knownIds.current = new Set(nextNotifications.map(item => `${item.id}:${item.sentAt ?? ""}`));
    if (fresh && !document.querySelector('[role="dialog"], dialog[open]') && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName ?? '')) setBanner(fresh);
    setNotifications(nextNotifications);
    if (!preview) void syncPwaAppBadge(nextNotifications.filter(isNewEmployeeNotification).length);
  }, [preview,requestRead]);

  const connectPush = useCallback(async (requestPermission: boolean) => {
    if (preview) return;
    setBusy(true);
    setError('');
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Уведомления не поддерживаются на этом устройстве.');
      const nextPermission = requestPermission ? await Notification.requestPermission() : Notification.permission;
      setPermission(nextPermission);
      if (nextPermission !== 'granted') throw new Error('Разрешите уведомления в настройках устройства.');
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
    if (preview) { void refresh(); const timer = window.setInterval(() => void refresh(), 10000); return () => window.clearInterval(timer); }
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/workday-sw.js', { scope: '/' }).catch(() => undefined);
    }
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    const currentPermission = supported ? Notification.permission : 'unsupported';
    setPermission(currentPermission);
    if (currentPermission === 'granted') void connectPush(false);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [connectPush, refresh]);

  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(() => setBanner(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [banner]);

  async function dismiss(notification: WorkdayNotification) {
    if (preview) return;
    const response = await fetch('/api/employee/workday-notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: notification.id }),
    }).catch(() => null);
    if (!response?.ok){failedRead.current=notification;setReadError('Не удалось отметить сообщение прочитанным. Повторите попытку.');return;}
    failedRead.current=null;
    setReadError('');
    refreshSequence.current++;
    setNotifications(current=>{
      const next=acknowledgeEmployeeNotification(current,notification,new Date().toISOString());
      void syncPwaAppBadge(next.filter(isNewEmployeeNotification).length);
      return next;
    });
  }

  async function openNotification(notification: WorkdayNotification) {
    setBanner(null);
    if (notification.active === false && employeeNotificationOpening(notification) === 'page') { void dismiss(notification); return; }
    if (notification.kind === EMPLOYEE_EXPENSE_KIND || notification.issueId || notification.reviewId) {
      setOpen(false); void dismiss(notification);
      const kind = notification.kind === EMPLOYEE_EXPENSE_KIND ? 'cash' : notification.attentionKind ?? 'receipt';
      const id = notification.issueId ? `issue:${notification.issueId}` : notification.reviewId ? `review:${notification.reviewId}` : 'expense:payable';
      if (window.location.pathname === '/employee') requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('mobo:attention-open', { detail: { kind, id } })));
      else router.push(`/employee?attention=${kind}&item=${encodeURIComponent(id)}`);
      return;
    }
    if (preview) { setOpen(false); setSelected({ ...notification, audience: "employee" }); return; }
    if (notification.kind === CASH_ISSUE_KIND && cashIssue) {
      const ref = new URL(notification.href, window.location.origin).searchParams.get('request');
      if (ref) { setOpen(false); cashIssue.open(ref); void dismiss(notification); return; }
    }
    setOpen(false);
    if(employeeNotificationOpening(notification)!=='page'){setSelected({...notification,audience:'employee'});return;}
    router.push(safeNotificationHref(notification.href,'/employee'));
    if (notification.kind !== CASH_ISSUE_KIND) void dismiss(notification);
  }

  return (
    <div className='relative'>
      {selected&&<NotificationRecordDialog readOnly={Boolean(preview)} key={selected.id} item={selected} onViewed={()=>{const n=notifications.find(n=>n.id===selected.id);if(n)void dismiss(n);}} onClose={()=>setSelected(null)}/>}
      <button
        type='button'
        onClick={() => { setBanner(null); setOpen(current => !current); void refresh(); }}
        className={cn('employee-material-header-action relative flex h-11 w-11 items-center justify-center rounded-full text-slate-600', open && 'is-open')}
        aria-label='Уведомления'
        aria-expanded={open}
      >
        <Bell className='h-[21px] w-[21px]' strokeWidth={2} />
        {unreadCount > 0 && (
          <span className='absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e4534d] px-1 text-[10px] font-black text-white ring-2 ring-[#f5f4ef] shadow-[0_3px_8px_rgba(135,48,43,0.28)]'>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {banner && !open && createPortal(<div className="employee-new-notice fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[140] mx-auto flex max-w-[488px] items-center gap-2 rounded-2xl bg-[#f5f4ef] p-3 text-slate-800 shadow-xl" role="status"><Bell size={20} className="shrink-0 text-[#a77550]"/><button type="button" className="min-w-0 flex-1 text-left text-sm font-semibold" onClick={() => void openNotification(banner)}>{banner.title}</button><button type="button" onClick={() => setBanner(null)} aria-label="Скрыть уведомление" className="p-2"><X size={18}/></button></div>, document.body)}
      {open && <EmployeeNotificationInbox items={notifications} loading={loading} error={inboxError||readError} onRetry={()=>{if(!inboxError&&failedRead.current)void dismiss(failedRead.current);else void refresh();}} onClose={() => setOpen(false)} onChoose={item => void openNotification(item)} permission={<>
{!preview && !pushConnected && (
            <div className='employee-material-notification-permission border-b border-slate-200 bg-slate-50 px-4 py-3.5'>
              <p className='text-sm font-semibold leading-snug text-slate-800'>Включите напоминания, чтобы не пропустить действие по рабочему дню.</p>
              <button type='button' disabled={busy || permission === 'unsupported'} onClick={() => void connectPush(true)} className='employee-material-green-action mt-3 rounded-lg bg-green-700 px-3.5 py-2.5 text-sm font-bold text-white disabled:opacity-50'>
                {busy ? 'Подключаем…' : permission === 'granted' ? 'Подключить уведомления' : 'Разрешить уведомления'}
              </button>
              {error && <p className='mt-2 text-xs font-bold text-rose-700'>{error}</p>}
            </div>
          )}
      </>}/>}
    </div>
  );
}
