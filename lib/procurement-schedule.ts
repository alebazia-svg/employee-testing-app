/** Scheduling is not approval or payment evidence. */
export type PaymentDeferral={date:string|null;comment:string;changedAt:string;actorId:number};
export type ScheduleCommand={action:'RESCHEDULE'|'DEFER'|'RESUME';version:string;date:string;comment:string};
export function scheduleDate(value:unknown,today:string,optional=false){
 if(optional&&(value==null||value===''))return '';
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value||value<today)throw Error('Выберите сегодняшнюю или будущую дату.');
 return value;
}
export function scheduleCommand(payload:unknown,today:string):ScheduleCommand{
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Проверьте данные изменения.');
 const b=payload as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['action','version','date','comment'].includes(k))||!['RESCHEDULE','DEFER','RESUME'].includes(String(b.action)))throw Error('Проверьте действие с датой оплаты.');
 if(typeof b.version!=='string'||!Number.isFinite(Date.parse(b.version)))throw Error('Обновите заявку перед изменением.');
 if(b.comment!=null&&(typeof b.comment!=='string'||b.comment.length>500))throw Error('Комментарий должен быть не длиннее 500 символов.');
 if(b.action==='RESUME'&&b.comment)throw Error('При отмене отсрочки укажите только дату оплаты.');
 return {action:b.action as ScheduleCommand['action'],version:b.version,date:scheduleDate(b.date,today,b.action==='DEFER'),comment:typeof b.comment==='string'?b.comment.trim():''};
}
export function paymentDeferral(raw:unknown):PaymentDeferral|null{
 const d=(raw as {fundingDeferral?:PaymentDeferral}|null)?.fundingDeferral;
 if(!d||typeof d!=='object'||typeof d.comment!=='string'||!Number.isFinite(Date.parse(d.changedAt))||!Number.isInteger(d.actorId))return null;
 if(d.date!==null&&(typeof d.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!Number.isFinite(Date.parse(d.date))||new Date(d.date).toISOString().slice(0,10)!==d.date))return null;
 return d;
}
/** UI routing only; the endpoint independently rejects financial fields. */
export function onlyPaymentDateChanged(before:Record<string,unknown>|null,after:Record<string,unknown>){
 if(!before||before.plannedDate===after.plannedDate)return false;
 return [...new Set([...Object.keys(before),...Object.keys(after)])].every(k=>k==='plannedDate'||JSON.stringify(before[k])===JSON.stringify(after[k]));
}

type ScheduledPlan = {status:string;plannedDate:string;oneCCashEvidence?:unknown;evidence?:{state?:string}};
/** Scheduling changes presentation only. Never use this to release a reserve or match an expense. */
export function activePaymentDeferral(plan:ScheduledPlan) {
 if(!['APPROVED','SUBMITTED'].includes(plan.status)||['ISSUED_BY_ONE_C','PAID_BY_ONE_C','SMALL_REMAINDER_COMPLETED'].includes(plan.evidence?.state||''))return null;
 return paymentDeferral(plan.oneCCashEvidence);
}
export function paymentPreparationDate(plan:ScheduledPlan):string|null {
 const deferred=activePaymentDeferral(plan);
 const requested=plan.plannedDate.slice(0,10);
 // A buyer may move the supplier date, but cannot promise earlier funding.
 // Keep the funding decision intact and schedule no earlier than either date.
 return deferred?deferred.date===null?null:deferred.date>requested?deferred.date:requested:requested;
}
export function paymentScheduleLabel(plan:ScheduledPlan) {
 if(['MISMATCH','NEEDS_REVIEW','SOURCE_UNAVAILABLE'].includes(plan.evidence?.state||''))return '';
 const deferred=activePaymentDeferral(plan);
 return deferred?deferred.date?'Деньги будут готовы':'Оплата отложена':'';
}
export function paymentScheduleDetail(plan:ScheduledPlan) {
 const deferred=activePaymentDeferral(plan);
 if(!deferred)return '';
 return deferred.date?`Деньги будут готовы ${new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(deferred.date+'T12:00:00Z'))}`:'Дата уточняется';
}
