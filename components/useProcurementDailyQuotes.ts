'use client';
import {useEffect,useState} from 'react';
import type {DailyQuote} from '@/lib/procurement-daily-rate';
type Value={quotes:DailyQuote[];state:'loading'|'ready'|'error'};
type Entry={value:Value;readAt:number;pending?:Promise<void>;refreshQueued?:boolean;listeners:Set<(value:Value)=>void>};
const entries=new Map<string,Entry>();
function entry(day:string){let e=entries.get(day);if(!e){e={value:{quotes:[],state:'loading'},readAt:0,listeners:new Set()};entries.set(day,e);}return e;}
function load(day:string,force=false){
 const e=entry(day);if(e.pending){if(force)e.refreshQueued=true;return e.pending;}
 if(!force&&Date.now()-e.readAt<10000)return Promise.resolve();
 e.pending=(async()=>{try{const r=await fetch('/api/procurement/daily-rates?day='+encodeURIComponent(day),{cache:'no-store'});if(!r.ok)throw Error();const body=await r.json();if(!Array.isArray(body.quotes))throw Error();e.value={quotes:body.quotes,state:'ready'};}catch{e.value={quotes:e.value.quotes,state:'error'};}finally{e.readAt=Date.now();e.pending=undefined;for(const notify of e.listeners)notify(e.value);if(e.refreshQueued){e.refreshQueued=false;void load(day,true);}}})();
 return e.pending;
}
/** One in-flight DB-only read per day; never refreshes or rewrites financial amounts. */
export function useProcurementDailyQuotes(day:string|null){
 const [snapshot,setSnapshot]=useState<{day:string|null;value:Value}>(()=>({day,value:day?entry(day).value:{quotes:[],state:'ready'}}));
 useEffect(()=>{if(!day)return;const e=entry(day),notify=(value:Value)=>setSnapshot({day,value});e.listeners.add(notify);notify(e.value);void load(day);
  const refresh=()=>{if(document.visibilityState==='visible')void load(day);};
  const changed=()=>{void load(day,true);};
  const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);window.addEventListener('procurement-rates-changed',changed);
  return()=>{e.listeners.delete(notify);clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('procurement-rates-changed',changed);};
 },[day]);
 return snapshot.day===day?snapshot.value:day?entry(day).value:{quotes:[],state:'ready' as const};
}
