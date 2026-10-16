'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { createEmployeeAppUpdater, readAppRelease, type UpdateAttempt } from './employee-app-update';
import { startVisibleSync } from './visible-sync';

const attemptKey = 'employee-app-update-attempt';

/** Only the main workday screen opts in; detail forms never reload underneath their owner. */
export function useEmployeeAppUpdate(isSafe: () => boolean) {
  const safeRef = useRef(isSafe);
  useLayoutEffect(() => { safeRef.current = isSafe; });
  useEffect(() => {
    const current = readAppRelease({
      version: process.env.NEXT_PUBLIC_APP_VERSION,
      builtAt: process.env.NEXT_PUBLIC_APP_BUILT_AT,
    });
    if (!current) return;
    let lastInteraction = Date.now();
    let filePickerOpen = false;
    const touched = () => { lastInteraction = Date.now(); };
    const updater = createEmployeeAppUpdater(current, {
      now: Date.now,
      visible: () => document.visibilityState === 'visible' && navigator.onLine,
      safe: () => {
        if (filePickerOpen || !safeRef.current() || Date.now() - lastInteraction < 10_000) return false;
        if (document.activeElement?.matches('input:not([type="file"]),textarea,select,[contenteditable="true"]')) return false;
        // Includes dialogs owned by notification/cash components outside EmployeeTodayClient.
        return !Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"],dialog[open]'))
          .some(element => element.getClientRects().length > 0);
      },
      fetchRelease: async signal => {
        const response = await fetch('/release-info.json', { cache: 'no-store', signal });
        if (!response.ok) throw new Error('Release check unavailable');
        return response.json();
      },
      readAttempt: () => {
        const raw = sessionStorage.getItem(attemptKey);
        if (!raw) return null;
        try {
          const value = JSON.parse(raw) as UpdateAttempt;
          return typeof value?.target === 'string' && Number.isFinite(value.at) ? value : null;
        } catch { return null; }
      },
      saveAttempt: attempt => sessionStorage.setItem(attemptKey, JSON.stringify(attempt)),
      reload: () => window.location.reload(),
    });
    // A native camera can leave the document visible while it owns the screen.
    // Do not infer picker closure from focus: change/cancel is the authoritative signal.
    const pickerOpened = (event: Event) => {
      if (event.target instanceof HTMLInputElement && event.target.type === 'file') {
        filePickerOpen = true;
        touched();
      }
    };
    const pickerClosed = (event: Event) => {
      if (event.target instanceof HTMLInputElement && event.target.type === 'file') {
        filePickerOpen = false;
        touched();
      }
    };
    document.addEventListener('click', pickerOpened, true);
    document.addEventListener('change', pickerClosed, true);
    document.addEventListener('cancel', pickerClosed, true);
    // Capture interactions before React handlers, including native camera/file pickers.
    const events = ['pointerdown', 'pointerup', 'keydown', 'input', 'change', 'scroll', 'focusin'] as const;
    for (const event of events) document.addEventListener(event, touched, { capture: true, passive: true });
    window.addEventListener('focus', touched);
    document.addEventListener('visibilitychange', touched);
    const stop = startVisibleSync(updater.check, 60_000);
    const retry = window.setInterval(() => { void updater.retry(); }, 2_000);
    return () => {
      stop();
      updater.dispose();
      document.removeEventListener('click', pickerOpened, true);
      document.removeEventListener('change', pickerClosed, true);
      document.removeEventListener('cancel', pickerClosed, true);
      window.clearInterval(retry);
      for (const event of events) document.removeEventListener(event, touched, true);
      window.removeEventListener('focus', touched);
      document.removeEventListener('visibilitychange', touched);
    };
  }, []);
}
