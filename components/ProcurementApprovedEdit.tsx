'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ProcurementUsdtFields} from './ProcurementUsdtFields';
import {ProcurementCnyFields} from './ProcurementCnyFields';
import {buyerPaymentComment} from '@/lib/procurement-buyer-comment';
import {supplierOnlyPaymentLabel} from '@/lib/procurement-supplier-advance';
import {ProcurementFundingSchedule} from './ProcurementFundingSchedule';
import {paymentDeferral} from '@/lib/procurement-schedule';

type Plan={id:string;supplierPartner:string;plannedDate:string;updatedAt?:string;plannedAmount:string;foreignAmount:string|null;exchangeRate:string|null;paymentMethod:string;condition:string;orderNumbers:string[];paymentPurpose?:string;oneCCashEvidence?:unknown};
const draftOf=(p:Plan)=>({plannedDate:p.plannedDate.slice(0,10),plannedAmount:p.plannedAmount,foreignAmount:p.foreignAmount||'',exchangeRate:p.exchangeRate||'',paymentMethod:p.paymentMethod,condition:buyerPaymentComment(p.condition)});
export function ProcurementApprovedEdit({plan,today,disabled=false,pending=false,beforeApproval=false,onStateChange,onSaved}:{plan:Plan;today:string;disabled?:boolean;pending?:boolean;beforeApproval?:boolean;onStateChange:(state:{dirty:boolean;busy:boolean;editing?:boolean})=>void;onSaved?:(plan:Plan)=>void}) {
  const router=useRouter();
  const [scheduling,setScheduling]=useState(false);
  const [open,setOpen]=useState(false),[draft,setDraft]=useState(()=>draftOf(plan)),[original,setOriginal]=useState(()=>draftOf(plan));
  const [version,setVersion]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false),[discard,setDiscard]=useState(false);
  const [savedPlan,setSavedPlan]=useState<Plan|null>(null);
  const currentPlan=savedPlan?.updatedAt&&savedPlan.updatedAt>=(plan.updatedAt||'')?savedPlan:plan;
  const dirty=open&&(JSON.stringify(draft)!==JSON.stringify(original)||!!reason.trim());
  useEffect(()=>{if(!scheduling)onStateChange({dirty,busy,editing:open});},[dirty,busy,open,scheduling,onStateChange]);
  useEffect(()=>()=>onStateChange({dirty:false,busy:false}),[onStateChange]);
  const close=()=>{if(busy)return;if(dirty)setDiscard(true);else setOpen(false);};
  async function submit(e:React.FormEvent){
    e.preventDefault();if(busy||disabled||pending)return;setBusy(true);setError('');
    // Send only edited fields: old FX estimates and hidden review comments stay intact.
    const changes=Object.fromEntries(Object.entries(draft).filter(([k,v])=>v!==original[k as keyof typeof original]));
    try{const r=await fetch(`/api/admin/procurement/payment-plans/${plan.id}/edit`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...changes,reason,version})});const data=await r.json();if(!r.ok)throw Error(data.error||'Не удалось сохранить.');setSavedPlan(data);setOpen(false);setDone(true);onSaved?.(data);router.refresh();}
    catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить. Повторите позже.');}finally{setBusy(false);}
  }
  if(scheduling)return <ProcurementFundingSchedule plan={currentPlan} today={today} onStateChange={onStateChange} onClose={()=>setScheduling(false)} onSaved={data=>{const next={...currentPlan,...data};setSavedPlan(next);setScheduling(false);setDone(true);onSaved?.(next);router.refresh();}}/>;
  if(!open)return <div style={{gridColumn:'1 / -1'}}>{done?<p role="status" className="mb-2 text-sm text-green-800">{beforeApproval?'Изменения сохранены. Заявка ждёт вашего согласования.':'Изменения сохранены. Уведомление для Астемира создано.'}</p>:null}<div className="flex flex-wrap gap-2"><button type="button" className="pam-button" disabled={disabled||pending||!currentPlan.updatedAt} onClick={()=>{const d=draftOf(currentPlan);setDraft(d);setOriginal(d);setVersion(currentPlan.updatedAt!);setReason('');setError('');setDone(false);setDiscard(false);setOpen(true);}}>Изменить</button>{!beforeApproval?<button type="button" className="pam-button" disabled={disabled||pending||!currentPlan.updatedAt} onClick={()=>{setDone(false);setScheduling(true);}}>{paymentDeferral(currentPlan.oneCCashEvidence)?'Изменить отсрочку':'Отложить оплату'}</button>:null}</div>{disabled||pending?<p className="mt-1 text-xs text-slate-500">{pending?'Изменения Астемира уже на согласовании.':'Редактирование доступно после проверки оплаты в 1С.'}</p>:null}</div>;
  if(discard)return <div style={{gridColumn:'1 / -1'}} className="space-y-3"><h3 className="font-bold">Отменить изменения?</h3><div className="flex gap-2"><button className="pam-button" onClick={()=>setDiscard(false)}>Продолжить</button><button className="pam-button" onClick={()=>{setDiscard(false);setOpen(false);}}>Не сохранять</button></div></div>;
  const input='mt-1 block min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-normal';
  return <form aria-label="Изменить заявку" onSubmit={submit} style={{gridColumn:'1 / -1'}} className="space-y-3 rounded-xl border border-stone-200 p-4">
    <h3 className="font-bold">Изменить заявку</h3>
    {paymentDeferral(currentPlan.oneCCashEvidence)?<p className="text-xs text-slate-600">Перенос даты не отменяет отсрочку. В календаре учитывается более поздняя дата заявки и готовности денег.</p>:null}
    <p className="text-xs text-slate-600">{plan.paymentPurpose==='DELIVERY'?'Доставка':plan.orderNumbers.length?'Заказ '+plan.orderNumbers.join(', '):supplierOnlyPaymentLabel(plan)} · основание оплаты сохраняется</p>
    <fieldset disabled={busy} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Подготовить к<input type="date" required value={draft.plannedDate} min={draft.plannedDate===original.plannedDate?undefined:today} onChange={e=>setDraft({...draft,plannedDate:e.target.value})} className={input}/></label>
      <label className="text-sm font-semibold">Способ оплаты<select value={draft.paymentMethod} onChange={e=>setDraft({...draft,paymentMethod:e.target.value,foreignAmount:'',exchangeRate:''})} className={input}><option value="CASH">Наличные</option><option value="BANK">Перевод на карту</option><option value="ACCOUNTABLE_QR">Оплата по QR</option><option value="USDT">Оплата в USDT</option><option value="CNY">Перевод в юанях</option></select></label></div>
      {draft.paymentMethod==='USDT'?<ProcurementUsdtFields key="usdt" amount={draft.foreignAmount} rate={draft.exchangeRate} legacyRubles={draft.plannedAmount} source="" available={null} onChange={patch=>setDraft({...draft,foreignAmount:patch.foreignAmount,exchangeRate:patch.exchangeRate,plannedAmount:patch.plannedAmount})}/>:draft.paymentMethod==='CNY'?<ProcurementCnyFields key="cny" amount={draft.foreignAmount} rate={draft.exchangeRate} legacyRubles={draft.plannedAmount} onChange={patch=>setDraft({...draft,...patch})}/>:<label className="block text-sm font-semibold">Сумма заявки, ₽<input type="number" min="0.01" step="0.01" required value={draft.plannedAmount} onChange={e=>setDraft({...draft,plannedAmount:e.target.value})} className={input}/></label>}
      <label className="block text-sm font-semibold">Комментарий<textarea rows={2} maxLength={5000} value={draft.condition} onChange={e=>setDraft({...draft,condition:e.target.value})} className={input}/></label>
      <label className="block text-sm font-semibold">Причина изменения · необязательно<textarea maxLength={500} rows={2} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Можно оставить пустым" className={input}/></label>
    </fieldset>
    <p className="text-xs text-slate-600">{beforeApproval?'После сохранения заявка останется на согласовании. Астемир получит уведомление об изменении.':'Ваши изменения действуют сразу. Согласование сохраняется, Астемир получит уведомление.'} Документы 1С не изменяются.</p>
    {error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}
    <div className="flex flex-wrap justify-end gap-2"><button type="button" className="pam-button" disabled={busy} onClick={close}>Отмена</button><button type="submit" className="pam-button pam-primary" disabled={busy||disabled||pending||JSON.stringify(draft)===JSON.stringify(original)}>{busy?'Проверяем оплату…':'Сохранить изменения'}</button></div>
  </form>;
}
