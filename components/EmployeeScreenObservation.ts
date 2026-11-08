'use client';
import { useEffect,useRef } from 'react';
import { useEmployeePreview } from './EmployeePreviewProvider';
import { reportEmployeeScreen } from '@/lib/employee-ui-client';
import type { EmployeeScreenState } from '@/lib/employee-screen-state';
type Layer=Omit<EmployeeScreenState,'section'>;
let section:EmployeeScreenState['section']='day';
const layers=new Map<symbol,{value:Layer;priority:number}>();
function publish(){const top=[...layers.values()].sort((a,b)=>b.priority-a.priority)[0];reportEmployeeScreen({section,...top?.value});}
export function useEmployeeScreenSection(next:EmployeeScreenState['section']|null,disabled=false){
 const preview=useEmployeePreview();
 useEffect(()=>{if(!preview&&!disabled&&next){section=next;publish();}},[next,disabled,Boolean(preview)]);
}
export function useEmployeeScreenLayer(value:Layer|null,priority:number){
 const preview=useEmployeePreview(),key=useRef(Symbol('screen-layer'));
 const signature=JSON.stringify(value);
 useEffect(()=>{
  if(preview)return;
  const id=key.current;
  if(value)layers.set(id,{value,priority});else layers.delete(id);publish();
  return()=>{layers.delete(id);publish();};
 },[signature,priority,Boolean(preview)]);
}
