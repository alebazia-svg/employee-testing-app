'use client';
import {useEffect,useMemo,useState,useRef} from 'react';
import {buildAdminProcurementForecast,type AdminForecastInput,type AdminForecastSources} from '@/lib/procurement-admin-forecast';
import {fundingEvidenceView,fundingSourcesComplete,retainDatedBankEvidence} from '@/lib/procurement-funding-view';

export function useAdminProcurementForecast(input:AdminForecastInput|undefined, enabled:boolean, previewReader?:()=>Promise<AdminForecastSources>) {
  const [result,setResult]=useState<{input:AdminForecastInput;source:AdminForecastSources}|null>(null);
  const [failed,setFailed]=useState<AdminForecastInput|null>(null);
  const [confirmed,setConfirmed]=useState<{input:AdminForecastInput;source:AdminForecastSources}|null>(null);
  const [attempt,setAttempt]=useState(0);
  const previousSource=useRef<AdminForecastSources>();
  useEffect(()=>{
    if(!input||!enabled)return;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),45_000);
    let active=true;
    setFailed(null);
    const read=process.env.NODE_ENV==='development'&&previewReader?previewReader():fetch('/api/admin/procurement/forecast',{cache:'no-store',signal:controller.signal}).then(async response=>{
      if(!response.ok)throw Error('FORECAST_UNAVAILABLE');return await response.json() as AdminForecastSources;
    });
    read.then(received=>{
        const source=retainDatedBankEvidence(received,previousSource.current);
        if(source.asOf!==input.todayKey)throw Error('FORECAST_DATE_CHANGED');
        if(active){previousSource.current=source;setResult({input,source});if(fundingSourcesComplete(input,source))setConfirmed({input,source});}
      }).catch(()=>{if(active)setFailed(input);})
      .finally(()=>clearTimeout(timer));
    return()=>{active=false;clearTimeout(timer);controller.abort();};
  },[input,enabled,attempt,previewReader]);
  const data=useMemo(()=>input&&result?.input===input?buildAdminProcurementForecast(input,result.source):null,[input,result]);
  // Retain the complete input+source pair, not old balances mixed with new requests.
  const fundingSnapshot=confirmed??result;
  const funding=useMemo(()=>fundingSnapshot?fundingEvidenceView(fundingSnapshot.input,fundingSnapshot.source):null,[fundingSnapshot]);
  const fundingStale=!enabled||!input||fundingSnapshot?.input!==input||failed===input||!fundingSnapshot||!fundingSourcesComplete(fundingSnapshot.input,fundingSnapshot.source);
  return {data,funding,fundingStale,loading:!!input&&!data&&failed!==input,error:!!input&&failed===input,retry:()=>setAttempt(value=>value+1)};
}
