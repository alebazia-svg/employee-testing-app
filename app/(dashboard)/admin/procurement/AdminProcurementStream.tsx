'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ComponentProps,type ReactNode} from 'react';
import AdminProcurementClient from './AdminProcurementClient';

type Props = ComponentProps<typeof AdminProcurementClient>;
type Update = {generation:string;data:Props|null};
const Updates = createContext<((update:Update)=>void)|null>(null);

/** One stable calendar instance: streamed data never remounts dialogs/search/forms. */
export function AdminProcurementStream({initial,generation,children}:{initial:Props;generation:string;children:ReactNode}) {
  const [result,setResult]=useState<Update|null>(null);
  const current=useRef(generation);
  current.current=generation;
  const publish=useCallback((update:Update)=>{
    if(update.generation===current.current)setResult(update);
  },[]);
  useEffect(()=>{
    const timer=setTimeout(()=>{
      if(current.current===generation)setResult(previous=>previous?.generation===generation?previous:{generation,data:null});
    },60_000);
    return()=>clearTimeout(timer);
  },[generation]);
  const settled=result?.generation===generation;
  const data=settled&&result.data?result.data:initial;
  return <Updates.Provider value={publish}>
    <AdminProcurementClient {...data} refreshState={settled?result.data?.refreshState||'error':'loading'}/>
    {children}
  </Updates.Provider>;
}

export function AdminProcurementUpdate(props: (Props&{generation:string;failed?:false})|{generation:string;failed:true}) {
  const publish=useContext(Updates);
  useEffect(()=>{
    if(!publish)return;
    if(props.failed)publish({generation:props.generation,data:null});
    else {const {generation,failed,...data}=props;publish({generation,data});}
  },[publish,props]);
  return null;
}
