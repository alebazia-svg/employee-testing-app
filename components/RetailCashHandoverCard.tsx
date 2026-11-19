'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { auditExperience, experienceAttempt, ExperienceShown } from './EmployeeExperienceAudit';
import { useEmployeePreview } from './EmployeePreviewProvider';
import { CashChecklistAmount, CashChecklistSheet } from './CashChecklistSheet';
import { CashOperationStatusRow } from './CashOperationStatusRow';
import { createIdempotencyKey } from '@/lib/idempotency-key';
import { schedulePersonName } from '@/lib/work-schedule-coverage';
import { EmployeeFinishDayCard } from './workday/EmployeeFinishDayCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Banknote, ArrowRightLeft } from 'lucide-react';
type Handover={reviewReason?:string|null;id:string;revision:number;status:string;actual:number;countedAt:string;recipientName:string|null;recipientUserId:number|null;preparedUntil:string|null;handedAt:string|null;expenseNumber:string|null;receiptNumber:string|null};
const money=(n:number)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)+' ₽';
export function RetailCashHandoverCard({workDayId,taskId,completed,request=fetch,onFinished,renderHandle,early=false}:{workDayId:number;taskId?:number;early?:boolean;completed:boolean;request?:(input:string,init?:RequestInit)=>Promise<Response>;renderHandle?:(close:()=>void,busy:boolean)=>React.ReactNode;onFinished:()=>void}){
 const [h,setH]=useState<Handover|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[form,setForm]=useState(false),[amount,setAmount]=useState('');
 const preview = useEmployeePreview();
 const [attemptId, setAttemptId] = useState(experienceAttempt);
 const [transferClosed,setTransferClosed]=useState(false);
 const countKey=useRef<string|null>(null);const url=`/api/employee/workday/cash-handover?workDayId=${workDayId}`;
 const reload=useCallback(async()=>{try{const r=await request(url,{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error);setH(j.handover);}catch(e){setError(e instanceof Error?e.message:'Нет связи с порталом.');}finally{setLoading(false);}},[request,url]);
 useEffect(()=>{void reload();const t=setInterval(()=>void reload(),10000);return()=>clearInterval(t);},[reload]);
 async function post(action:string,extra:Record<string,unknown>={}){const r=await request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,revision:h?.revision??null,...extra})});const j=await r.json();if(!r.ok)throw Error(j.error||'Не удалось сохранить действие.');setH(j.handover);return j.handover as Handover;}
 async function finish(){const r=await request('/api/employee/workday/finish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workDayId})});const j=await r.json();if(!r.ok||!j.workDay?.endedAt)throw Error(j.error||'Завершение рабочего дня пока не подтверждено.');onFinished();}
 async function run(f:()=>Promise<void>){setBusy(true);setError('');try{await f();}catch(e){setError(e instanceof Error?e.message:'Нет связи с порталом. Сначала обновите сведения о передаче.');await reload();}finally{setBusy(false);}}
 const existingReady=h?.status==='ready'&&!form&&!transferClosed;
 const inputAmount=existingReady?String(h.actual):amount;
 const keepRecipient=h?.status==='ready' && Number(inputAmount.replace(',','.'))===h.actual;
 const positive=(form||existingReady) && Number(inputAmount.replace(',','.'))>0;
 const [offer,setOffer]=useState<{name:string;token:string}|null>(null);
 const [offerError,setOfferError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
   let active=true;setOffer(null);setOfferError('');
   if(positive&&!keepRecipient)void (async()=>{
     try{
       const response=await request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'recipient'})});
       const data=await response.json();if(!response.ok||!data.token)throw Error(data.error||'Не удалось определить получателя.');
       if(active)setOffer(data);
     }catch(e){if(active)setOfferError(e instanceof Error?e.message:'Нет связи.');}
   })();
   return ()=>{active=false;};
 },[positive,keepRecipient,request,url,attempt]);
 async function count(){
   if(keepRecipient){const result=await post('confirm',{handed:true});setForm(false);if(result.handedAt)onFinished();return;}
   if(inputAmount.trim()==='')throw Error('Укажите фактическую сумму наличных.');
   const n=Number(amount.replace(',','.'));
   if(n>0&&!offer)throw Error('Дождитесь имени получателя.');
   countKey.current ??= createIdempotencyKey();
   const result=await post(n===0?'count':'handoff',{amount:n,requestKey:countKey.current,token:offer?.token});
   setForm(false);
   if(result.status==='zero')await finish();else if(result.handedAt)onFinished();
 }
 const pending=h?.handedAt&&!['posted','zero'].includes(h.status);
 if(completed && loading)return null;
 if(completed && h?.handedAt)return <div className='mt-3 grid gap-1 text-sm leading-snug'>
   <p><strong>Передано {money(h.actual)}</strong>{h.recipientName && <> · Получатель: {schedulePersonName(h.recipientName)}</>}</p>
   <p role='status' className={'mt-0.5 text-xs font-extrabold '+(h.status==='posted'?'text-green-700':'text-amber-800')}>{h.status==='posted'?'Проведено в 1С':['review','error'].includes(h.status)?'Передано на проверку':'Оформляется в 1С'}</p>
 </div>;
 if(completed)return <p className='mt-1 text-xs font-semibold'>{h?.status==='zero'?'Остаток 0 ₽. Передавать наличные не требуется.':'Сдача кассы не подтверждена.'}</p>;
 if(loading)return <Card className='p-4'><p className='text-sm text-slate-600'>Загружаем сведения о сдаче кассы…</p></Card>;
 const close=()=>{if(!busy){
   if(taskId && !preview) auditExperience({target:'workflow',action:'retail_cash_count',stage:'cancelled',taskId,attemptId});
   setForm(false);setTransferClosed(true);setAttemptId(experienceAttempt());
 }};
 const zero=inputAmount.trim()!=='' && Number(inputAmount.replace(',','.'))===0;
 if(form||existingReady)return <CashChecklistSheet audit={taskId && <ExperienceShown context={{target:'workflow',action:'retail_cash_count',stage:'opened',taskId,attemptId}}/>} handle={renderHandle?.(close,busy)} title='Завершение дня' step={1} total={0} onClose={close} busy={busy}>
   <div className='employee-material-focus employee-material-focus-current employee-material-form rounded-xl border-l-[5px] p-3 ring-1'>
     <div className='mb-3 flex items-start gap-2'><span className='employee-material-task-glyph mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700 ring-1 ring-green-100'><Banknote className='h-[26px] w-[26px]'/></span><h3 className='mt-0.5 text-base font-extrabold text-slate-950'>Пересчитайте и передайте все наличные</h3></div>
     <CashChecklistAmount value={inputAmount} onChange={value=>{setForm(true);setAmount(value);countKey.current=null;}} error={error}/>
     {positive && <div className='mt-3 rounded-xl border border-slate-200 p-3' aria-live='polite'>{keepRecipient||offer?<p className='text-base font-bold'>Получатель: {schedulePersonName((keepRecipient ? h?.recipientName : offer?.name) ?? '')}</p>:offerError?<><p>{offerError}</p><button type='button' onClick={()=>setAttempt(a=>a+1)}>Проверить ещё раз</button></>:<p>Проверяем, кто на смене…</p>}</div>}
     {zero && <p className='mt-2 text-sm'>В кассе 0 ₽. Передавать деньги не требуется.</p>}
     <div className='mt-4 grid grid-cols-2 gap-2'><Button className='employee-material-secondary-action min-h-10 text-xs font-extrabold' disabled={busy} onClick={close}>Отмена</Button><Button className='employee-material-primary-action min-h-10 text-xs font-extrabold' disabled={busy||(!zero&&(!positive||(!offer&&!keepRecipient)))} onClick={()=>void run(count)}>{busy?'Сохраняем…':zero?'Завершить день':'Деньги переданы'}</Button></div>
   </div>
 </CashChecklistSheet>;
 if(!h)return <EmployeeFinishDayCard id='pwa-current-action' animate={!early} description='Перед уходом укажите остаток. Если касса пуста, введите 0 ₽.' label='Пересчитать кассу' disabled={busy} onClick={()=>{setError('');setAmount('');countKey.current=null;setForm(true);}}>
   {error&&<p role='alert' className='text-sm font-semibold text-red-800'>{error}</p>}
 </EmployeeFinishDayCard>;
 return <div className='space-y-3'>
  {h?.status==='posted'||h?.status==='zero'?<>
   <div className='flex items-center gap-3'><CheckCircle2 className='h-7 w-7 text-green-700'/><h2 className='text-xl font-black'>{h.status==='zero'?'Пересчёт сохранён':'Передача кассы подтверждена'}</h2></div>
   <p className='font-bold'>{h.status==='zero'?'Наличных для передачи нет.':`${money(h.actual)} · ${h.recipientName}`}</p>
   <p className='text-sm text-slate-600'>Осталось подтвердить завершение рабочего дня.</p>
   <Button className='employee-material-primary-action min-h-12 w-full' disabled={busy} onClick={()=>void run(finish)}>Завершить рабочий день</Button>
  </>:pending?<>
   <CashOperationStatusRow title={money(h!.actual)+' · '+h!.recipientName} detail={new Date(h!.handedAt!).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'})} status={['review','error'].includes(h!.status)?'Передано на проверку':'Оформляется в 1С'} />
  </>:h?.status==='ready' ? <Button className='employee-material-primary-action min-h-12 w-full' onClick={()=>setTransferClosed(false)}>Продолжить передачу</Button>:<>
   <p className='text-2xl font-black'>{money(h.actual)}</p><Button className='employee-material-primary-action min-h-12 w-full' disabled={busy} onClick={()=>{setAmount(String(h.actual));setForm(true);}}>Продолжить сдачу кассы</Button><Button className='employee-material-secondary-action min-h-12 w-full' disabled={busy} onClick={()=>{setAmount(String(h.actual));countKey.current=null;setForm(true);}}>Изменить пересчёт</Button>
  </>}
  {error&&<p role='alert' className='text-sm font-semibold text-red-800'>{error}</p>}
 </div>;
}
