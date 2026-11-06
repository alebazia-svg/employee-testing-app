import 'server-only';
import {createHash} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {prisma} from './prisma';
import {freshEvidence} from './procurement-plan-revision-server';
import {dailyRateCommand,dailyRateRows,type DailyQuote,type DailyRateCommand,type DailyRatePlan} from './procurement-daily-rate';
import {expenseRequestMoscowCalendarDate} from './expense-request-source';
import {approvedEditData} from './procurement-approved-edit';
import {assertRevisionPaymentSafety,revisionChanges} from './procurement-plan-revision';
import {notifyProcurementManagerAboutDecision,notifyProcurementManagerAboutPendingEdit} from './procurement-payment-notifications';

const json=(v:unknown)=>JSON.parse(JSON.stringify(v));
const object=(v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export const dailyRatePlan=(p:any):DailyRatePlan=>({...p,plannedDate:new Date(p.plannedDate).toISOString(),updatedAt:new Date(p.updatedAt).toISOString(),plannedAmount:Number(p.plannedAmount),foreignAmount:p.foreignAmount==null?null:Number(p.foreignAmount),exchangeRate:p.exchangeRate==null?null:Number(p.exchangeRate),oneCIssuedAmount:p.oneCIssuedAmount==null?null:Number(p.oneCIssuedAmount)});
const quote=(p:any):DailyQuote=>({id:p.id,day:p.day.toISOString().slice(0,10),currency:p.currency,rate:Number(p.rate),revision:p.revision,actor:p.actor.name,createdAt:p.createdAt.toISOString()});
export async function readDailyRates(day:string,db:Pick<Prisma.TransactionClient,'procurementDailyRate'>=prisma){
 dailyRateCommand({day,currency:'USDT',rate:1});
 const rows=await db.procurementDailyRate.findMany({where:{day:new Date(day+'T00:00:00Z')},orderBy:{revision:'desc'},include:{actor:{select:{name:true}}}});
 return ['USDT','CNY'].flatMap(currency=>{const p=rows.find(p=>p.currency===currency);return p?[quote(p)]:[];});
}
/** Latest revision per currency at or before the requested day; no request dependency. */
export async function readDailyRateOverview(day:string,db:Pick<Prisma.TransactionClient,'procurementDailyRate'>=prisma){
 dailyRateCommand({day,currency:'USDT',rate:1});
 const rows=await Promise.all((['USDT','CNY'] as const).map(currency=>db.procurementDailyRate.findFirst({where:{currency,day:{lte:new Date(day+'T00:00:00Z')}},orderBy:[{day:'desc'},{revision:'desc'}],include:{actor:{select:{name:true}}}})));
 return rows.flatMap(row=>row?[quote(row)]:[]);
}

function previewFor(plans:DailyRatePlan[],evidence:Awaited<ReturnType<typeof freshEvidence>>,command:DailyRateCommand,previous:DailyQuote|null){
 const result=dailyRateRows(plans,evidence,command);
 for(const row of [...result.rows,...result.excluded])if(evidence.versions.get(row.id)!==row.version)throw Error('Заявки изменились. Повторите просмотр пересчёта.');
 const value={...command,previous,...result};
 return {...value,fingerprint:createHash('sha256').update(JSON.stringify(value)).digest('hex')};
}
export async function previewDailyRate(raw:unknown,db=prisma,readEvidence=freshEvidence){
 const command=dailyRateCommand(raw);
 if(command.day<expenseRequestMoscowCalendarDate(new Date()))throw Error('Прошедший день нельзя пересчитывать.');
 const evidence=await readEvidence();
 const [plans,rates]=await Promise.all([db.supplierPaymentPlan.findMany(),readDailyRates(command.day,db)]);
 return previewFor(plans.map(dailyRatePlan),evidence,command,rates.find(q=>q.currency===command.currency)??null);
}
/** Recheck exact reviewed set after independent 1C read and again under the shared financial lock. */
export async function confirmDailyRate(raw:unknown,actorId:number,db=prisma,readEvidence=freshEvidence){
 const command=dailyRateCommand(raw),fingerprint=(raw as {fingerprint?:unknown}).fingerprint;
 if(typeof fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(fingerprint))throw Error('Сначала просмотрите пересчёт.');
 if(command.day<expenseRequestMoscowCalendarDate(new Date()))throw Error('Прошедший день нельзя пересчитывать.');
 const evidence=await readEvidence();
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106241)`;
  const actor=await tx.user.findUnique({where:{id:actorId}});
  if(!actor?.isActive||actor.role!=='ADMIN')throw Error('Нет права утверждать курс.');
  const plans=await tx.supplierPaymentPlan.findMany();
  const rates=await readDailyRates(command.day,tx);
  const preview=previewFor(plans.map(dailyRatePlan),evidence,command,rates.find(q=>q.currency===command.currency)??null);
  if(preview.fingerprint!==fingerprint)throw Error('Заявки, оплаты или курс изменились. Просмотрите пересчёт заново.');
  const saved=await tx.procurementDailyRate.create({data:{day:new Date(command.day+'T00:00:00Z'),currency:command.currency,rate:command.rate,revision:(preview.previous?.revision??0)+1,actorUserId:actorId,snapshot:json(preview)},include:{actor:{select:{name:true}}}});
  for(const row of preview.rows){
   const before=plans.find(p=>p.id===row.id)!;
   const {data}=approvedEditData(before,{version:row.version,plannedAmount:row.after,exchangeRate:command.rate},expenseRequestMoscowCalendarDate(new Date()));
   // Confirm the validated legacy calculation exactly equals the reviewed projection.
   if(Number(data.plannedAmount)!==row.after||data.foreignAmount!==row.foreignAmount||data.exchangeRate!==command.rate)throw Error('Индивидуальный расчёт заявки: обновите её отдельно.');
   assertRevisionPaymentSafety(before,data,evidence.get(row.id)!);
   const changed=await tx.supplierPaymentPlan.updateMany({where:{id:row.id,status:before.status,updatedAt:before.updatedAt},data:{plannedAmount:row.after,exchangeRate:command.rate,oneCCashEvidence:json({...object(before.oneCCashEvidence),dailyRate:{quoteId:saved.id,rate:command.rate,rubles:row.after,foreignAmount:row.foreignAmount}})}});
   if(changed.count!==1)throw Error('Заявка изменилась. Повторите пересчёт.');
   const after=await tx.supplierPaymentPlan.findUniqueOrThrow({where:{id:row.id}});
   const event=await tx.supplierPaymentPlanEvent.create({data:{planId:row.id,actorUserId:actorId,action:'DAILY_RATE_CONFIRMED',snapshot:json({before,after,quoteId:saved.id,revision:{reason:'Утверждён общий курс на день',changes:revisionChanges(before,data)}})}});
   if(row.before!==row.after||row.oldRate!==command.rate){
    if(before.status==='SUBMITTED')await notifyProcurementManagerAboutPendingEdit({db:tx,plan:after,eventKey:event.id});
    else await notifyProcurementManagerAboutDecision({db:tx,plan:after,eventKey:event.id,decision:'APPROVED',revisionDecision:true});
   }
  }
  return {quote:quote(saved),updatedPlanIds:preview.rows.map(r=>r.id)};
 },{timeout:20000});
}
