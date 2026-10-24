'use client';
import React,{useRef,useState} from 'react';
import {Paperclip} from 'lucide-react';
import type {Receipt,ReceiptPlan} from './ProcurementReceipts';
import {isPaymentReceipt,qrIsConfirmed,receiptCoverageCount,pendingQrCoversPayment,paymentRequisites,type DocumentPurpose} from '@/lib/procurement-document-policy';
import {canCollectQrReceiptBeforePayment,hasConfirmedReceiptPayment,needsProcurementReceipt} from '@/lib/procurement-receipt-policy';
import {paymentDeferral} from '@/lib/procurement-schedule';

type Props={plan:ReceiptPlan;files:Receipt[];admin:boolean;disabled:boolean;today:string;
  onRequestQr?:()=>Promise<boolean>;
  onAdd:(files:File[],purpose:DocumentPurpose,replace?:Receipt,refs?:string[])=>Promise<boolean>;
  onChange:(file:Receipt,action:'CONFIRM_QR'|'CLASSIFY'|'LINK_PAYMENT',purpose?:DocumentPurpose,refs?:string[])=>Promise<boolean>;
  onOpen:(file:Receipt,button:HTMLButtonElement)=>void};
export function ProcurementDocumentSections({plan,files,admin,disabled,today,onAdd,onChange,onOpen,onRequestQr}:Props){
  const [panel,setPanel]=useState<string>('');
  const [purpose,setPurpose]=useState<DocumentPurpose>('QR');
  const [selected,setSelected]=useState<string[]>([]);
  const [replacement,setReplacement]=useState<Receipt>();
  const input=useRef<HTMLInputElement>(null);
  const requisitesOptions=paymentRequisites(plan.paymentMethod);
  const defaultRequisitesPurpose:DocumentPurpose=requisitesOptions?.qr?'QR':'REQUISITES';
  const receipts=files.filter(isPaymentReceipt),requisites=files.filter(f=>f.purpose&&f.purpose!=='RECEIPT'&&!f.replacedById),old=files.filter(f=>f.replacedById);
  const paid=hasConfirmedReceiptPayment(plan);
  const complete=['PAID_BY_ONE_C','ISSUED_BY_ONE_C','SMALL_REMAINDER_COMPLETED'].includes(plan.evidence?.state||'');
  const deferred=plan.documentState?.deferred??!!paymentDeferral(plan.oneCCashEvidence);
  const canAddReceipt=paid||canCollectQrReceiptBeforePayment(plan);
  const needReceipt=needsProcurementReceipt(plan,receiptCoverageCount(plan,files),today);
  const hasQr=requisites.some(file=>file.purpose==='QR');
  const requestLabel=hasQr?'Проверить актуальность':'Запросить QR-код';
  const qrConfirmed=hasQr&&requisites.filter(file=>file.purpose==='QR').every(file=>!!plan.plannedDate&&qrIsConfirmed(file,{...plan,status:plan.status||'',paymentMethod:plan.paymentMethod||'',plannedDate:plan.plannedDate},today));
  const canRequest=admin&&onRequestQr&&requisitesOptions?.qr&&!complete&&!deferred&&!qrConfirmed&&plan.status==='APPROVED'&&!plan.documentState?.pendingRevision;
  const payments=[...(plan.evidence?.cashOrders||[]).map(row=>({...row,ref:'ref' in row&&row.ref?`cash:${row.ref}`:''})),...(plan.evidence?.currencyPayments||[]).map(row=>({...row,number:'number' in row?String(row.number):'',ref:'ref' in row&&row.ref?`currency:${row.ref}`:''}))].filter(row=>row.ref);
  const refsDefault=payments.length===1?[payments[0].ref]:[];
  const chooseRequisites=(file?:Receipt)=>{
    setPurpose(file?.purpose==='REQUISITES'?'REQUISITES':defaultRequisitesPurpose);
    setReplacement(file);
    setPanel('');
    input.current?.click();
  };
  const chooseReceipt=()=>{
    setSelected(refsDefault);
    setPurpose('RECEIPT');
    setReplacement(undefined);
    // A single payment (or the existing early QR receipt) needs no extra form.
    // Keep the native picker in this click event so mobile browsers allow it.
    if(payments.length<=1){setPanel('');input.current?.click();}
    else setPanel('receipt');
  };
  const paymentChoices=<fieldset className="payment-document-choices"><legend>Чек за оплату</legend>{payments.map(row=><label key={row.ref}><input type="checkbox" checked={selected.includes(row.ref)} disabled={disabled} onChange={e=>setSelected(prev=>e.target.checked?[...prev,row.ref]:prev.filter(ref=>ref!==row.ref))}/>Расходник {row.number||'без номера'}{row.date?` · ${row.date}`:''}</label>)}</fieldset>;
  const list=(rows:Receipt[],historical=false)=><ul className="payment-document-files">{rows.map(file=>{
    const confirmed=plan.status&&plan.paymentMethod&&plan.plannedDate?qrIsConfirmed(file,{...plan,status:plan.status,paymentMethod:plan.paymentMethod,plannedDate:plan.plannedDate},today):false;
    return <li key={file.id}>
      <button className="payment-document-open" type="button" title={file.originalName} aria-label={`Открыть ${file.originalName}`} onClick={event=>onOpen(file,event.currentTarget)}><Paperclip size={18}/><span>{file.purpose==='QR'?'QR-код для оплаты':file.originalName}</span></button>
      <div className="payment-document-meta">{file.author.name} · {new Date(file.createdAt).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short'})}{historical?' · Заменён':''}</div>
      {!historical&&file.purpose==='QR'&&requisitesOptions?.qr&&!complete&&!deferred?<div className="payment-document-line"><span title={confirmed?`${file.qrConfirmedBy?.name||'Пользователь'} подтвердил актуальность у поставщика`:undefined} className={confirmed?'payment-document-ok':'payment-document-warning'}>{confirmed?'Подтверждён сегодня':'Требует проверки'}</span>{!confirmed&&plan.status==='APPROVED'?<button type="button" disabled={disabled} className="procurement-receipt-button" onClick={()=>setPanel(`confirm:${file.id}`)}>Подтвердить</button>:null}</div>:null}
      {!historical&&!isPaymentReceipt(file)&&requisitesOptions&&!complete?<button type="button" disabled={disabled} className="payment-document-secondary" onClick={()=>chooseRequisites(file)}>Заменить</button>:null}
      {!historical&&admin&&isPaymentReceipt(file)?<button type="button" disabled={disabled} className="payment-document-secondary" onClick={()=>{setPurpose(defaultRequisitesPurpose);setPanel(`classify:${file.id}`);}}>Это реквизиты</button>:null}
      {!historical&&admin&&!isPaymentReceipt(file)&&canAddReceipt?<button type="button" disabled={disabled} className="payment-document-secondary" onClick={()=>{setSelected(refsDefault);setPanel(`receipt:${file.id}`);}}>Это чек оплаты</button>:null}
      {!historical&&isPaymentReceipt(file)&&payments.length>0&&!pendingQrCoversPayment(plan,file)&&(needReceipt||file.paymentRefs==null)?<button type="button" disabled={disabled} className="payment-document-secondary" onClick={()=>{setSelected(Array.isArray(file.paymentRefs)?file.paymentRefs.filter((ref):ref is string=>typeof ref==='string'&&payments.some(p=>p.ref===ref)):refsDefault);setPanel(`link:${file.id}`);}}>Указать расходник</button>:null}
      {panel===`confirm:${file.id}`?<div className="payment-document-panel"><p>Поставщик подтвердил, что по этому QR можно оплатить сегодня?</p><div><button type="button" className="procurement-receipt-button" disabled={disabled} onClick={async()=>{if(await onChange(file,'CONFIRM_QR'))setPanel('');}}>Да, подтвердил</button><button type="button" disabled={disabled} className="procurement-receipt-button" onClick={()=>setPanel('')}>Отмена</button></div></div>:null}
      {panel===`classify:${file.id}`?<div className="payment-document-panel"><p>Этот файл нужен для перевода, а не подтверждает выполненную оплату?</p>{requisitesOptions?.qr?<><label><input type="radio" checked={purpose==='QR'} disabled={disabled} onChange={()=>setPurpose('QR')}/> {requisitesOptions.qrLabel}</label><label><input type="radio" checked={purpose==='REQUISITES'} disabled={disabled} onChange={()=>setPurpose('REQUISITES')}/> {requisitesOptions.fileLabel}</label></>:null}<div><button type="button" className="procurement-receipt-button" disabled={disabled} onClick={async()=>{if(await onChange(file,'CLASSIFY',purpose))setPanel('');}}>Да, это реквизиты</button><button type="button" disabled={disabled} className="procurement-receipt-button" onClick={()=>setPanel('')}>Отмена</button></div></div>:null}
      {panel===`link:${file.id}`?<div className="payment-document-panel">{paymentChoices}<div><button type="button" disabled={disabled||!selected.length} className="procurement-receipt-button" onClick={async()=>{if(await onChange(file,'LINK_PAYMENT',undefined,selected))setPanel('');}}>Связать чек</button><button type="button" disabled={disabled} className="procurement-receipt-button" onClick={()=>setPanel('')}>Отмена</button></div></div>:null}
      {panel===`receipt:${file.id}`?<div className="payment-document-panel"><p>Файл подтверждает выполненную оплату?</p>{payments.length?paymentChoices:null}<div><button type="button" disabled={disabled||(payments.length>0&&!selected.length)} className="procurement-receipt-button" onClick={async()=>{if(await onChange(file,'CLASSIFY','RECEIPT',payments.length?selected:['pending-qr']))setPanel('');}}>Да, это чек</button><button type="button" disabled={disabled} className="procurement-receipt-button" onClick={()=>setPanel('')}>Отмена</button></div></div>:null}
    </li>;
  })}</ul>;
  return <div className="payment-document-sections">
    {requisites.length||requisitesOptions&&!complete?<section><div className="payment-document-heading"><h3>Реквизиты для оплаты</h3>{requisitesOptions&&!complete?<button type="button" disabled={disabled} className="procurement-receipt-button" onClick={()=>chooseRequisites()}>Добавить реквизиты</button>:null}</div>
      {canRequest?<button type="button" className="procurement-receipt-button" disabled={disabled} onClick={()=>setPanel('request-qr')}>{requestLabel}</button>:null}
      {panel==='request-qr'&&canRequest?<div className="payment-document-panel"><p>{hasQr?'Попросить закупщика подтвердить актуальность QR или заменить его?':'Попросить закупщика добавить QR-код для этой оплаты?'}</p><div><button type="button" className="procurement-receipt-button" disabled={disabled} onClick={async()=>{if(await onRequestQr?.())setPanel('');}}>Отправить запрос</button><button type="button" className="procurement-receipt-button" disabled={disabled} onClick={()=>setPanel('')}>Отмена</button></div></div>:null}
      {requisites.length?list(requisites):null}
    </section>:null}
    <section><div className="payment-document-heading"><h3>Чеки оплаты {needReceipt?<span className="payment-document-warning">Нужен чек</span>:null}</h3>{canAddReceipt?<button type="button" disabled={disabled} className="procurement-receipt-button" onClick={chooseReceipt}>Добавить чек</button>:null}</div>
      {receipts.length?list(receipts):<p className="payment-document-empty">{canAddReceipt?'Чек ещё не добавлен':'После оплаты здесь будет чек'}</p>}
      {panel==='receipt'?<div className="payment-document-panel">{payments.length?paymentChoices:<p>Подтверждение перевода поставщику по QR</p>}<div><button type="button" disabled={disabled||(payments.length>0&&!selected.length)} className="procurement-receipt-button" onClick={()=>input.current?.click()}>Выбрать чек</button><button type="button" className="procurement-receipt-button" onClick={()=>setPanel('')}>Отмена</button></div><p>Фото или PDF · до 10 МБ</p></div>:null}
    </section>
    {old.length?<details><summary>Прежние реквизиты · {old.length}</summary>{list(old,true)}</details>:null}
    <input hidden type="file" ref={input} accept="image/jpeg,image/png,image/webp,application/pdf" onChange={async event=>{const files=Array.from(event.currentTarget.files||[]);event.currentTarget.value='';if(files.length&&await onAdd(files,purpose,replacement,purpose==='RECEIPT'?(payments.length?selected:['pending-qr']):undefined))setPanel('');}}/>
  </div>;
}
