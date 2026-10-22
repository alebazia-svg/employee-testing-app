'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ComponentProps,type ReactNode} from 'react';
import Calendar from './ProcurementPaymentCalendarClient';
import {mergeBuyerStream,timeoutBuyerStream,type BuyerStreamResult,type BuyerStreamUpdate} from '@/lib/procurement-buyer-stream';
type Props=ComponentProps<typeof Calendar>;
type Update=BuyerStreamUpdate;
const Updates=createContext<((value:Update)=>void)|null>(null);

/** Keep the same form instance while 1C arrives; reject late generations. */
export function ProcurementCalendarStream({initial,generation,children}:{initial:Props;generation:string;children:ReactNode}){
  const [result,setResult]=useState<BuyerStreamResult|null>(null);
  const current=useRef(generation);current.current=generation;
  const publish=useCallback((value:Update)=>{if(value.generation===current.current)setResult(old=>mergeBuyerStream(old,value,current.current));},[]);
  useEffect(()=>{
    const timer=setTimeout(()=>{if(current.current===generation)setResult(old=>timeoutBuyerStream(old,generation));},60_000);
    return()=>clearTimeout(timer);
  },[generation]);
  const same=result?.generation===generation;
  const settled=same&&result.done.planning&&result.done.evidence;
  return <Updates.Provider value={publish}><Calendar {...initial} {...(same?result.patch:{})} sourceRefreshing={!settled}/>{children}</Updates.Provider>;
}
export function ProcurementCalendarUpdate({generation,part,data}:Update){
  const publish=useContext(Updates);
  useEffect(()=>{publish?.({generation,part,data});},[publish,generation,part,data]);
  return null;
}
