'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ExtensionProposal } from '@/lib/workday-extension';
export function WorkdayExtensionProposal({proposal,name,departedName}:{proposal:ExtensionProposal;name:string;departedName:string}) {
  const router=useRouter();const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState(false);
  async function approve(){setBusy(true);setMessage('');try{
    const response=await fetch('/api/admin/workday/extension',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(proposal)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Не удалось подтвердить.');
    setDone(true);setMessage('Продление до 20:00 подтверждено. Уведомление сотруднику сохранено.');router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'Не удалось подтвердить.');}finally{setBusy(false);}}
  return <section aria-label="Предложение продлить смену" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
    <h2 className="font-semibold text-stone-900">{done?'Продление подтверждено':`${name}: продлить смену до 20:00?`}</h2>
    {!done&&<><p className="mt-1 text-sm text-stone-700">{departedName}: смена завершена досрочно. {name} работает без напарника, замена пока не отметилась. Сейчас смена до 18:00.</p>
    <p className="mt-1 text-xs text-stone-600">После подтверждения смена станет 09:00–20:00. Исходная смена и фактические отметки сохранятся в истории.</p>
    <button type="button" disabled={busy} onClick={()=>void approve()} className="admin-material-primary mt-3 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">{busy?'Подтверждаем…':'Подтвердить до 20:00'}</button></>}
    {message&&<p role="status" className="mt-2 text-sm text-stone-800">{message}</p>}
  </section>;
}
