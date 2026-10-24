'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useEmployeePreview } from './EmployeePreviewProvider';
import { activityRoute, type ActivitySection } from '@/lib/employee-activity-policy';

export function sendEmployeeActivity(input: { kind: 'visit'; section: ActivitySection } | { kind: 'notification_open'; notificationId: number }) {
  if (typeof window === 'undefined' || document.visibilityState !== 'visible' || !/^\/(employee|procurement)(\/|$)/.test(location.pathname)) return;
  // No durable offline queue: missing telemetry must never slow or retry financial actions.
  try {
    const key = crypto.randomUUID();
    void fetch('/api/employee/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, key }), keepalive: true, signal: AbortSignal.timeout(4000) }).catch(() => {});
  } catch { /* Older devices and blocked network do not affect the application. */ }
}
export function useEmployeeActivityVisit(section: ActivitySection | null, disabled = false) {
  const preview = useEmployeePreview();
  useEffect(() => {
    if (preview || disabled || !section) return;
    let sent = false;
    const record = () => {
      if (sent || document.visibilityState !== 'visible') return;
      sent = true;
      sendEmployeeActivity({ kind: 'visit', section });
    };
    // React development remount and very fast tab changes are not separate visits.
    const timer = window.setTimeout(record, 350);
    document.addEventListener('visibilitychange', record);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', record); };
  }, [section, disabled, preview]);
}
export function EmployeeActivityTracker() {
  useEmployeeActivityVisit(activityRoute(usePathname()));
  return null;
}
