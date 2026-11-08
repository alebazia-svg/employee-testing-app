'use client';
import { workflowEvent } from '@/lib/employee-workflow-client';
import { useEmployeeScreenSection } from './EmployeeScreenObservation';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useProcurementMobileNavigation } from './ProcurementMobileNavigation';
import { useEmployeePreview } from './EmployeePreviewProvider';
import { activityRoute, type ActivitySection, type ActivityInput } from '@/lib/employee-activity-policy';

type ClientActivity = ActivityInput extends infer T ? T extends ActivityInput ? Omit<T, 'key'> : never : never;
// Memory-only FIFO prevents simultaneous shown/open events from competing for the DB lock.
// No persistent queue or business requests. One bounded retry reuses the same event key;
// the expected signed account prevents queued events crossing an account change.
const pending: Array<{body:string;at:number;gap?:boolean;lossVersion?:number}> = [];
let draining=false,lossVersion=0,reportedLoss=0,gapQueued=false,accountEpoch=0;
const activityKey=()=>typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():`event-${Date.now()}-${Math.random().toString(36).slice(2,12)}`;
let expectedUserId:number|undefined;
async function drain(){
 if(draining)return;draining=true;
 try { while(pending.length){const entry=pending.shift()!;if(Date.now()-entry.at>15000){if(!entry.gap)lossVersion++;else gapQueued=false;continue;}
  const epoch=accountEpoch;let recorded=false;
  for(let attempt=0;attempt<2;attempt++){
   let stopTimeout=()=>{};
   try{let signal:AbortSignal;if(typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout==='function')signal=AbortSignal.timeout(4000);else{const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),4000);signal=controller.signal;stopTimeout=()=>window.clearTimeout(timer);}
    const response=await fetch('/api/employee/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:entry.body,keepalive:true,signal});
    if(response.status===401||response.status===403||response.status===400)break;
    if(response.ok&&(await response.json().catch(()=>null))?.recorded===true){recorded=true;break;}
   }catch{/* Missing evidence never blocks work. */}finally{stopTimeout();}
   if(attempt===0)await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(epoch!==accountEpoch)continue;
  if(entry.gap){gapQueued=false;if(recorded)reportedLoss=entry.lossVersion||reportedLoss;}
  else if(!recorded)lossVersion++;
  if(recorded&&lossVersion>reportedLoss&&!gapQueued&&pending.length<30){
   gapQueued=true;pending.push({at:Date.now(),gap:true,lossVersion,body:JSON.stringify({kind:'experience',key:activityKey(),...(expectedUserId?{expectedUserId}:{}),context:{target:'workflow',action:'app',stage:'collection_gap',attemptId:activityKey()}})});
  }
 }}finally{draining=false;}
}
export function sendEmployeeActivity(input: ClientActivity) {
 if(typeof window==='undefined'||(document.visibilityState!=='visible' && !(input.kind==='experience' && (input.context.target==='guide' && ['hidden','page_left','interrupted'].includes(input.context.stage)||input.context.target==='workflow'&&input.context.action==='app'&&input.context.stage==='background')))||!/^\/(employee|procurement)(\/|$)/.test(location.pathname))return;
 try {if(pending.length>=30){lossVersion++;return;}pending.push({body:JSON.stringify({...input,key:activityKey(),...(expectedUserId?{expectedUserId}:{})}),at:Date.now()});void drain();}catch{}
}
export function useEmployeeActivityVisit(section: ActivitySection | null, disabled = false) {
  const preview = useEmployeePreview();
  useEmployeeScreenSection(section,disabled);
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
export function EmployeeActivityTracker({userId}:{userId?:number}={}) {
  useEffect(()=>{expectedUserId=userId;return()=>{expectedUserId=undefined;accountEpoch++;pending.length=0;lossVersion=0;reportedLoss=0;gapQueued=false;};},[userId]);
  useEffect(()=>{const visibility=()=>workflowEvent('app',document.visibilityState==='visible'?'returned':'background');document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);},[]);
  const mobile = useProcurementMobileNavigation();
  const section=activityRoute(usePathname());
  useEmployeeActivityVisit(mobile || section==='payroll'?null:section); // Payroll records a period-aware view itself.
  return null;
}
