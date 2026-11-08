'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { homeSections, homeRefreshInterval, retainHomeRead, type HomeRead, type HomeSection } from '@/lib/admin-home';
import { getMoscowDateKey } from '@/lib/workday';
export type HomeStates = {[K in HomeSection]:{read?:HomeRead<K>;loading:boolean;error:string}};
const empty=()=>Object.fromEntries(homeSections.map(key=>[key,{loading:true,error:''}])) as HomeStates;
export function useHomeData(){
 const [states,setStates]=useState<HomeStates>(empty),[accessError,setAccessError]=useState(false);
 const active=useRef(new Map<HomeSection,AbortController>()),attempts=useRef(new Map<HomeSection,number>()),mounted=useRef(false),denied=useRef(false);
 const refresh=useCallback((section:HomeSection)=>{
  if(denied.current||active.current.has(section)||document.visibilityState!=='visible')return;
  const controller=new AbortController();active.current.set(section,controller);attempts.current.set(section,Date.now());
  const timeout=window.setTimeout(()=>controller.abort(),30_000);
  setStates(old=>({...old,[section]:{...old[section],loading:true}}));
  void fetch(`/api/admin/home?section=${section}`,{cache:'no-store',signal:controller.signal}).then(async response=>{
   if(response.status===401||response.status===403){denied.current=true;setAccessError(true);setStates(empty());for(const task of active.current.values())task.abort();throw Error('ACCESS');}
   if(!response.ok)throw Error('SOURCE');
   const read=await response.json() as HomeRead;
   if(read.section!==section||read.day!==getMoscowDateKey()||!read.checkedAt||!read.data)throw Error('SOURCE');
   if(mounted.current&&!denied.current&&active.current.get(section)===controller)setStates(old=>({...old,[section]:{read,loading:false,error:''}}));
  }).catch(()=>{if(mounted.current&&!denied.current&&active.current.get(section)===controller)setStates(old=>({...old,[section]:{read:retainHomeRead(old[section].read as HomeRead|undefined,getMoscowDateKey()),loading:false,error:'Источник не обновился'}}));}).finally(()=>{window.clearTimeout(timeout);if(active.current.get(section)===controller)active.current.delete(section);});
 },[]);
 useEffect(()=>{
  mounted.current=true;homeSections.forEach(refresh);
  const tick=()=>homeSections.forEach(section=>{if(Date.now()-(attempts.current.get(section)??0)>=homeRefreshInterval(section))refresh(section);});
  const resume=()=>{if(document.visibilityState==='visible')homeSections.forEach(section=>{if(Date.now()-(attempts.current.get(section)??0)>5_000)refresh(section);});};
  const timer=window.setInterval(tick,5_000);
  window.addEventListener('focus',resume);window.addEventListener('pageshow',resume);window.addEventListener('online',resume);window.addEventListener('portal:data-changed',resume);document.addEventListener('visibilitychange',resume);
  return()=>{mounted.current=false;window.clearInterval(timer);window.removeEventListener('focus',resume);window.removeEventListener('pageshow',resume);window.removeEventListener('online',resume);window.removeEventListener('portal:data-changed',resume);document.removeEventListener('visibilitychange',resume);for(const task of active.current.values())task.abort();active.current.clear();};
 },[refresh]);
 return {states,accessError,refresh:()=>homeSections.forEach(refresh)};
}
