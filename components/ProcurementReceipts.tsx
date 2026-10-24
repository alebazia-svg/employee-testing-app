'use client';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';
import React,{useEffect,useId,useRef,useState} from 'react';
import {Paperclip,X} from 'lucide-react';
import {canCollectQrReceiptBeforePayment,needsProcurementReceipt,qrReceiptStatus,receiptPaymentDate,receiptPaymentAmount,RECEIPT_MAX_BYTES,type ReceiptPaymentPlan} from '@/lib/procurement-receipt-policy';
import './procurement-receipts.css';
import {ProcurementReceiptViewer} from './ProcurementReceiptViewer';
import {documentPaymentRefs,documentPaymentSnapshots,receiptPlanContext,isPaymentReceipt,receiptCoverageCount,qrIsConfirmed,type PaymentDocument,type DocumentPurpose} from '@/lib/procurement-document-policy';
import {ProcurementDocumentSections} from './ProcurementDocumentSections';

export type Receipt=PaymentDocument & {planId:string;originalName:string;size:number;createdAt:string;author:{name:string};qrConfirmedBy?:{name:string}|null};
export type ReceiptPlan=ReceiptPaymentPlan & {id:string;supplierPartner:string;plannedAmount:string|number;orderNumbers:string[];updatedAt?:string;oneCCashEvidence?:unknown;foreignAmount?:unknown;currency?:string;supplierCounterparty?:string;orderRefs?:unknown;documentState?:{pendingRevision:boolean;deferred:boolean;paymentMatchFrom:string|null}};
type Plan=ReceiptPlan;
const root='/api/procurement/payment-plans/';
const button='procurement-receipt-button';
const paymentAmount=receiptPaymentAmount;

