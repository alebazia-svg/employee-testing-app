import { savePushSubscription } from './push-subscription-client';

function vapidBytes(value: string) {
  const padded = value + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}
function assertCurrent(signal: AbortSignal, observe?: (stage:'permission_granted'|'permission_denied'|'permission_default')=>void) { if (signal.aborted) throw new DOMException('Cancelled', 'AbortError'); }
/** Existing push registration/save flow, with one owner and cancellation on account departure. */
export async function connectEmployeePush(requestPermission: boolean, signal: AbortSignal, observe?: (stage:'permission_granted'|'permission_denied'|'permission_default')=>void) {
  assertCurrent(signal);
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Уведомления недоступны на этом устройстве.');
  // Keep the permission call in the direct click chain; never request it on startup.
  const permission = requestPermission ? await Notification.requestPermission() : Notification.permission;
  assertCurrent(signal);
  if(requestPermission) { try { observe?.(permission==='granted'?'permission_granted':permission==='denied'?'permission_denied':'permission_default'); } catch {} }
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Разрешите уведомления в настройках устройства.' : 'Уведомления пока не включены.');
  const request = new AbortController();
  const abort = () => request.abort(); signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 10000);
  let publicKey: string;
  try {
    const response = await fetch('/api/employee/push-subscription', { cache: 'no-store', signal: request.signal });
    const config = await response.json();
    if (!response.ok || typeof config.publicKey !== 'string' || !config.publicKey) throw new Error('Не удалось подключить уведомления. Повторите попытку.');
    publicKey = config.publicKey;
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
  assertCurrent(signal);
  const registration = await navigator.serviceWorker.register('/workday-sw.js', { scope: '/' });
  assertCurrent(signal);
  const existing = await registration.pushManager.getSubscription();
  assertCurrent(signal);
  const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidBytes(publicKey) });
  assertCurrent(signal);
  return savePushSubscription('/api/employee/push-subscription', subscription, signal);
}
