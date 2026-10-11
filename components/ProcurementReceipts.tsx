'use client';
import React,{useEffect,useId,useRef,useState} from 'react';
import {Paperclip,X} from 'lucide-react';
import {needsReceiptSinceRollout,RECEIPT_MAX_BYTES} from '@/lib/procurement-receipt-policy';
import './procurement-receipts.css';

type Receipt={id:string;planId:string;originalName:string;size:number;createdAt:string;author:{name:string}};
type Plan={id:string;supplierPartner:string;plannedAmount:string|number;paymentMethod?:string;createdAt?:string;orderNumbers:string[];evidence?:{issuedAmount?:number;paidAmount?:number;paidForeignAmount?:number;cashOrders?:{date?:string}[];currencyPayments?:{date?:string}[]}};
const root='/api/procurement/payment-plans/';
const button='procurement-receipt-button';
function paymentAmount(plan:Plan){
  if((plan.evidence?.paidForeignAmount||0)>0)return `${plan.evidence!.paidForeignAmount!.toLocaleString('ru-RU')} USDT`;
  return `${Number(plan.evidence?.issuedAmount||plan.evidence?.paidAmount||plan.plannedAmount).toLocaleString('ru-RU')} ₽`;
}

export function ProcurementReceipts({plans,allPlans=plans,single=false,hideEmptyBeforePayment=false}:{plans:Plan[];allPlans?:Plan[];single?:boolean;hideEmptyBeforePayment?:boolean}) {
  if(process.env.NEXT_PUBLIC_PROCUREMENT_RECEIPTS_ENABLED!=='1')return null;
  return <ReceiptWorkspace plans={plans} allPlans={allPlans} single={single} hideEmptyBeforePayment={hideEmptyBeforePayment}/>;
}
function ReceiptWorkspace({plans,allPlans,single,hideEmptyBeforePayment}:{plans:Plan[];allPlans:Plan[];single:boolean;hideEmptyBeforePayment:boolean}) {
  const [receipts,setReceipts]=useState<Receipt[]>([]);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState('');
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState('');
  const [target,setTarget]=useState('');
  const [notice,setNotice]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  const titleId=useId();
  const requestVersion=useRef(0);
  const uploading=useRef(false);
  const signature=allPlans.map(p=>p.id).sort().join(',');
  const load=async(signal?:AbortSignal)=>{
    if(uploading.current)return;
    const version=++requestVersion.current;
    try {
    const ids=signature.split(',').filter(Boolean);
    const result:Receipt[]=[];
    for(let i=0;i<ids.length;i+=100){
      const query=new URLSearchParams(ids.slice(i,i+100).map(id=>['plan',id]));
      const response=await fetch(`/api/procurement/receipts?${query}`,{cache:'no-store',signal});
      if(!response.ok)throw new Error('Не удалось загрузить чеки. Повторите позже.');
      result.push(...(await response.json()).receipts);
    }
    if(version!==requestVersion.current)return;
    setReceipts(result);setReady(true);setError('');
    }catch(error){if(version===requestVersion.current)throw error;}
  };
  useEffect(()=>{
    if(single&&!open&&!hideEmptyBeforePayment)return;
    const abort=new AbortController();setReady(false);
    load(abort.signal).catch(error=>{if(!abort.signal.aborted)setError(error.message);});
    const refresh=()=>{if(!document.hidden)load(abort.signal).catch(()=>{});};
    const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);window.addEventListener('procurement-receipts-changed',refresh);
    return()=>{abort.abort();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('procurement-receipts-changed',refresh);};
  // Depend on identities, not the array rebuilt by the calendar on each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[signature,single,open,hideEmptyBeforePayment]);
  useEffect(()=>{
    if(single)return;
    const id=new URLSearchParams(window.location.search).get('receipts');
    if(id&&allPlans.some(p=>p.id===id)){setTarget(id);setOpen(true);}
  },[signature,single]);
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  const filesFor=(id:string)=>receipts.filter(file=>file.planId===id);
  const pending=plans.filter(plan=>needsReceiptSinceRollout(plan,filesFor(plan.id).length));
  const displayed=single?plans:target?allPlans.filter(p=>p.id===target):pending;
  const add=async(plan:Plan,files:File[])=>{
    if(!files.length||uploading.current)return;
    uploading.current=true;requestVersion.current++;
    const fromQueue=!single&&!target;
    setBusy(plan.id);setError('');setNotice('');
    try {
      for(const file of files){
        if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size<=0||file.size>RECEIPT_MAX_BYTES)throw new Error('Выберите фото JPG, PNG, WebP или PDF до 10 МБ.');
        const data=new FormData();data.set('file',file);
        const response=await fetch(`${root}${encodeURIComponent(plan.id)}/receipts`,{method:'POST',body:data});
        const body=await response.json();if(!response.ok)throw new Error(body.error||'Чек не сохранён. Повторите попытку.');
        setReceipts(prev=>[...prev.filter(r=>r.id!==body.receipt.id),body.receipt]);
      }
      if(fromQueue)setTarget('');
      setNotice(`Чек сохранён · ${plan.supplierPartner}. Доступен в истории оплаты.`);
      window.dispatchEvent(new Event('procurement-receipts-changed'));
    }catch(error){setTarget(plan.id);setError(error instanceof Error?error.message:'Чек не сохранён. Повторите попытку.');}
    finally{uploading.current=false;setBusy('');}
  };
  const hasPayment=plans.some(plan=>Number(plan.evidence?.issuedAmount)>0||Number(plan.evidence?.paidAmount)>0||Number(plan.evidence?.paidForeignAmount)>0||Boolean(plan.evidence?.cashOrders?.length)||Boolean(plan.evidence?.currencyPayments?.length));
  if(single&&hideEmptyBeforePayment&&!open&&!error&&ready&&!receipts.length&&!hasPayment)return null;
  return <>
    <button type="button" className={button} onClick={()=>{setNotice('');setTarget(single?plans[0]?.id||'':'');setOpen(true);}}><Paperclip size={15}/>{single?'Чеки оплаты':ready?`Нужны чеки · ${pending.length}`:error?'Чеки · не удалось загрузить':'Чеки · загрузка'}</button>
    <dialog ref={dialog} aria-labelledby={titleId} className="procurement-receipts-dialog" onCancel={event=>{event.preventDefault();if(!busy)setOpen(false);}}>
      <header><h2 id={titleId}>{single||target?'Чеки оплаты':'Нужны чеки'}</h2><button type="button" className={button} disabled={!!busy} aria-label="Закрыть чеки" onClick={()=>setOpen(false)}><X size={18}/></button></header>
      <div className="procurement-receipts-body">
        <p className="mb-3 text-sm text-slate-500">Чек перевода поставщику · фото или PDF до 10 МБ.</p>
        {notice?<p role="status" className="mb-3 rounded-lg bg-[#f8f2eb] p-3 text-sm text-[#754725]">{notice}</p>:null}
        {error?<div role="alert"><p>{error}</p><button type="button" className={button} disabled={!!busy} onClick={()=>load().catch(error=>setError(error.message))}>Повторить загрузку</button></div>:null}
        {!ready?<p>Загружаем чеки…</p>:<>
          {!displayed.length?<p>Нет оплат, для которых нужно добавить чек.</p>:<ul className="procurement-receipts-list">{displayed.map(plan=><li key={plan.id}>
            <div><h3>{plan.supplierPartner}</h3><p>{plan.orderNumbers.length?'Заказ '+plan.orderNumbers.join(', '):'Оплата поставщику'}</p></div>
            <strong>{paymentAmount(plan)}</strong>
            <ReceiptPicker disabled={!!busy} supplier={plan.supplierPartner} label={busy===plan.id?'Сохраняем…':filesFor(plan.id).length?'Добавить ещё':'Добавить чек'} onFiles={files=>add(plan,files)}/>
            {filesFor(plan.id).length?<ul className="procurement-receipts-files">{filesFor(plan.id).map(file=><li key={file.id}><a href={`${root}${encodeURIComponent(plan.id)}/receipts/${encodeURIComponent(file.id)}`} download>{file.originalName}</a><span>{file.author.name} · {new Date(file.createdAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span></li>)}</ul>:null}
          </li>)}</ul>}
          {target&&!single?<button className={button} onClick={()=>setTarget('')}>К остальным оплатам</button>:null}
        </>}
      </div>
    </dialog>
  </>;
}
function ReceiptPicker({supplier,label,disabled,onFiles}:{supplier:string;label:string;disabled:boolean;onFiles:(files:File[])=>void}) {
  const input=useRef<HTMLInputElement>(null);
  return <div><button type="button" disabled={disabled} className={`${button} procurement-receipt-add`} aria-label={`${label} · ${supplier}`} onClick={()=>input.current?.click()}><Paperclip size={15}/>{label}</button><input hidden type="file" multiple ref={input} accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event=>{const files=Array.from(event.currentTarget.files||[]);event.currentTarget.value='';onFiles(files);}}/></div>;
}
