'use client';
import {useEffect,useMemo,useState} from 'react';
import {buildAdminProcurementForecast,type AdminForecastInput,type AdminForecastSources} from '@/lib/procurement-admin-forecast';

export function useAdminProcurementForecast(input:AdminForecastInput|undefined, enabled:boolean) {
  const [result,setResult]=useState<{input:AdminForecastInput;source:AdminForecastSources}|null>(null);
  const [failed,setFailed]=useState<AdminForecastInput|null>(null);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!input||!enabled)return;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),45_000);
    let active=true;
    setFailed(null);
    fetch('/api/admin/procurement/forecast',{cache:'no-store',signal:controller.signal})
      .then(async response=>{
        if(!response.ok)throw Error('FORECAST_UNAVAILABLE');
        const source:AdminForecastSources=await response.json();
        if(source.asOf!==input.todayKey)throw Error('FORECAST_DATE_CHANGED');
        if(active)setResult({input,source});
      }).catch(()=>{if(active)setFailed(input);})
      .finally(()=>clearTimeout(timer));
    return()=>{active=false;clearTimeout(timer);controller.abort();};
  },[input,enabled,attempt]);
  const data=useMemo(()=>input&&result?.input===input?buildAdminProcurementForecast(input,result.source):null,[input,result]);
  return {data,loading:!!input&&!data&&failed!==input,error:!!input&&failed===input,retry:()=>setAttempt(value=>value+1)};
}
