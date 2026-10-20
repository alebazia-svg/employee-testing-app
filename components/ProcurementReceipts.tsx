'use client';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';
import React,{useEffect,useId,useRef,useState} from 'react';
import {Paperclip,X} from 'lucide-react';
import {canCollectQrReceiptBeforePayment,needsProcurementReceipt,qrReceiptStatus,receiptPaymentDate,receiptPaymentAmount,RECEIPT_MAX_BYTES,type ReceiptPaymentPlan} from '@/lib/procurement-receipt-policy';
import './procurement-receipts.css';
import {ProcurementReceiptViewer} from './ProcurementReceiptViewer';

type Receipt={id:string;planId:string;originalName:string;size:number;createdAt:string;author:{name:string}};
type Plan=ReceiptPaymentPlan & {id:string;supplierPartner:string;plannedAmount:string|number;orderNumbers:string[]};
const root='/api/procurement/payment-plans/';
const button='procurement-receipt-button';
const paymentAmount=receiptPaymentAmount;

export function ProcurementReceipts({plans,allPlans=plans,single=false,hideEmptyBeforePayment=false,inline=false,admin=false,onBusyChange,onPreviewChange}:{plans:Plan[];allPlans?:Plan[];single?:boolean;hideEmptyBeforePayment?:boolean;inline?:boolean;admin?:boolean;onBusyChange?:(busy:boolean)=>void;onPreviewChange?:(open:boolean)=>void}) {
  if(process.env.NEXT_PUBLIC_PROCUREMENT_RECEIPTS_ENABLED!=='1')return null;
  return <ReceiptWorkspace plans={plans} allPlans={allPlans} single={single} hideEmptyBeforePayment={hideEmptyBeforePayment} inline={inline} admin={admin} onBusyChange={onBusyChange} onPreviewChange={onPreviewChange}/>;
}
function ReceiptWorkspace({plans,allPlans,single,hideEmptyBeforePayment,inline,admin,onBusyChange,onPreviewChange}:{plans:Plan[];allPlans:Plan[];single:boolean;hideEmptyBeforePayment:boolean;inline:boolean;admin:boolean;onBusyChange?:(busy:boolean)=>void;onPreviewChange?:(open:boolean)=>void}) {
  const preview = useEmployeePreview();
  const [viewFile,setViewFile]=useState<{file:Receipt;supplier:string}|null>(null);
  useEffect(()=>{onPreviewChange?.(!!viewFile);},[viewFile,onPreviewChange]);
  const fileOpener=useRef<HTMLButtonElement|null>(null);
  const closeFile=()=>{setViewFile(null);requestAnimationFrame(()=>fileOpener.current?.isConnected&&fileOpener.current.focus({preventScroll:true}));};
  const [receipts,setReceipts]=useState<Receipt[]>([]);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState('');
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState('');
  const [target,setTarget]=useState('');
  const [notice,setNotice]=useState('');
  const [today,setToday]=useState(()=>receiptPaymentDate(new Date().toISOString()));
  const dialog=useRef<HTMLDialogElement>(null);
  const titleId=useId();
  const requestVersion=useRef(0);
  const uploading=useRef(false);
  const signature=allPlans.map(p=>p.id).sort().join(',');
  const qrBeforePayment=plans.some(canCollectQrReceiptBeforePayment);
  const load=async(signal?:AbortSignal)=>{
    if(uploading.current)return;
    const version=++requestVersion.current;
    try {
    const ids=signature.split(',').filter(Boolean);
    const result:Receipt[]=[];
    for(let i=0;i<ids.length;i+=100){
      const query=new URLSearchParams(ids.slice(i,i+100).map(id=>['plan',id]));
      const response=await (preview?.request ?? fetch)(`/api/procurement/receipts?${query}`,{cache:'no-store',signal});
      if(!response.ok)throw new Error('Не удалось загрузить чеки. Повторите позже.');
      result.push(...(await response.json()).receipts);
    }
    if(version!==requestVersion.current)return;
    setReceipts(result);setReady(true);setError('');
    }catch(error){if(version===requestVersion.current)throw error;}
  };
  useEffect(()=>{
    if(single&&!open&&!hideEmptyBeforePayment&&!inline&&!qrBeforePayment)return;
    const abort=new AbortController();setReady(false);
    load(abort.signal).catch(error=>{if(!abort.signal.aborted)setError(error.message);});
    const refresh=()=>{if(!document.hidden){setToday(receiptPaymentDate(new Date().toISOString()));load(abort.signal).catch(()=>{});}};
    const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);window.addEventListener('procurement-receipts-changed',refresh);
    return()=>{abort.abort();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('procurement-receipts-changed',refresh);};
  // Depend on identities, not the array rebuilt by the calendar on each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[signature,single,open,hideEmptyBeforePayment,inline,qrBeforePayment]);
  useEffect(()=>{
    if(single)return;
    const id=new URLSearchParams(window.location.search).get('receipts');
    if(id&&allPlans.some(p=>p.id===id)){setTarget(id);setOpen(true);}
  },[signature,single]);
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  const filesFor=(id:string)=>receipts.filter(file=>file.planId===id);
  const pending=plans.filter(plan=>needsProcurementReceipt(plan,filesFor(plan.id).length,today));
  const displayed=single?plans:target?allPlans.filter(p=>p.id===target):pending;
  const add=async(plan:Plan,files:File[])=>{
    if(preview){preview.blocked();return;}
    if(!files.length||uploading.current)return;
    uploading.current=true;requestVersion.current++;
    const fromQueue=!single&&!target;
    setBusy(plan.id);onBusyChange?.(true);setError('');setNotice('');
    try {
      for(const file of files){
        if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size<=0||file.size>RECEIPT_MAX_BYTES)throw new Error('Выберите фото JPG, PNG, WebP или PDF до 10 МБ.');
        const data=new FormData();data.set('file',file);
        const response=await fetch(`${root}${encodeURIComponent(plan.id)}/receipts`,{method:'POST',body:data});
        const body=await response.json();if(!response.ok)throw new Error(body.error||'Чек не сохранён. Повторите попытку.');
        setReceipts(prev=>[...prev.filter(r=>r.id!==body.receipt.id),body.receipt]);
      }
      if(fromQueue)setTarget('');
      setNotice(canCollectQrReceiptBeforePayment(plan)
        ? `Чек сохранён · ${plan.supplierPartner}. ${admin?'Оформите расходник в 1С.':'Администратор увидит его в портале.'} Заявка завершится после подтверждения оплаты в 1С.`
        : `Чек сохранён · ${plan.supplierPartner}. Доступен в истории оплаты.`);
      window.dispatchEvent(new Event('procurement-receipts-changed'));
    }catch(error){setTarget(plan.id);setError(error instanceof Error?error.message:'Чек не сохранён. Повторите попытку.');}
    finally{uploading.current=false;setBusy('');onBusyChange?.(false);}
  };
  const hasPayment=plans.some(plan=>Number(plan.evidence?.issuedAmount)>0||Number(plan.evidence?.paidAmount)>0||Number(plan.evidence?.paidForeignAmount)>0||Boolean(plan.evidence?.cashOrders?.length)||Boolean(plan.evidence?.currencyPayments?.length));
  if(single&&hideEmptyBeforePayment&&!open&&!error&&ready&&!receipts.length&&!hasPayment&&!qrBeforePayment)return null;
  const content=viewFile?<ProcurementReceiptViewer key={viewFile.file.id} url={(preview?.readUrl ?? (url => url))(`${root}${encodeURIComponent(viewFile.file.planId)}/receipts/${encodeURIComponent(viewFile.file.id)}`)} name={viewFile.file.originalName} onBack={closeFile}/>:<div className="procurement-receipts-body">
        <p className="mb-3 text-sm text-slate-500">Чек перевода поставщику · фото или PDF до 10 МБ.</p>
        {notice?<p role="status" className="mb-3 rounded-lg bg-[#f8f2eb] p-3 text-sm text-[#754725]">{notice}</p>:null}
        {error?<div role="alert"><p>{error}</p><button type="button" className={button} disabled={!!busy} onClick={()=>load().catch(error=>setError(error.message))}>Повторить загрузку</button></div>:null}
        {!ready?<p>Загружаем чеки…</p>:<>
          {!displayed.length?<p>Нет оплат, для которых нужно добавить чек.</p>:<ul className="procurement-receipts-list">{displayed.map(plan=><li key={plan.id} style={inline?{gridTemplateColumns:'minmax(0,1fr) auto'}:undefined}>
            {inline?<div><h3>Чеки оплаты</h3></div>:<><div><h3>{plan.supplierPartner}</h3><p>{plan.orderNumbers.length?'Заказ '+plan.orderNumbers.join(', '):'Оплата поставщику'}</p></div><div className="procurement-receipt-amount"><strong>{paymentAmount(plan)}</strong>{canCollectQrReceiptBeforePayment(plan)?<p>Сумма заявки</p>:null}</div></>}
            <ReceiptPicker disabled={!!busy || !!preview} supplier={plan.supplierPartner} label={busy===plan.id?'Сохраняем…':filesFor(plan.id).length?'Добавить ещё':'Добавить чек'} onFiles={files=>add(plan,files)}/>
            {qrReceiptStatus(plan,filesFor(plan.id).length,admin)?<p className="col-span-full" role="status">{qrReceiptStatus(plan,filesFor(plan.id).length,admin)}</p>:canCollectQrReceiptBeforePayment(plan)?<p className="col-span-full">После оплаты по QR добавьте чек. Заявка завершится после оформления оплаты в 1С.</p>:null}
            {filesFor(plan.id).length?<ul className="procurement-receipts-files">{filesFor(plan.id).map(file=><li key={file.id}><button type="button" className="receipt-preview-open" onClick={event=>{fileOpener.current=event.currentTarget;setViewFile({file,supplier:plan.supplierPartner});}} aria-label={`Посмотреть чек ${file.originalName}`}><Paperclip size={22} aria-hidden="true"/><div><strong>{file.originalName}</strong><em>Посмотреть чек</em></div></button><span>{file.author.name} · {new Date(file.createdAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span></li>)}</ul>:null}
          </li>)}</ul>}
          {target&&!single?<button className={button} onClick={()=>setTarget('')}>К остальным оплатам</button>:null}
        </>}
      </div>;
  if(inline)return content;
  return <>
    <button type="button" className={button} onClick={()=>{setViewFile(null);setNotice('');setTarget(single?plans[0]?.id||'':'');setOpen(true);}}><Paperclip size={15}/>{single?(qrBeforePayment&&ready&&!receipts.length?'Добавить чек':'Чеки оплаты'):ready?`Нужны чеки · ${pending.length}`:error?'Чеки · не удалось загрузить':'Чеки · загрузка'}</button>
    {single&&ready&&plans[0]&&qrReceiptStatus(plans[0],filesFor(plans[0].id).length,admin)?<p className="mt-1 text-xs text-slate-600" role="status">{qrReceiptStatus(plans[0],filesFor(plans[0].id).length,admin)}</p>:null}
    <dialog ref={dialog} aria-labelledby={titleId} className={`procurement-receipts-dialog ${viewFile?'receipt-view-expanded':''}`} onCancel={event=>{event.preventDefault();if(!busy){setViewFile(null);setOpen(false);}}}>
      <header><h2 id={titleId}>{viewFile?`${viewFile.supplier} · Чек оплаты`:single||target?'Чеки оплаты':'Нужны чеки'}</h2><button type="button" className={button} disabled={!!busy} aria-label="Закрыть чеки" onClick={()=>{setViewFile(null);setOpen(false);}}><X size={18}/></button></header>
      {content}
    </dialog>
  </>;
}
function ReceiptPicker({supplier,label,disabled,onFiles}:{supplier:string;label:string;disabled:boolean;onFiles:(files:File[])=>void}) {
  const input=useRef<HTMLInputElement>(null);
  return <div><button type="button" disabled={disabled} className={`${button} procurement-receipt-add`} aria-label={`${label} · ${supplier}`} onClick={()=>input.current?.click()}><Paperclip size={15}/>{label}</button><input hidden type="file" multiple ref={input} accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event=>{const files=Array.from(event.currentTarget.files||[]);event.currentTarget.value='';onFiles(files);}}/></div>;
}
