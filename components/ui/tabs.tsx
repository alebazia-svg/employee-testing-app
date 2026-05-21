'use client';
import { useState } from 'react';
export function Tabs({tabs}:{tabs:{key:string;label:string;content:React.ReactNode}[]}){const [a,setA]=useState(tabs[0]?.key);return <div><div className='mb-4 flex gap-2'>{tabs.map(t=><button key={t.key} onClick={()=>setA(t.key)} className={`rounded-md px-3 py-2 text-sm ${a===t.key?'bg-primary text-white':'bg-gray-100'}`}>{t.label}</button>)}</div>{tabs.find(t=>t.key===a)?.content}</div>}
