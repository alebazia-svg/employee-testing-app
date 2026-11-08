'use client';
import { useEffect,useRef,useState } from 'react';
import type { EmployeeActivityReport } from './employee-activity-report';
import { activityMayRefresh, activityReadFailure } from './employee-activity-live';
export function useEmployeeActivityLive(userId:number,date:string,today:string){
 const [data,setData]=useState<EmployeeActivityReport|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false);
 const reload=useRef<()=>void>(()=>{});
 useEffect(()=>{
  let stopped=false,flight:AbortController|null=null,lastAttempt=0,failures=0;
  setData(null);setError('');setLoading(true);
  async function read(force=false){
   if(!activityMayRefresh({visible:document.visibilityState==='visible',currentDay:date===today,inFlight:!!flight,now:Date.now(),lastAttempt,failures,force}))return;
   const controller=new AbortController();flight=controller;lastAttempt=Date.now();setRefreshing(true);
   const timer=setTimeout(()=>controller.abort(),8000);
   let status:number|null=null;
   try{
    const response=await fetch(`/api/admin/employees/${userId}/activity?date=${date}`,{cache:'no-store',signal:controller.signal});
    status=response.status;
    const body=await response.json();if(!response.ok||body.date!==date||!Array.isArray(body.sections))throw Error('activity_response_invalid');
    if(!stopped){setData(body);setError('');failures=0;}
   }catch(e){if(!stopped){failures++;setError(activityReadFailure(status,e instanceof Error&&e.name==='AbortError'));}}
   finally{clearTimeout(timer);if(flight===controller)flight=null;if(!stopped){setLoading(false);setRefreshing(false);}}
  }
  reload.current=()=>void read(true);
  const resume=()=>void read(true),tick=()=>void read();
  void read(true);const interval=setInterval(tick,1000);
  window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
  return()=>{stopped=true;clearInterval(interval);flight?.abort();window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
 },[userId,date,today]);
 return {data,error,loading,refreshing,refresh:()=>reload.current()};
}
