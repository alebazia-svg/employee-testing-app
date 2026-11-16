'use client';
import {useEffect,useRef,useState} from 'react';
import {Plus} from 'lucide-react';
import {ProcurementPaymentForm} from '@/app/(dashboard)/procurement/ProcurementPaymentForm';
import {ProcurementPaymentDialog} from './ProcurementPaymentDialog';
import {ProcurementDiscardDraftDialog} from './ProcurementDiscardDraftDialog';
import type {ProcurementCreateView} from '@/lib/procurement-create-view';

type Manager = {id:number;name:string};
export function ProcurementAdminCreate({onCreated}:{onCreated:()=>void}) {
  const [open,setOpen]=useState(false),[managers,setManagers]=useState<Manager[]|null>(null),[managerId,setManagerId]=useState<number|null>(null);
  const [view,setView]=useState<ProcurementCreateView|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [draft,setDraft]=useState({hasDraft:false,saving:false}),[discard,setDiscard]=useState(false),[created,setCreated]=useState(false);
  const opener=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();
    async function load(){
      setError('');setView(null);
      try {
        const url='/api/admin/procurement/create-context'+(managerId==null?'':`?managerUserId=${managerId}`);
        const response=await fetch(url,{signal:controller.signal,cache:'no-store'});
        const body=await response.json();
        if(controller.signal.aborted)return;
        if(!response.ok){setError(body.error||'Не удалось загрузить данные.');return;}
        if(managerId==null){
          setManagers(body.managers);
          if(body.managers.length===1)setManagerId(body.managers[0].id);
          else if(!body.managers.length)setError('Нет доступных сотрудников закупок.');
        }else setView(body);
      }catch{if(!controller.signal.aborted)setError('Не удалось загрузить данные. Повторите попытку.');}
    }
    void load();return()=>controller.abort();
  },[open,managerId,retry]);
  function close(){setOpen(false);setDiscard(false);setDraft({hasDraft:false,saving:false});setView(null);setManagerId(null);setManagers(null);setError('');}
  function requestClose(){if(draft.saving)return;if(draft.hasDraft)setDiscard(true);else close();}
  return <>
    <button ref={opener} type="button" className="admin-material-primary inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white" onClick={()=>{setCreated(false);setOpen(true)}}><Plus size={18}/><span>Добавить оплату</span></button>
    {created?<span role="status" className="text-sm text-slate-700">Заявка создана · на согласовании</span>:null}
    {open?<ProcurementPaymentDialog editing={false} busy={draft.saving} onClose={requestClose} returnFocus={opener.current}>
      <div className="border-b border-[var(--portal-border)] px-4 py-3 sm:px-5">
        {managers&&managers.length>1?<label className="block text-sm font-semibold">Ответственный<select aria-label="Ответственный за оплату" disabled={draft.hasDraft||draft.saving} className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2 text-sm" value={managerId??''} onChange={e=>{setView(null);setManagerId(e.target.value?Number(e.target.value):null)}}><option value="">Выберите сотрудника</option>{managers.map(manager=><option key={manager.id} value={manager.id}>{manager.name}</option>)}</select></label>:managerId?<p className="text-sm text-slate-600">Ответственный · <strong className="font-semibold text-slate-900">{managers?.find(m=>m.id===managerId)?.name}</strong></p>:null}
        <p className="mt-1 text-sm text-slate-600">После создания — на согласование.</p>
      </div>
      {error?<div role="alert" className="p-4 text-sm text-red-800"><p>{error}</p><button type="button" className="mt-3 rounded-lg border px-3 py-2 font-semibold" onClick={()=>setRetry(n=>n+1)}>Повторить загрузку</button></div>:view&&managerId?<ProcurementPaymentForm {...view} managerUserId={managerId} initialSelectedRefs={[]} onDraftStateChange={setDraft} onCancel={requestClose} onCreated={()=>{close();setCreated(true);onCreated();}}/>:(!managers||managerId)?<p role="status" className="p-4 text-sm text-slate-600">Проверяем поставщиков и оплаты в 1С…</p>:null}
    </ProcurementPaymentDialog>:null}
    <ProcurementDiscardDraftDialog open={discard} editing={false} onKeep={()=>setDiscard(false)} onDiscard={close}/>
  </>;
}
