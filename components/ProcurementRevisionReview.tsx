'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import type {PaymentRevision} from '@/lib/procurement-plan-revision';
export function ProcurementRevisionReview({items}: {items:{id:string;supplierPartner:string;revision:PaymentRevision}[]}) {
  const router=useRouter(); const [busy,setBusy]=useState(''); const [error,setError]=useState(''); const [reasons,setReasons]=useState<Record<string,string>>({});
  async function decide(item:typeof items[number],action:string) {
    setBusy(item.id);setError('');
    try {const r=await fetch(`/api/admin/procurement/payment-plans/${item.id}/revision`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,revisionId:item.revision.id,reason:reasons[item.id]||''})});const data=await r.json();if(!r.ok)throw new Error(data.error);router.refresh();}
    catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить.');}finally{setBusy('');}
  }
  if (!items.length)return null;
  return <section className="rounded-2xl border border-amber-200 bg-white p-4 sm:p-5"><h2 className="text-lg font-black">Изменения на согласование · {items.length}</h2><p className="mt-1 text-sm text-slate-500">Пока действуют прежние условия. Предлагаемые суммы и даты ещё не включены в план платежей.</p>{error?<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>:null}<div className="divide-y divide-slate-200">{items.map(item=><article key={item.id} className="py-4"><h3 className="font-bold">{item.supplierPartner}</h3><p className="mt-1 text-sm">Причина: {item.revision.reason}</p><div className="mt-3 space-y-2">{item.revision.changes.map(c=><div key={c.label} className="grid gap-1 text-sm sm:grid-cols-[150px_1fr_1fr]"><span className="text-slate-500">{c.label}</span><span>Было: {c.before||'—'}</span><strong>Стало: {c.after||'—'}</strong></div>)}</div><div className="mt-3 flex flex-wrap gap-2"><button disabled={!!busy} onClick={()=>decide(item,'APPROVE')} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Согласовать изменения</button><input aria-label={`Причина отказа ${item.supplierPartner}`} placeholder="Причина отказа" value={reasons[item.id]||''} onChange={e=>setReasons({...reasons,[item.id]:e.target.value})} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"/><button disabled={!!busy||(reasons[item.id]||'').trim().length<3} onClick={()=>decide(item,'REJECT')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold disabled:opacity-50">Оставить прежние условия</button></div></article>)}</div></section>;
}
