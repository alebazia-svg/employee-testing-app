import {prisma} from './prisma';
import {expenseRequestMoscowCalendarDate} from './expense-request-source';
import {freshEvidence} from './procurement-plan-revision-server';
import {readPaymentRevision} from './procurement-plan-revision';
import {isFinishedPaymentState} from './procurement-small-remainder';
import {notifyAdminsAboutProcurementPlans,notifyProcurementManagerAboutDecision} from './procurement-payment-notifications';
import {paymentDeferral,scheduleCommand} from './procurement-schedule';
type Actor={id:number;name:string;role:string;portalArea:string;isActive:boolean};
const json=(v:unknown)=>JSON.parse(JSON.stringify(v));
export async function changePaymentSchedule(id:string,actor:Actor,payload:unknown){
 if(!actor.isActive||!(actor.role==='ADMIN'||actor.role==='EMPLOYEE'&&actor.portalArea==='PROCUREMENT'))throw Error('Нет доступа.');
 const command=scheduleCommand(payload,expenseRequestMoscowCalendarDate(new Date()));
 if(actor.role!=='ADMIN'&&command.action!=='RESCHEDULE')throw Error('Только администратор может отложить оплату.');
 const candidate=await prisma.supplierPaymentPlan.findFirst({where:{id,...(actor.role==='ADMIN'?{}:{managerUserId:actor.id})}});
 if(!candidate)throw Error('Заявка не найдена.');
 if(candidate.status!=='APPROVED'||candidate.updatedAt.toISOString()!==command.version)throw Error('Заявка изменилась или уже завершена. Обновите её.');
 if(readPaymentRevision(candidate.oneCCashEvidence))throw Error('Сначала нужно рассмотреть уже отправленные изменения.');
 const evidence=await freshEvidence();
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106241)`;
  const before=await tx.supplierPaymentPlan.findUniqueOrThrow({where:{id}});
  if(before.status!=='APPROVED'||before.updatedAt.toISOString()!==command.version||evidence.versions.get(id)!==command.version||readPaymentRevision(before.oneCCashEvidence))throw Error('Заявка изменилась во время проверки. Обновите её.');
  const paid=evidence.get(id);
  if(!paid||isFinishedPaymentState(paid.state)||['MISMATCH','NEEDS_REVIEW','SOURCE_UNAVAILABLE'].includes(paid.state)||paid.paymentAmountNeedsConfirmation)throw Error('Сначала проверьте оплату заявки. Изменения не сохранены.');
  if(paid.collection)throw Error('Выдача уже назначена в 1С. Сначала измените или отмените её там.');
  const previous=before.oneCCashEvidence&&typeof before.oneCCashEvidence==='object'&&!Array.isArray(before.oneCCashEvidence)?before.oneCCashEvidence:{};
  const deferral=paymentDeferral(previous),oldDate=before.plannedDate.toISOString().slice(0,10);
  if(command.action==='RESCHEDULE'&&oldDate===command.date)throw Error('Дата не изменилась.');
  if(command.action==='RESUME'&&!deferral)throw Error('Оплата не отложена.');
  if(command.action==='DEFER'&&deferral?.date===(command.date||null)&&deferral?.comment===command.comment)throw Error('Условия отсрочки не изменились.');
  const after=await tx.supplierPaymentPlan.update({where:{id},data:command.action==='RESCHEDULE'?{plannedDate:new Date(command.date+'T00:00:00Z')}:{...(command.action==='RESUME'?{plannedDate:new Date(command.date+'T00:00:00Z')} : {}),oneCCashEvidence:json({...previous,fundingDeferral:command.action==='RESUME'?null:{date:command.date||null,comment:command.comment,actorId:actor.id,changedAt:new Date().toISOString()}})}});
  const changes=command.action==='RESCHEDULE'?[{key:'plannedDate',label:'Дата подготовки денег',before:oldDate,after:command.date}]:[{key:'fundingDeferral',label:'Подготовка денег',before:deferral?deferral.date||'Дата уточняется':'По сроку заявки',after:command.action==='RESUME'?'По сроку заявки':command.date||'Дата уточняется'}];
  if(command.action==='RESUME'&&oldDate!==command.date)changes.push({key:'plannedDate',label:'Дата подготовки денег',before:oldDate,after:command.date});
  const event=await tx.supplierPaymentPlanEvent.create({data:{planId:id,actorUserId:actor.id,action:'UPDATED',snapshot:json({before,after,revision:{reason:command.comment||({RESCHEDULE:'Перенос даты',DEFER:'Оплата отложена',RESUME:'Отсрочка отменена'}[command.action]),changes}})}});
  if(command.action==='RESCHEDULE'&&actor.role!=='ADMIN'){
   // Retire queued approval notices with the old date; do not notify the buyer of their own edit.
   await tx.workdayNotification.updateMany({where:{userId:after.managerUserId,kind:'procurement_payment_approved',fingerprint:{startsWith:`procurement-payment:${id}:approved:`},status:{in:['pending','sent']}},data:{status:'cancelled',readAt:new Date(),nextPushAttemptAt:null}});
   await notifyAdminsAboutProcurementPlans({db:tx,eventKey:`procurement-date:${event.id}`,action:'UPDATED',dateChange:{before:before.plannedDate,after:after.plannedDate},managerName:actor.name,plans:[after]});
  }
  else await notifyProcurementManagerAboutDecision({db:tx,plan:after,decision:'APPROVED',rescheduled:command.action==='RESCHEDULE',scheduleChange:command.action==='RESCHEDULE'?undefined:{deferred:command.action==='DEFER',date:command.date||null,comment:command.comment},eventKey:event.id});
  return {...json(after),revision:null,dateChanged:command.action==='RESCHEDULE'};
 });
}
