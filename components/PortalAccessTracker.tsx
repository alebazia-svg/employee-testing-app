'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Observes existing permission/subscription only; never prompts or subscribes. */
export function PortalAccessTracker() {
  const path = usePathname();
  useEffect(() => {
    if (!/^\/(admin|employee|procurement)(\/|$)/.test(path)) return;
    let stopped = false, busy = false, lastAttempt = 0;
    const abort = new AbortController();
    async function report() {
      if (stopped || busy || document.visibilityState !== 'visible' || Date.now() - lastAttempt < 60000) return;
      busy = true; lastAttempt = Date.now();
      let permission: string = 'unknown', endpoint: string | undefined;
      try {
        if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) permission = 'unsupported';
        else {
          permission = Notification.permission;
          const registration = await navigator.serviceWorker.getRegistration();
          endpoint = (await registration?.pushManager.getSubscription())?.endpoint;
        }
      } catch { permission = 'unknown'; }
      try { if (!stopped) await fetch('/api/auth/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permission, ...(endpoint ? { endpoint } : {}) }), signal: abort.signal }); }
      catch { /* Optional journal cannot block the employee workflow. */ }
      finally { busy = false; }
    }
    void report();
    const timer = window.setInterval(report, 60000);
    window.addEventListener('focus', report); document.addEventListener('visibilitychange', report);
    return () => { stopped = true; abort.abort(); window.clearInterval(timer); window.removeEventListener('focus', report); document.removeEventListener('visibilitychange', report); };
  }, [path]);
  return null;
}
