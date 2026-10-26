'use client';
import { useEffect } from 'react';
import { useEmployeePreview } from './EmployeePreviewProvider';
import { sendEmployeeActivity } from './EmployeeActivityTracker';
import type { OperationContext } from '@/lib/employee-operation-policy';

/** Entirely best effort. Never throw into, await, or alter the business action. */
export function beginEmployeeOperation(action: OperationContext['action'], options: {disabled?: boolean; period?: string; ref?: string} = {}) {
  let attemptId = '', started = 0;
  try {
    if (!options.disabled && document.visibilityState === 'visible') {
      attemptId = crypto.randomUUID(); started = performance.now();
      sendEmployeeActivity({kind:'operation',context:{action,stage:'started',attemptId,...(options.period?{period:options.period}:{}),...(options.ref?{ref:options.ref}:{})}});
    }
  } catch { /* Audit cannot interrupt work. */ }
  let finished = false;
  return (stage: Exclude<OperationContext['stage'],'started'>, reason?: OperationContext['reason']) => {
    try {
      if (!attemptId || finished) return;
      finished = true;
      sendEmployeeActivity({kind:'operation',context:{action,stage,attemptId,durationMs:Math.min(21600000,Math.max(0,Math.round(performance.now()-started))),...(options.period?{period:options.period}:{}),...(options.ref?{ref:options.ref}:{}),...(reason?{reason}:{})}});
    } catch { /* Audit cannot interrupt work. */ }
  };
}
export function useEmployeePeriodView(action: 'payroll_view'|'schedule_view', period: string, enabled = true) {
  const preview = useEmployeePreview();
  useEffect(() => {
    if (preview || !enabled) return;
    let recorded=false, hiddenAt:number|null=null;
    const record=()=>{if(!recorded&&document.visibilityState==='visible'){recorded=true;beginEmployeeOperation(action,{period});}};
    let timer=window.setTimeout(record,350);
    const visibility=()=>{window.clearTimeout(timer);if(document.visibilityState!=='visible'){hiddenAt=Date.now();return;}if(hiddenAt!==null&&Date.now()-hiddenAt>=30000)recorded=false;hiddenAt=null;timer=window.setTimeout(record,350);};
    document.addEventListener('visibilitychange',visibility);
    return ()=>{window.clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);};
  },[action,period,enabled,preview]);
}
