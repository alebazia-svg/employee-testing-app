'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ComponentProps,type ReactNode} from 'react';
import Calendar from './ProcurementPaymentCalendarClient';
type Props=ComponentProps<typeof Calendar>;
type Update={generation:string;data:Props|null};
const Updates=createContext<((value:Update)=>void)|null>(null);

/** Keep the same form instance while 1C arrives; reject late generations. */
export function ProcurementCalendarStream({initial,generation,children}:{initial:Props;generation:string;children:ReactNode}){
  const [result,setResult]=useState<Update|null>(null);
  const current=useRef(generation);current.current=generation;
  const publish=useCallback((value:Update)=>{if(value.generation===current.current)setResult(value);},[]);
  useEffect(()=>{
    const timer=setTimeout(()=>{if(current.current===generation)setResult(old=>old?.generation===generation?old:{generation,data:null});},60_000);
    return()=>clearTimeout(timer);
  },[generation]);
  const settled=result?.generation===generation;
  return <Updates.Provider value={publish}><Calendar {...(settled&&result.data?result.data:initial)} sourceRefreshing={!settled}/>{children}</Updates.Provider>;
}
export function ProcurementCalendarUpdate({generation,data}:{generation:string;data:Props|null}){
  const publish=useContext(Updates);
  useEffect(()=>{publish?.({generation,data});},[publish,generation,data]);
  return null;
}
