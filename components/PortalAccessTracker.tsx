'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { portalDisplayMode } from '../lib/portal-display-mode';
import { appClientObservation, appStateEvent, acceptAppCommand } from '../lib/portal-app-client';
import { observationWithin } from '../lib/portal-observation-deadline';
import { collectDeviceObservation } from '../lib/portal-device-observation';

/** Observes existing permission/subscription only; never prompts or subscribes. */
export function PortalAccessTracker() {
  const path = usePathname();
  useEffect(() => {
    if (!/^\/(admin|employee|procurement)(\/|$)/.test(path)) return;
    let stopped = false, busy = false, lastAttempt = 0, dirty = true;
    let interactionAt = 0;
    // One bounded collection per mounted screen, never on every heartbeat.
    const deviceObservation = collectDeviceObservation(navigator);
    const interacted = (event: Event) => { if (event.isTrusted && document.visibilityState === 'visible') interactionAt = Date.now(); };
    // Only the timestamp; no key, pointer position, field value or business content.
    document.addEventListener('pointerdown', interacted, { passive: true });
    document.addEventListener('keydown', interacted, { passive: true });
    const abort = new AbortController();
    async function report() {
      if (stopped || busy || document.visibilityState !== 'visible' || Date.now() - lastAttempt < (dirty ? 5000 : 60000)) return;
      busy = true; dirty = false; lastAttempt = Date.now();
      const request = new AbortController();
      const cancel = () => request.abort(); abort.signal.addEventListener('abort', cancel);
      const timeout = window.setTimeout(cancel, 8000);
      let permission: string = 'unknown', endpoint: string | undefined;
      try {
        if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) permission = 'unsupported';
        else {
          permission = Notification.permission;
          const subscription = await observationWithin(async () => {
            const registration = await navigator.serviceWorker.getRegistration();
            return (await registration?.pushManager.getSubscription()) ?? null;
          }, undefined);
          // A timeout is unknown, not proof that the subscription is absent.
          if (subscription === undefined) permission = 'unknown';
          else endpoint = subscription?.endpoint;
        }
      } catch { permission = 'unknown'; }
      const displayMode = portalDisplayMode(query => window.matchMedia(query).matches, (navigator as Navigator & { standalone?: boolean }).standalone);
      try { if (!stopped) {
        const app = appClientObservation();
        const device = await deviceObservation;
        const response = await fetch('/api/auth/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permission, displayMode, device, ...(interactionAt && Date.now() - interactionAt < 120000 ? { interactionAt } : {}), ...(endpoint ? { endpoint } : {}), ...(app ? { app } : {}) }), signal: request.signal });
        if (response.ok && !stopped) acceptAppCommand((await response.json()).updateCommand);
        else dirty = true;
      } }
      catch { dirty = true; /* Retry without blocking the employee workflow. */ }
      finally { busy = false; window.clearTimeout(timeout); abort.signal.removeEventListener('abort', cancel); }
    }
    void report();
    const changed = () => { dirty = true; void report(); };
    window.addEventListener(appStateEvent, changed);
    const timer = window.setInterval(report, 5000);
    window.addEventListener('focus', report); document.addEventListener('visibilitychange', report);
    return () => { stopped = true; abort.abort(); window.clearInterval(timer); window.removeEventListener(appStateEvent, changed); window.removeEventListener('focus', report); document.removeEventListener('visibilitychange', report); document.removeEventListener('pointerdown', interacted); document.removeEventListener('keydown', interacted); };
  }, [path]);
  return null;
}
