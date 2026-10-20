'use client';
import {FiscalNotificationDialog} from './FiscalNotificationDialog';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';
import {useEffect,useRef,useState} from 'react';
import {supplierOnlyPaymentLabel} from '@/lib/procurement-supplier-advance';
import {useRouter} from 'next/navigation';
import {X} from 'lucide-react';
import type {NotificationDetail,NotificationPlan} from '@/lib/notification-detail';
import {safeNotificationHref, employeeNotificationOpening} from '@/lib/notification-opening';
import {ExpenseRequestDialogRow} from './ExpenseRequestDialogRow';
import {ProcurementApprovedEdit} from './ProcurementApprovedEdit';
import {ProcurementReceipts} from './ProcurementReceipts';
import './procurement-admin-list.css';

export type NotificationSelection={kind?:string;id:string|number;audience:'admin'|'employee';title:string;body:string;href:string;sourceType?:string};
function StandardNotificationRecordDialog({item,onClose,onViewed,readOnly=false}:{readOnly?:boolean;item:NotificationSelection;onClose:()=>void;onViewed?:()=>void}) {
  const inspection=useEmployeePreview();
  const inspectRecord=!!inspection && employeeNotificationOpening({kind:item.kind??''})!=='page';
  const router=useRouter(),dialog=useRef<HTMLDialogElement>(null);
  const [detail,setDetail]=useState<NotificationDetail|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [state,setState]=useState({dirty:false,busy:false}),[discard,setDiscard]=useState(false);
  const [decision,setDecision]=useState(''),[reason,setReason]=useState(''),[message,setMessage]=useState('');
  const [saving,setSaving]=useState(false);
  const [receiptPreview,setReceiptPreview]=useState(false);
  const viewed=useRef(false),viewCallback=useRef(onViewed);viewCallback.current=onViewed;
  const busy=state.busy||saving;
  const close=()=>{if(busy)return;if(state.dirty||reason.trim())setDiscard(true);else onClose();};
  useEffect(()=>{
    if(readOnly&&!inspectRecord)return;
    const abort=new AbortController();setError('');
    (inspection?.request ?? fetch)(`/api/notification-details/${item.audience}/${encodeURIComponent(item.id)}`,{cache:'no-store',signal:abort.signal})
      .then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.error||'Не удалось открыть запись.');return body;})
      .then(body=>{if(!abort.signal.aborted){setDetail(body);if(!readOnly&&!viewed.current){viewed.current=true;viewCallback.current?.();}}})
      .catch(()=>{if(!abort.signal.aborted)setError('Не удалось загрузить актуальные данные. Повторите попытку — уведомление сохранено.');});
    return()=>abort.abort();
  },[item.audience,item.id,retry,readOnly,inspectRecord,inspection]);
  const expense=detail?.kind==='expense';
  useEffect(()=>{
    if(expense)return;
    const el=dialog.current!,opener=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
    el.showModal();document.body.style.overflow='hidden';
    return()=>{el.close();document.body.style.overflow=overflow;requestAnimationFrame(()=>{if(opener?.isConnected&&!document.querySelector('dialog[open]'))opener.focus();});};
  },[expense]);
  async function decide(plan:NotificationPlan,action:string){
    if(readOnly||busy||!plan.revision)return;setSaving(true);setError('');
    try{
      const revision=plan.revision;
      const response=await fetch(`/api/admin/procurement/payment-plans/${encodeURIComponent(plan.id)}/revision`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action==='RETURN'?'REJECT':action,revisionId:revision.id,reason})});
      const body=await response.json();if(!response.ok)throw Error(body.error||'Не удалось сохранить решение.');
      setDetail(current=>current&&current.kind!=='expense'?{...current,plan:{...current.plan,revision:null}}:current);
      setReason('');setDecision('');setMessage(action==='APPROVE'?'Решение сохранено.':'Изменения отклонены с пояснением.');setRetry(v=>v+1);router.refresh();
    }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить решение.');}finally{setSaving(false);}
  }
  if(expense)return <ExpenseRequestDialogRow item={detail.item} initialOpen detailOnly onDismiss={onClose}/>;
  const plan=detail?.plan??null;
  return <dialog ref={dialog} className={`pam-dialog ${receiptPreview?'receipt-notification-preview':''}`} aria-label={item.title} onCancel={e=>{e.preventDefault();close();}}>
    <header className="pam-dialog-heading"><h2>{item.title}</h2><button aria-label="Закрыть уведомление" disabled={busy} onClick={close}><X size={20}/></button></header>
    <div className="pam-dialog-content space-y-4">
      {discard&&<><h3 className="font-bold">Закрыть без сохранения?</h3><p>Введённые изменения не сохранятся.</p></>}
      <div hidden={discard} className="space-y-4">
        {!detail?<><p className="whitespace-pre-wrap text-sm">{item.body}</p>{!error&&!readOnly&&<p role="status" className="text-sm text-slate-500">Загружаем актуальные данные…</p>}</>:null}
        {plan&&<>
          <div hidden={receiptPreview} className="space-y-4">
          <div><h3 className="text-xl font-bold">{plan.supplierPartner}</h3><p className="mt-1 text-sm text-slate-500">{plan.planCode} · {plan.orderNumbers.length?'Заказ '+plan.orderNumbers.join(', '):plan.paymentPurpose==='DELIVERY'?'За доставку':supplierOnlyPaymentLabel(plan)}</p></div>
          <dl className="grid grid-cols-2 gap-4 rounded-xl border border-stone-200 bg-stone-50 p-4"><div><dt className="text-xs text-slate-500">Сумма заявки</dt><dd className="mt-1 text-xl font-bold">{Number(plan.foreignAmount||plan.plannedAmount).toLocaleString('ru-RU')} {plan.foreignAmount?plan.paymentMethod:'₽'}</dd></div><div><dt className="text-xs text-slate-500">Подготовить к</dt><dd className="mt-1 font-semibold">{new Date(plan.plannedDate).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}</dd></div></dl>
          <p className="text-sm">{({SUBMITTED:'Ждёт решения',APPROVED:'Заявка согласована',NEEDS_CHANGES:'Нужно исправить',CANCELLED:'Заявка отменена',COMPLETED_WITHOUT_TOPUP:'Завершена без доплаты'} as Record<string,string>)[plan.status]||plan.status}</p>
          <p className="text-sm text-slate-600">{({CASH:'Наличные',BANK:'Перевод на карту',ACCOUNTABLE_QR:'Оплата по QR',USDT:'Оплата в USDT',CNY:'Перевод в юанях'} as Record<string,string>)[plan.paymentMethod]||plan.paymentMethod}{plan.exchangeRate&&` · курс ${Number(plan.exchangeRate).toLocaleString('ru-RU')} ₽`}</p>
          {plan.condition&&<p className="whitespace-pre-wrap text-sm">{plan.condition}</p>}
          {plan.revision&&<><p className="text-sm font-semibold">Изменения на согласование</p><p className="text-xs text-slate-500">До согласования действуют прежние условия.</p><dl className="divide-y divide-stone-200">{plan.revision.changes.map(c=><div key={c.label} className="py-3"><dt className="mb-2 text-sm font-semibold">{c.label}</dt><dd className="grid grid-cols-2 gap-4 text-sm"><div><span className="block text-xs text-slate-500">Сейчас</span>{c.before||'—'}</div><div><span className="block text-xs text-[#785537]">Предлагается</span><strong>{c.after||'—'}</strong></div></dd></div>)}</dl><p className="text-sm"><strong>Причина: </strong>{plan.revision.reason}</p></>}
          </div>
          {detail?.kind==='receipts'?<ProcurementReceipts plans={[plan]} single inline admin={detail.admin} onPreviewChange={setReceiptPreview} onBusyChange={value=>setState(s=>({...s,busy:value}))}/>:detail?.kind==='payment'&&detail.admin&&plan.status==='APPROVED'&&!plan.revision?<ProcurementApprovedEdit plan={plan} today={new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Moscow'})} onStateChange={setState} onSaved={saved=>setDetail(current=>current&&current.kind!=='expense'?{...current,plan:{...current.plan,...saved}}:current)}/>:null}
          {detail?.kind==='payment'&&detail.admin&&plan.status==='SUBMITTED'&&!plan.revision&&<p className="text-sm text-slate-600">Согласование — в платёжном календаре, после сверки оплат.</p>}
          {decision==='RETURN'&&<label className="block text-sm font-semibold">{plan.revision?'Причина отказа':'Что исправить'}<textarea autoFocus minLength={3} maxLength={300} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)} className="mt-2 w-full rounded-lg border p-3"/></label>}
        </>}
        {readOnly&&<p className="text-xs text-slate-500">Режим проверки · уведомление осталось непрочитанным</p>}
        {message&&<p role="status" className="text-sm text-green-800">{message}</p>}
        {saving&&<p role="status" className="text-sm text-slate-600">{plan?.revision?'Проверяем оплату в 1С и сохраняем решение…':'Сохраняем решение…'}</p>}
        {error&&<div role="alert"><p className="pam-error">{error}</p><button className="pam-button" disabled={busy} onClick={()=>setRetry(v=>v+1)}>Повторить загрузку</button></div>}
      </div>
    </div>
    <footer className="pam-dialog-footer">{discard?<><button className="pam-button" onClick={()=>setDiscard(false)}>Продолжить редактирование</button><button className="pam-button" onClick={onClose}>Не сохранять</button></>:<>
      <button className="pam-button" disabled={busy} onClick={close}>Закрыть</button>
      {!readOnly&&!state.dirty&&<button className="pam-button" disabled={busy} onClick={()=>{onClose();router.push(safeNotificationHref(item.href,item.audience==='admin'?'/admin/inbox':'/employee'));}}>Открыть раздел</button>}
      {detail?.kind==='payment'&&detail.admin&&plan?.revision&&<>{decision==='RETURN'?<button className="pam-button pam-primary" disabled={busy||reason.trim().length<3} onClick={()=>decide(plan,'RETURN')}>Сохранить решение</button>:<><button className="pam-button" disabled={busy} onClick={()=>setDecision('RETURN')}>Отклонить изменения</button><button className="pam-button pam-primary" disabled={busy} onClick={()=>decide(plan,'APPROVE')}>{busy?'Сохраняем…':'Согласовать изменения'}</button></>}</>}
    </>}</footer>
  </dialog>;
}

export function NotificationRecordDialog(props:{readOnly?:boolean;item:NotificationSelection;onClose:()=>void;onViewed?:()=>void}) {
 if(props.item.audience==='admin'&&props.item.sourceType==='terminal_fiscal_review')return <FiscalNotificationDialog {...props}/>;
 return <StandardNotificationRecordDialog {...props}/>;
}
