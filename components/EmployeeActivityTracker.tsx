'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useEmployeePreview } from './EmployeePreviewProvider';
import { activityRoute, type ActivitySection, type ActivityInput } from '@/lib/employee-activity-policy';

type ClientActivity = ActivityInput extends infer T ? T extends ActivityInput ? Omit<T, 'key'> : never : never;
// Memory-only FIFO prevents simultaneous shown/open events from competing for the DB lock.
// No persistent queue, no retries, no business requests; at most 30 small events pending.
const pending: Array<{body:string;at:number}> = [];
let draining=false;
async function drain(){
 if(draining)return;draining=true;
 try { while(pending.length){const entry=pending.shift()!;if(Date.now()-entry.at>5000)continue;
  try{await fetch('/api/employee/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:entry.body,keepalive:true,signal:AbortSignal.timeout(4000)});}catch{/* Missing evidence never blocks work. */}
 }}finally{draining=false;}
}
export function sendEmployeeActivity(input: ClientActivity) {
 if(typeof window==='undefined'||document.visibilityState!=='visible'||!/^\/(employee|procurement)(\/|$)/.test(location.pathname))return;
 try {if(pending.length>=30)return;pending.push({body:JSON.stringify({...input,key:crypto.randomUUID()}),at:Date.now()});void drain();}catch{}
}
export function useEmployeeActivityVisit(section: ActivitySection | null, disabled = false) {
  const preview = useEmployeePreview();
  useEffect(() => {
    if (preview || disabled || !section) return;
    let sent = false;
    let hiddenAt: number | null = null;
    const record = () => {
      if (sent || document.visibilityState !== 'visible') return;
      sent = true;
      sendEmployeeActivity({ kind: 'visit', section });
    };
    // React development remount and very fast tab changes are not separate visits.
    let timer = window.setTimeout(record, 350);
    const visibilityChanged = () => {
      window.clearTimeout(timer);
      if (document.visibilityState !== 'visible') { hiddenAt = Date.now(); return; }
      // A return after a real break is a visit even when the tab did not change.
      // Brief system dialogs and notification shade checks are not new visits.
      if (hiddenAt !== null && Date.now() - hiddenAt >= 30000) sent = false;
      hiddenAt = null;
      timer = window.setTimeout(record, 350);
    };
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', visibilityChanged); };
  }, [section, disabled, preview]);
}
export function EmployeeActivityTracker() {
  useEmployeeActivityVisit(activityRoute(usePathname()));
  return null;
}
