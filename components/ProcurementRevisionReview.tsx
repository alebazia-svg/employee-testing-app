'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import type {PaymentRevision} from '@/lib/procurement-plan-revision';
import {ProcurementAdminList} from './ProcurementAdminList';
export function ProcurementRevisionReview({items}: {items:{id:string;supplierPartner:string;revision:PaymentRevision}[]}) {
  const router=useRouter();
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[rejecting,setRejecting]=useState(''),[reason,setReason]=useState('');
  const [decided,setDecided]=useState<string[]>([]),[message,setMessage]=useState('');
  const visible=items.filter(item=>!decided.includes(item.revision.id));
  async function decide(item:typeof items[number],action:string) {
    if(busy)return;
    setBusy(item.id);setError('');setMessage('');
    try {
      const r=await fetch(`/api/admin/procurement/payment-plans/${item.id}/revision`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,revisionId:item.revision.id,reason})});
      const data=await r.json();if(!r.ok)throw new Error(data.error||'Не удалось сохранить решение.');
      setDecided(previous=>[...previous,item.revision.id]);setReason('');setRejecting('');
      setMessage(action==='APPROVE'?'Изменения согласованы.':'Сохранены прежние условия.');router.refresh();
    }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить решение.');}finally{setBusy('');}
  }
  if(!visible.length)return message?<p role="status" className="text-sm text-green-800">{message}</p>:null;
  return <section aria-label="Изменения на согласование" className="space-y-3">
    <h2 className="text-base font-bold">Изменения на согласование · {visible.length}</h2>
    <ProcurementAdminList searchQuery="" busy={!!busy} dirty={!!reason.trim()} error={error}
      onOpen={()=>{setError('');setReason('');setRejecting('');}}
      items={visible.map(item=>({id:item.id,name:item.supplierPartner,meta:'',
        dateLabel:new Date(item.revision.data.plannedDate+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'}),
        amount:item.revision.data.foreignAmount?`${Number(item.revision.data.foreignAmount).toLocaleString('ru-RU')} ${item.revision.data.paymentMethod}`:`${Number(item.revision.data.plannedAmount).toLocaleString('ru-RU')} ₽`,
        basis:item.revision.changes.map(c=>c.label).join(', '),method:'Изменение заявки'}))}
      renderDetail={id=>{const item=visible.find(i=>i.id===id)!;return <div className="space-y-4">
        <h3 className="text-xl font-bold">{item.supplierPartner}</h3>
        <p className="text-sm text-slate-600">Астемир предлагает изменить заявку. До согласования действуют прежние условия.</p>
        <dl className="divide-y divide-stone-200 rounded-xl border border-stone-200 px-4">
          {item.revision.changes.map(c=><div key={c.label} className="py-3"><dt className="mb-2 text-sm font-semibold">{c.label}</dt><dd className="grid grid-cols-2 gap-4 text-sm"><div><span className="mb-1 block text-xs text-slate-500">Сейчас</span>{c.before||'—'}</div><div><span className="mb-1 block text-xs text-[#785537]">Предлагается</span><strong>{c.after||'—'}</strong></div></dd></div>)}
        </dl>
        <div className="text-sm"><p className="font-semibold">Причина изменения</p><p className="mt-1 whitespace-pre-wrap">{item.revision.reason}</p></div>
        {rejecting===id?<label className="block text-sm font-semibold">Причина отказа<textarea autoFocus required minLength={3} maxLength={500} rows={2} value={reason} disabled={!!busy} onChange={e=>setReason(e.target.value)} className="mt-2 block w-full rounded-lg border border-stone-300 px-3 py-2 font-normal"/></label>:null}
        {busy?<p role="status" className="text-sm text-slate-600">{rejecting===id?'Сохраняем решение…':'Проверяем оплату в 1С перед согласованием…'}</p>:null}
      </div>;}}
      renderFooter={(id,close)=>{const item=visible.find(i=>i.id===id)!;return rejecting===id?<><button className="pam-button" disabled={!!busy} onClick={()=>{setRejecting('');setReason('');}}>Назад</button><button className="pam-button pam-primary" disabled={!!busy||reason.trim().length<3} onClick={()=>decide(item,'REJECT')}>Оставить прежние условия</button></>:<><button className="pam-button" disabled={!!busy} onClick={close}>Закрыть</button><button className="pam-button" disabled={!!busy} onClick={()=>setRejecting(id)}>Отклонить</button><button className="pam-button pam-primary" disabled={!!busy} onClick={()=>decide(item,'APPROVE')}>{busy?'Проверяем оплату…':'Согласовать изменения'}</button></>;}}
    />
  </section>;
}