export function ProcurementReceipts({plans,allPlans=plans,single=false,hideEmptyBeforePayment=false,inline=false,admin=false,onBusyChange,onPreviewChange,onCounts}:{plans:Plan[];allPlans?:Plan[];single?:boolean;hideEmptyBeforePayment?:boolean;inline?:boolean;admin?:boolean;onBusyChange?:(busy:boolean)=>void;onPreviewChange?:(open:boolean)=>void;onCounts?:(counts:Record<string,number>)=>void}) {
  if(process.env.NEXT_PUBLIC_PROCUREMENT_RECEIPTS_ENABLED!=='1')return null;
  return <ReceiptWorkspace plans={plans} allPlans={allPlans} single={single} hideEmptyBeforePayment={hideEmptyBeforePayment} inline={inline} admin={admin} onBusyChange={onBusyChange} onPreviewChange={onPreviewChange} onCounts={onCounts}/>;
}
function ReceiptWorkspace({plans,allPlans,single,hideEmptyBeforePayment,inline,admin,onBusyChange,onPreviewChange,onCounts}:{plans:Plan[];allPlans:Plan[];single:boolean;hideEmptyBeforePayment:boolean;inline:boolean;admin:boolean;onBusyChange?:(busy:boolean)=>void;onPreviewChange?:(open:boolean)=>void;onCounts?:(counts:Record<string,number>)=>void}) {
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
  const evidenceSignature=JSON.stringify(allPlans.map(plan=>[plan.id,receiptPlanContext(plan),plan.evidence?.state,plan.evidence?.verification,documentPaymentSnapshots(plan,documentPaymentRefs(plan))]));
  useEffect(()=>{if(ready)onCounts?.(Object.fromEntries(allPlans.map(plan=>[plan.id,receiptCoverageCount(plan,receipts.filter(r=>r.planId===plan.id))])));},[ready,receipts,signature,evidenceSignature,onCounts]);
  const qrBeforePayment=plans.some(canCollectQrReceiptBeforePayment);
  const load=async(signal?:AbortSignal)=>{
    if(uploading.current)return;
    const version=++requestVersion.current;
    try {
    const ids=signature.split(',').filter(Boolean);
    const result:Receipt[]=[];
    for(let i=0;i<ids.length;i+=100){
      const query=new URLSearchParams(ids.slice(i,i+100).map(id=>['plan',id]));
      query.set('documents','1');
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
  const receiptCount=(plan:Plan)=>receiptCoverageCount(plan,filesFor(plan.id));
  const pending=plans.filter(plan=>needsProcurementReceipt(plan,receiptCount(plan),today));
  const displayed=single?plans:target?allPlans.filter(p=>p.id===target):pending;
  const add=async(plan:Plan,files:File[],purpose:DocumentPurpose='RECEIPT',replace?:Receipt,selectedRefs?:string[])=>{
    if(preview){preview.blocked();return false;}
    if(!files.length||uploading.current)return false;
    uploading.current=true;requestVersion.current++;
    const fromQueue=!single&&!target;
    setBusy(plan.id);onBusyChange?.(true);setError('');setNotice('');
    try {
      for(const file of files){
        if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size<=0||file.size>RECEIPT_MAX_BYTES)throw new Error('Выберите фото JPG, PNG, WebP или PDF до 10 МБ.');
        const data=new FormData();data.set('file',file);data.set('purpose',purpose);
        if(replace){data.set('replaceId',replace.id);data.set('replaceRevision',String(replace.revision??0));}
        if(purpose==='RECEIPT'){
          const refs=documentPaymentRefs(plan);
          data.set('paymentRefs',JSON.stringify(selectedRefs??(refs.length===1?refs:canCollectQrReceiptBeforePayment(plan)?['pending-qr']:[])));
        }
        const response=await fetch(`${root}${encodeURIComponent(plan.id)}/receipts`,{method:'POST',body:data});
        const body=await response.json();if(!response.ok)throw new Error(body.error||'Чек не сохранён. Повторите попытку.');
        setReceipts(prev=>[...prev.filter(r=>r.id!==body.receipt.id).map(r=>r.id===replace?.id?{...r,replacedById:body.receipt.id,revision:(r.revision??0)+1}:r),body.receipt]);
      }
      if(fromQueue)setTarget('');
      setNotice(purpose!=='RECEIPT'?`Реквизиты сохранены · ${plan.supplierPartner}.`:canCollectQrReceiptBeforePayment(plan)
        ? `Чек сохранён · ${plan.supplierPartner}. ${admin?'Оформите расходник в 1С.':''} Заявка завершится после подтверждения оплаты в 1С.`
        : `Чек сохранён · ${plan.supplierPartner}. Доступен в истории оплаты.`);
      window.dispatchEvent(new Event('procurement-receipts-changed'));
      return true;
    }catch(error){setTarget(plan.id);setError(error instanceof Error?error.message:'Чек не сохранён. Повторите попытку.');return false;}
    finally{uploading.current=false;setBusy('');onBusyChange?.(false);}
  };
  const change=async(plan:Plan,file:Receipt,action:'CONFIRM_QR'|'CLASSIFY'|'LINK_PAYMENT',purpose?:DocumentPurpose,paymentRefs?:string[])=>{
    if(preview){preview.blocked();return false;}
    if(uploading.current)return false;
    uploading.current=true;requestVersion.current++;setBusy(plan.id);onBusyChange?.(true);setError('');setNotice('');
    try{
      const response=await fetch(`${root}${encodeURIComponent(plan.id)}/documents/${encodeURIComponent(file.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,purpose,paymentRefs,revision:file.revision??0,planVersion:plan.updatedAt})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||'Изменение не сохранено.');
      setReceipts(prev=>prev.map(row=>row.id===body.receipt.id?body.receipt:row));
      setNotice(action==='CONFIRM_QR'?'Подтверждение QR сохранено на сегодня.':action==='LINK_PAYMENT'?'Чек связан с выбранной оплатой.':'Назначение файла изменено.');
      window.dispatchEvent(new Event('procurement-receipts-changed'));
      return true;
    }catch(error){setError(error instanceof Error?error.message:'Изменение не сохранено.');return false;}
    finally{uploading.current=false;setBusy('');onBusyChange?.(false);}
  };
  const requestQr=async(plan:Plan)=>{
    if(preview){preview.blocked();return false;}
    if(uploading.current)return false;
    uploading.current=true;setBusy(plan.id);onBusyChange?.(true);setError('');setNotice('');
    try{
      const response=await fetch(`${root}${encodeURIComponent(plan.id)}/qr-request`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planVersion:plan.updatedAt,qrFiles:filesFor(plan.id).filter(f=>f.purpose==='QR'&&!f.replacedById).map(f=>({id:f.id,revision:f.revision??0}))})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||'Запрос не сохранён.');
      setNotice(body.alreadyRequested?'Этот запрос уже создан. Повторное уведомление не отправлено.':'Запрос создан. Уведомление придёт в разрешённое время.');
      return true;
    }catch(error){setError(error instanceof Error?error.message:'Запрос не сохранён.');return false;}
    finally{uploading.current=false;setBusy('');onBusyChange?.(false);}
  };
  const viewedPlan=viewFile?allPlans.find(plan=>plan.id===viewFile.file.planId):undefined;
  const viewedQrConfirmed=!!(viewFile&&viewedPlan?.status&&viewedPlan.paymentMethod&&viewedPlan.plannedDate&&qrIsConfirmed(viewFile.file,{...viewedPlan,status:viewedPlan.status,paymentMethod:viewedPlan.paymentMethod,plannedDate:viewedPlan.plannedDate},today));
  // Requisites are available before payment too; never hide their entry point.
  const content=viewFile?<><p className="payment-document-view-status" role="status">{viewFile.file.replacedById?'Прежние реквизиты · файл заменён':viewFile.file.purpose==='QR'?(viewedQrConfirmed?'QR подтверждён сегодня':'QR · перед оплатой уточните актуальность у поставщика'):isPaymentReceipt(viewFile.file)?'Чек оплаты':'Реквизиты для оплаты'}</p><ProcurementReceiptViewer key={viewFile.file.id} url={(preview?.readUrl ?? (url => url))(`${root}${encodeURIComponent(viewFile.file.planId)}/receipts/${encodeURIComponent(viewFile.file.id)}`)} name={viewFile.file.originalName} onBack={closeFile}/></>:<div className={`procurement-receipts-body${inline?' payment-documents-inline':''}`}>
        {busy?<p role="status" className="mb-3 text-sm text-slate-700">Сохраняем документ…</p>:null}
        {notice?<p role="status" className="mb-3 rounded-lg bg-[#f8f2eb] p-3 text-sm text-[#754725]">{notice}</p>:null}
        {error?<div role="alert"><p>{error}</p><button type="button" className={button} disabled={!!busy} onClick={()=>load().catch(error=>setError(error.message))}>Повторить загрузку</button></div>:null}
        {!ready?<p>Загружаем чеки…</p>:<>
          {!displayed.length?<p>Нет оплат, для которых нужно добавить чек.</p>:<ul className="procurement-receipts-list">{displayed.map(plan=><li key={plan.id} style={inline?{gridTemplateColumns:'minmax(0,1fr) auto'}:undefined}>
            {inline?null:<><div><h3>{plan.supplierPartner}</h3><p>{plan.orderNumbers.length?'Заказ '+plan.orderNumbers.join(', '):'Оплата поставщику'}</p></div><div className="procurement-receipt-amount"><strong>{paymentAmount(plan)}</strong>{canCollectQrReceiptBeforePayment(plan)?<p>Сумма заявки</p>:null}</div></>}
            <div className="col-span-full"><ProcurementDocumentSections key={`${plan.id}:${plan.paymentMethod}`} plan={plan} files={filesFor(plan.id)} admin={admin} disabled={!!busy||!!preview} today={today} onRequestQr={()=>requestQr(plan)} onAdd={(files,purpose,replace,refs)=>add(plan,files,purpose,replace,refs)} onChange={(file,action,purpose,refs)=>change(plan,file,action,purpose,refs)} onOpen={(file,opener)=>{fileOpener.current=opener;setViewFile({file,supplier:plan.supplierPartner});}}/></div>
          </li>)}</ul>}
          {target&&!single?<button className={button} onClick={()=>setTarget('')}>К остальным оплатам</button>:null}
        </>}
      </div>;
  if(inline)return content;
  return <>
    <button type="button" className={button} onClick={()=>{setViewFile(null);setNotice('');setTarget(single?plans[0]?.id||'':'');setOpen(true);}}><Paperclip size={15}/>{single?'Документы оплаты':ready?`Нужны чеки · ${pending.length}`:error?'Чеки · не удалось загрузить':'Чеки · загрузка'}</button>
    {single&&ready&&plans[0]&&qrReceiptStatus(plans[0],receiptCount(plans[0]),admin)?<p className="mt-1 text-xs text-slate-600" role="status">{qrReceiptStatus(plans[0],receiptCount(plans[0]),admin)}</p>:null}
    <dialog ref={dialog} aria-labelledby={titleId} className={`procurement-receipts-dialog ${viewFile?'receipt-view-expanded':''}`} onCancel={event=>{event.preventDefault();if(!busy){setViewFile(null);setOpen(false);}}}>
      <header><h2 id={titleId}>{viewFile?`${viewFile.supplier} · ${isPaymentReceipt(viewFile.file)?'Чек оплаты':'Реквизиты для оплаты'}`:single||target?'Документы оплаты':'Нужны чеки'}</h2><button type="button" className={button} disabled={!!busy} aria-label="Закрыть чеки" onClick={()=>{setViewFile(null);setOpen(false);}}><X size={18}/></button></header>
      {content}
    </dialog>
  </>;
}
