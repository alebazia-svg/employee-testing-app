'use client';
import { employeeObservedFetch } from '@/lib/employee-observed-fetch';
import { workflowEvent,workflowJson } from '@/lib/employee-workflow-client';
import { useEmployeeScreenLayer } from '@/components/EmployeeScreenObservation';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {CalendarDays,Check,Clock3} from 'lucide-react';
import {EmployeeNavigation} from '@/components/EmployeeNavigation';
import {useEmployeePreview} from '@/components/EmployeePreviewProvider';
import {useEmployeePayrollSnapshots} from '@/components/EmployeePayrollSnapshots';
import {openPayrollAfterDayReview} from '@/lib/employee-payroll-access';
import {startVisibleSync} from '@/lib/visible-sync';
type RequestRow={id:string;dates:string[];status:string;decisionComment:string;approvedAmount:number|null;accessOnly:boolean};
type Data={reviewRequired:boolean;periodKey:string;employeeName:string;dayRate:number;accessOnly:boolean;today:string;earliest:string;knownDates:string[];requests:RequestRow[]};
const money=(v:number)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(v)+' ₽';
export function PayrollDayReviewEmployee({month}:{month:string}){
 const preview=useEmployeePreview(),request=preview?.request??fetch;
 const router=useRouter();
 const salaryHref=preview?preview.href('/employee/payroll'):'/employee?tab=payroll';
 const pendingSeen=useRef<string>();const prefilled=useRef<string>();
 const [opening,setOpening]=useState(false);
 const [data,setData]=useState<Data|null>(null),[selected,setSelected]=useState<string[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const store=useEmployeePayrollSnapshots();const clear=store?.clear;const last=useRef('');const controller=useRef<AbortController|null>(null);
 const load=useCallback(async()=>{
  controller.current?.abort();const c=new AbortController();controller.current=c;
  try{const r=await request('/api/employee/payroll/day-reviews?month='+month,{cache:'no-store',signal:c.signal});const d=await r.json();if(!r.ok)throw Error(d.error||'Не удалось открыть запросы.');
   if(!c.signal.aborted){const signature=d.requests.filter((v:RequestRow)=>v.status==='approved').map((v:RequestRow)=>v.id).join(',');if(signature!==last.current){clear?.();last.current=signature;}const latest=d.requests[0] as RequestRow|undefined;
    if(latest?.status==='pending')pendingSeen.current=latest.id;
    if(latest?.status==='rejected'&&prefilled.current!==latest.id){
     prefilled.current=latest.id;
     setSelected(latest.dates.filter(date=>date<d.today&&date>=d.earliest&&!d.knownDates.includes(date)));
    }
    setOpening(openPayrollAfterDayReview({latestId:latest?.id,latestStatus:latest?.status,pendingId:pendingSeen.current,reviewRequired:d.reviewRequired}));
    setData(d);setError('');}
  }catch(e){if(!c.signal.aborted){workflowEvent('salary_review','error_shown',undefined,month,undefined,{operation:'salary_load'});setError(e instanceof Error?e.message:'Не удалось обновить запрос.');}}
 },[month,clear,request]);
 useEffect(()=>{if(opening){clear?.();router.replace(salaryHref);}},[opening,clear,router,salaryHref]);
 useEffect(()=>{const stop=startVisibleSync(load,30000);return()=>{stop();controller.current?.abort();};},[load]);
 async function send(){if(preview){preview.blocked();return;}if(busy||!selected.length)return;setBusy(true);setError('');try{const r=await employeeObservedFetch('/api/employee/payroll/day-reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({month,dates:selected})});const d=await workflowJson(r,'salary_review',undefined,'salary_send');if(!r.ok)throw Error(d.error);setSelected([]);await load();}catch(e){setError(e instanceof Error?e.message:'Не удалось отправить запрос.');}finally{setBusy(false);}}
 async function cancel(id:string){if(preview){preview.blocked();return;}if(busy)return;setBusy(true);try{const r=await employeeObservedFetch('/api/employee/payroll/day-reviews/'+encodeURIComponent(id),{method:'DELETE'});const d=await workflowJson(r,'salary_review',id,'salary_cancel');if(!r.ok)throw Error(d.error);await load();}catch(e){setError(e instanceof Error?e.message:'Не удалось отменить запрос.');}finally{setBusy(false);}}
 useEmployeeScreenLayer({dialog:'form'},50);
 useEffect(()=>{workflowEvent('salary_review','opened',undefined,month,undefined,{operation:'salary_send'});},[]);
 const pending=data?.requests.find(r=>r.status==='pending'),latest=data?.requests[0];
 const accessOnly=!!(data?.accessOnly||pending?.accessOnly);
 const count=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
 const offset=(new Date(month+'-01T12:00:00Z').getUTCDay()+6)%7;
 const title=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));
 return <div className='salary-content personal-payroll-content'>
  <div className='salary-heading'><h1>Моя зарплата</h1><span>{title}</span></div>
  <section className='rounded-[22px] border border-[#e5e2da] bg-white p-5'>
   <div className='mb-4 flex items-center gap-2 text-[#a5683d]'>{pending?<Clock3 size={25}/>:<CalendarDays size={25}/>}<h2 className='text-xl font-bold text-[#24282d]'>{opening?'Открываем расчёт…':pending?'Ожидает подтверждения':latest?.status==='rejected'?'Уточните дни выхода':'Подтвердите выходы'}</h2></div>
   {error&&<div role='alert' className='mb-4 text-sm text-amber-900'>{error}<button type='button' onClick={()=>void load()} className='ml-2 underline'>Обновить</button></div>}
   {opening?<p className='text-base text-stone-600' role='status'>Загружаем зарплату…</p>:!data?<p className='text-base text-stone-500'>Загружаем дни…</p>:pending?<>
    <p className='text-base text-stone-600'>{pending.dates.map(d=>Number(d.slice(8))).join(', ')} · {title}</p>
    <div className='my-4 flex justify-between border-y border-stone-200 py-4'><span>На подтверждении · {pending.dates.length} дн.</span>{!accessOnly&&<strong>{money(pending.dates.length*data.dayRate)}</strong>}</div>
    <p className='text-base leading-relaxed text-stone-600'>{accessOnly?'Месяц закрыт. Подтверждение не изменит зарплату.':'До решения администратора начисление за эти дни не меняется.'}</p><button disabled={busy} onClick={()=>void cancel(pending.id)} className='mt-5 min-h-11 font-semibold text-[#945c36]'>Отменить запрос</button>
   </>:<>
    {latest?.status==='rejected'&&<div className='mb-4 rounded-xl border border-[#e3d2bb] bg-[#fbf5ec] p-3 text-sm'><p>{latest.decisionComment}</p></div>}
    <p className='mb-4 text-base leading-relaxed text-[#60636a]'>Выберите отработанные дни без QR-отметок и отправьте на подтверждение. Уже подтверждённые дни недоступны для выбора.</p>
    <div className='mb-2 grid grid-cols-7 text-center text-xs font-semibold text-stone-500'>{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=><span key={d}>{d}</span>)}</div>
    <div className='grid grid-cols-7 gap-1' aria-label='Выбор выходов'>
     {Array.from({length:offset},(_,i)=><span key={'blank'+i}/>)}
     {Array.from({length:count},(_,i)=>i+1).map(day=>{const date=month+'-'+String(day).padStart(2,'0'),known=data.knownDates.includes(date),disabled=busy||date>=data.today||date<data.earliest||known;return <button key={date} type='button' aria-label={`${day} ${title}`} aria-pressed={selected.includes(date)} disabled={disabled} title={known?'Выход уже подтверждён':undefined} onClick={()=>{workflowEvent('salary_review','confirmed_choice',undefined,month,undefined,{operation:'salary_send'});setSelected(old=>old.includes(date)?old.filter(d=>d!==date):[...old,date].sort());}} className={'relative flex min-h-10 items-center justify-center rounded-lg text-sm font-semibold disabled:opacity-30 '+(selected.includes(date)?'bg-[#a5683d] text-white':'bg-[#f0f1ee] text-[#343a3c]')}>{day}{(known||selected.includes(date))&&<Check size={10} className='absolute right-0.5 top-0.5'/>}</button>;})}
    </div>
    <p className='my-4 flex justify-between text-base font-semibold'><span>Выбрано: {selected.length} дн.</span>{!accessOnly&&<span>{money(selected.length*data.dayRate)}</span>}</p>
    <button disabled={busy||!selected.length} onClick={()=>void send()} className='min-h-[50px] w-full rounded-[14px] bg-[#272b30] px-3 text-base font-semibold text-white disabled:opacity-40'>{busy?'Отправляем…':'Отправить на подтверждение'}</button>
    <p className='mt-3 text-sm leading-relaxed text-stone-500'>{accessOnly?'Месяц закрыт. Подтверждение не изменит зарплату.':'В расчёте появятся после подтверждения администратора.'}</p>
   </>}
  </section>
  <EmployeeNavigation active='payroll' payrollEnabled activeHref={salaryHref}/>
 </div>;
}
