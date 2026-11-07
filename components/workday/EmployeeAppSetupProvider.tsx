'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { EmployeeAppSetupContext } from './EmployeeAppSetupContext';
import { employeeAppSetupState } from '@/lib/employee-app-setup-state';
import { portalDisplayMode } from '@/lib/portal-display-mode';
import { connectEmployeePush } from '@/lib/employee-push-connection';
import { reportEmployeeUi, clearEmployeeUi } from '@/lib/employee-ui-client';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';

type Facts = { ios: boolean; isPhone: boolean; inApp: boolean; supported: boolean; online: boolean; permission: NotificationPermission | 'unsupported' };
function facts(): Facts {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  return { ios, isPhone: ios || /Android/.test(navigator.userAgent), inApp: portalDisplayMode(q => matchMedia(q).matches, (navigator as Navigator & { standalone?: boolean }).standalone) === 'app', supported, online: navigator.onLine, permission: supported ? Notification.permission : 'unsupported' };
}
export function EmployeeAppSetupProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const preview = useEmployeePreview();
  const [device, setDevice] = useState<Facts | null>(null);
  const [connected, setConnected] = useState(false), [busy, setBusy] = useState(false), [checking, setChecking] = useState(true), [error, setError] = useState('');
  const active = useRef(false), flight = useRef<AbortController | null>(null), knownConnection = useRef(false);
  const connect = useCallback(async (requestPermission: boolean) => {
    if (!active.current || flight.current) return;
    const controller = new AbortController(); flight.current = controller;
    setBusy(true); setError('');
    try {
      await connectEmployeePush(requestPermission, controller.signal);
      if (active.current && !controller.signal.aborted) { knownConnection.current = true; setConnected(true); }
    } catch (e) {
      if (active.current && !controller.signal.aborted) { knownConnection.current = false; setConnected(false); setError(e instanceof Error ? e.message : 'Не удалось подключить уведомления. Повторите попытку.'); }
    } finally {
      if (flight.current === controller) {
        flight.current = null;
        if (active.current) { setDevice(facts()); setBusy(false); setChecking(false); }
      }
    }
  }, []);
  useEffect(() => {
    if (!enabled || preview) return;
    active.current = true;
    const observe = async () => {
      if (document.visibilityState === 'hidden') return;
      const next = facts(); setDevice(next);
      if (next.permission !== 'granted') { knownConnection.current = false; setConnected(false); }
      if (next.supported && next.online && next.permission === 'granted' && !(next.ios && !next.inApp)) {
        if (knownConnection.current) {
          try {
            const registration = await navigator.serviceWorker.getRegistration('/');
            const subscription = await registration?.pushManager.getSubscription();
            if (!active.current) return;
            if (subscription) return;
          } catch { if (!active.current) return; }
          knownConnection.current = false; setConnected(false);
        }
        void connect(false);
      }
      else setChecking(false);
    };
    observe();
    const display = matchMedia('(display-mode: standalone)'); display.addEventListener('change', observe);
    for (const name of ['focus','pageshow','online','offline']) window.addEventListener(name, observe);
    document.addEventListener('visibilitychange', observe);
    return () => { active.current = false; flight.current?.abort(); flight.current = null; display.removeEventListener('change', observe); for (const name of ['focus','pageshow','online','offline']) window.removeEventListener(name, observe); document.removeEventListener('visibilitychange', observe); };
  }, [enabled, preview, connect]);
  const state = device ? employeeAppSetupState({ ...device, connected, checking }) : 'checking';
  useEffect(()=>{
    if(!enabled||preview||!device)return;
    reportEmployeeUi({setup:state,busy,error,online:device.online});
  },[enabled,Boolean(preview),device,state,busy,error]);
  useEffect(()=>()=>{if(!preview)clearEmployeeUi();},[Boolean(preview)]);
  const observed = preview?.deviceSnapshot?.connections.find(c=>c.id===preview.deviceSnapshot?.selectedId);
  const presentation = preview ? {state:observed?.state ?? 'checking' as const,isPhone:observed?.isPhone,isIos:observed?.isIos,busy:observed?.runtime?.busy,error:observed?.runtime?.error ?? undefined,finishProposal:true,previousDayCard:true,enable:preview.blocked}
    : {state,isPhone:device?.isPhone,isIos:device?.ios,finishProposal:true,previousDayCard:true,busy,error,enable:()=>void connect(true)};
  return <EmployeeAppSetupContext.Provider value={enabled ? presentation : null}>{children}</EmployeeAppSetupContext.Provider>;
}
