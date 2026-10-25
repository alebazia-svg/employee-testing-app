'use client';
import { useEffect, useRef } from 'react';
import { useEmployeePreview } from './EmployeePreviewProvider';
import { sendEmployeeActivity } from './EmployeeActivityTracker';
import type { HandoverClientStage } from '@/lib/employee-handover-audit-policy';

/** Observe only an explicitly instrumented message, not the whole screen. */
export function HandoverAuditShown({ taskId, attemptId, stage }: { taskId: number; attemptId?: string; stage: HandoverClientStage }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const preview = useEmployeePreview();
  useEffect(() => {
    if (preview) return;
    const element = anchor.current?.parentElement;
    if (!element) return;
    let sent = false;
    const record = () => {
      if (sent || document.visibilityState !== 'visible') return;
      const r = element.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom <= 0 || r.top >= window.innerHeight) return;
      try {
        const id = attemptId || crypto.randomUUID();
        sendEmployeeActivity({ kind: 'handover', context: { taskId, attemptId: id, stage } });
        sent = true;
      } catch { /* Viewing a message never depends on telemetry. */ }
    };
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) record(); });
    observer.observe(element);
    document.addEventListener('visibilitychange', record);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', record); };
  }, [taskId, attemptId, stage, preview]);
  return <span ref={anchor} hidden aria-hidden="true" />;
}
