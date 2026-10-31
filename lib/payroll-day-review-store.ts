import 'server-only';
import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';
import { getPrivatePayrollBinding } from './payroll-current-read';
import { buildPayrollEmployeeDirectory, getDayRate, getDefaultPayrollDepartment, getPayrollManualInput } from './payroll-calculation-engine';
import { validatePayrollDraft } from './payroll-draft';
import { readPayrollAttendanceSnapshotPayload, type PayrollAttendanceSnapshotPayload } from './payroll-attendance-snapshot';
import { applyApprovedPayrollDays, DIANA_REVIEW_NAME, PAYROLL_ACCESS_FROM, payrollDayReviewEnabled, payrollDayAccountingEnabled, prepareDayReviewSource, reviewDates } from './payroll-day-review';
import { readPayrollAccessInTransaction } from './employee-payroll-access-store';
import { getMoscowDateKey } from './workday';
export class DayReviewError extends Error { constructor(public status:number,message:string){super(message);} }
function fail(message:string,status=409):never {throw new DayReviewError(status,message);}
type Tx=Prisma.TransactionClient;
const directorySelect={id:true,name:true,role:true,department:true,isActive:true,portalArea:true,payrollName:true,payrollSalaryType:true,payrollReportGroup:true,payrollFixedSalary:true,payrollRuleFrom:true,payrollRuleThrough:true} as const;
export function requireDayReview() {if(!payrollDayReviewEnabled())fail('Раздел недоступен.',404);}
/** Old zero-row Diana source has an unambiguous empty date set. Never infer dates from a nonzero count. */
export function ensureDianaZeroProvenance(payload:PayrollAttendanceSnapshotPayload,userId:number,name:string) {
 if(payload.dayReviewSources?.some(row=>row.userId===userId))return payload;
 const rows=payload.scheduleSummaries.filter(row=>row.employee===name||name===DIANA_REVIEW_NAME&&row.employee==='Диана');
 if(name!==DIANA_REVIEW_NAME||rows.length!==1||rows[0].scheduleDays!==0)return payload;
 return {...payload,dayReviewSources:[...(payload.dayReviewSources??[]),{userId,employee:name,sourceEmployee:rows[0].employee,kind:'schedule' as const,dates:[]}]};
}
export async function overlayApprovedDays(db:Pick<Tx,'payrollDayReview'>,payload:PayrollAttendanceSnapshotPayload,employeeId?:number):Promise<PayrollAttendanceSnapshotPayload & {approvedDayReviewIds?:string[]}> {
 if(!payrollDayAccountingEnabled())return payload;
 const rows=await db.payrollDayReview.findMany({where:{periodKey:payload.period.periodKey,status:'approved',accessOnly:false,...(employeeId!==undefined?{employeeId}:{})},orderBy:[{submittedAt:'asc'},{id:'asc'}]});
 let raw=payload;for(const row of rows)raw=ensureDianaZeroProvenance(raw,row.employeeId,row.payrollName);
 return {...applyApprovedPayrollDays(raw,rows),approvedDayReviewIds:rows.map(row=>row.id).sort()};
}
async function reviewPeriod(tx:Tx,periodKey:string,lock=false) {
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(periodKey))fail('Некорректный месяц.',400);
 const period=await tx.payrollPeriod.findUnique({where:{periodKey}});
 if(!period)fail('Сначала откройте расчёт за выбранный месяц.');
 if(lock)await tx.$queryRaw`SELECT id FROM "PayrollPeriod" WHERE id = ${period.id} FOR UPDATE`;
 const state=await tx.payrollPeriod.findUniqueOrThrow({where:{id:period.id}});
 const final=await tx.payrollRun.count({where:{periodId:period.id,status:'FINAL'}});
 return {...state,accessOnly:state.status==='CLOSED'||final>0};
}
function rejectionFingerprint(row:{id:string;employeeId:number;payrollName:string;periodKey:string;dates:unknown;dayRateCents:number;status:string}) {
 return createHash('sha256').update(JSON.stringify([row.id,row.employeeId,row.payrollName,row.periodKey,row.dates,row.dayRateCents,row.status])).digest('hex');
}
async function context(tx:Tx,employeeId:number,periodKey:string,lock=false,forceAccessOnly=false) {
 const period=await reviewPeriod(tx,periodKey,lock);
 const accessOnly=forceAccessOnly||period.accessOnly;
 const users=await tx.user.findMany({select:directorySelect});
 const name=getPrivatePayrollBinding(users,employeeId);const user=users.find(u=>u.id===employeeId);
 if(!name||user?.portalArea!=='WORKDAY')fail('Не удалось подтвердить сотрудника.',403);
 const directory=buildPayrollEmployeeDirectory(users,periodKey,new Set([name]),true),person=directory[name];
 if(!person||!['retail_sales_bonus','wholesale_percent'].includes(person.salaryType))fail('Для этого сотрудника выходы учитываются по другому правилу.',403);
 const earliest=name===DIANA_REVIEW_NAME?'2026-10-01':PAYROLL_ACCESS_FROM;
 const [approved,appDays]=await Promise.all([
  tx.payrollDayReview.findMany({where:{employeeId,periodKey,status:'approved'},orderBy:[{submittedAt:'asc'},{id:'asc'}]}),
  tx.workDayEntry.findMany({where:{userId:employeeId,date:{gte:periodKey+'-01',lte:periodKey+'-31'}},select:{date:true,startedAt:true,endedAt:true,status:true}}),
 ]);
 const approvedDates=approved.flatMap(row=>reviewDates(row.dates,periodKey,'9999-12-31',earliest));
 const completedDates=appDays.filter(row=>row.endedAt&&row.status==='completed'&&Number.isFinite(row.startedAt.getTime())&&getMoscowDateKey(row.startedAt)===row.date).map(row=>row.date).sort();
 const unavailableDates=new Set([...approvedDates,...completedDates]);
 const rate=getDayRate(getDefaultPayrollDepartment(person));
 const common={user:user!,name,rate,earliest,accessOnly,unavailableDates};
 if(accessOnly){
  const token=createHash('sha256').update(JSON.stringify([employeeId,name,periodKey,'access-only',approved.map(r=>[r.id,r.dates]),completedDates])).digest('hex');
  return {...common,known:new Set<string>(),source:null,token};
 }
 const [snapshot,draft]=await Promise.all([
  tx.payrollAttendanceSnapshot.findUnique({where:{periodKey}}),
  tx.payrollDraftRevision.findFirst({where:{periodKey},orderBy:{revision:'desc'}}),
 ]);
 if(!snapshot||!draft)fail('Обновите данные расчёта за выбранный месяц.');
 const raw=readPayrollAttendanceSnapshotPayload(snapshot.payload,periodKey);if(!raw||raw.attendanceMode==='demo')fail('Источник выходов недоступен.');
 const prepared=prepareDayReviewSource(ensureDianaZeroProvenance(raw,employeeId,name),employeeId,name);
 const source=prepared.dayReviewSources?.find(row=>row.userId===employeeId&&row.employee===name);if(!source)fail('Обновите источники рабочих дней перед отправкой запроса.');
 const manual=getPayrollManualInput(name,validatePayrollDraft(draft.payload).manual);
 if(manual?.source==='manualCorrection')fail('Количество дней уже задано администратором. Сначала проверьте ручную корректировку.');
 const financial=approved.filter(row=>!row.accessOnly);
 applyApprovedPayrollDays(prepared,financial);
 const known=new Set([...source.dates,...financial.flatMap(row=>reviewDates(row.dates,periodKey,'9999-12-31',earliest))]);
 const token=createHash('sha256').update(JSON.stringify([employeeId,name,periodKey,snapshot.updatedAt,draft.revision,source,approved.map(row=>[row.id,row.dates,row.decidedAt,row.accessOnly]),rate,completedDates])).digest('hex');
 return {...common,source,known,token};
}
export async function readDayReview(employeeId:number,periodKey:string,db:PrismaClient=prisma,now=new Date()) {
 requireDayReview();
 return db.$transaction(async tx=>{
  const c=await context(tx,employeeId,periodKey);
  const requests=await tx.payrollDayReview.findMany({where:{employeeId,periodKey},orderBy:[{submittedAt:'desc'},{id:'desc'}],take:20});
  const action=await readPayrollAccessInTransaction(tx,employeeId,now);
  const reviewRequired=action?.kind==='days_review'&&new URL(action.href,'https://preview.invalid').searchParams.get('month')===periodKey;
  return {periodKey,reviewRequired,employeeName:c.name,dayRate:c.rate,today:getMoscowDateKey(now),earliest:c.earliest,accessOnly:c.accessOnly,knownDates:[...c.unavailableDates].sort(),requests:requests.map(r=>({id:r.id,periodKey:r.periodKey,dates:r.dates,status:r.status,accessOnly:r.accessOnly,submittedAt:r.submittedAt,decidedAt:r.decidedAt,decisionComment:r.decisionComment,approvedAdditionalDays:r.approvedAdditionalDays,approvedAmount:r.approvedAmountCents===null?null:r.approvedAmountCents/100}))};
 },{isolationLevel:'RepeatableRead'});
}
export async function submitDayReview(employeeId:number,periodKey:string,value:unknown,db:PrismaClient=prisma,now=new Date()) {
 requireDayReview();
 return db.$transaction(async tx=>{
  const c=await context(tx,employeeId,periodKey,true);
  const dates=reviewDates(value,periodKey,getMoscowDateKey(now),c.earliest);
  const pending=await tx.payrollDayReview.findFirst({where:{employeeId,periodKey,status:'pending'}});
  if(pending){if(JSON.stringify(pending.dates)===JSON.stringify(dates))return pending;fail('У вас уже есть запрос на подтверждении.');}
  if(dates.some(d=>c.unavailableDates.has(d)))fail('В запросе есть уже учтённые дни. Обновите список.');
  const request=await tx.payrollDayReview.create({data:{employeeId,payrollName:c.name,periodKey,dates,dayRateCents:c.rate*100,accessOnly:c.accessOnly}});
  const event=await tx.adminInboxEvent.create({data:{eventKey:`payroll-days:${request.id}`,type:'payroll.days_requested',sourceType:'payroll_day_review',sourceId:request.id,title:`${c.user.name}: подтвердите выходы`,body:c.accessOnly?periodKey+' · '+dates.length+' дн. · без перерасчёта зарплаты':periodKey+' · '+dates.length+' дн. · '+(dates.length*c.rate).toLocaleString('ru-RU')+' ₽',href:`/admin/payroll/day-reviews/${request.id}`,occurredAt:request.submittedAt}});
  const admins=await tx.user.findMany({where:{role:'ADMIN',isActive:true},select:{id:true}});
  await tx.adminInboxReceipt.createMany({data:admins.map(a=>({eventId:event.id,userId:a.id})),skipDuplicates:true});
  return request;
 },{isolationLevel:'Serializable',timeout:15000});
}
export async function readAdminDayReview(id:string,db:PrismaClient=prisma,now=new Date()) {
 requireDayReview();
 return db.$transaction(async tx=>{
  const r=await tx.payrollDayReview.findUnique({where:{id},include:{employee:{select:{name:true}}}});if(!r)fail('Запрос не найден.',404);
  if(r.status!=='pending')return {request:r,accessOnly:r.accessOnly,fingerprint:null,additionalDays:r.approvedAdditionalDays,amount:r.approvedAmountCents===null?null:r.approvedAmountCents/100};
  const rejectToken=rejectionFingerprint(r);
  try {
   const c=await context(tx,r.employeeId,r.periodKey,false,r.accessOnly);
   if(c.name!==r.payrollName||(!c.accessOnly&&c.rate*100!==r.dayRateCents))fail('Привязка сотрудника или ставка изменились. Верните запрос на уточнение.');
   const dates=reviewDates(r.dates,r.periodKey,getMoscowDateKey(now),c.earliest);
   const additionalDays=c.accessOnly?0:dates.filter(date=>!c.known.has(date)).length;
   return {request:r,accessOnly:c.accessOnly,fingerprint:c.token,rejectionFingerprint:rejectToken,additionalDays,amount:additionalDays*c.rate};
  } catch(error) {
   return {request:r,accessOnly:r.accessOnly,fingerprint:null,rejectionFingerprint:rejectToken,additionalDays:null,amount:null,approvalBlocked:error instanceof DayReviewError?error.message:'Обновите источники расчёта перед подтверждением.'};
  }
 },{isolationLevel:'RepeatableRead'});
}
export async function decideDayReview(id:string,adminId:number,action:'approved'|'rejected',comment:string,fingerprint:string,db:PrismaClient=prisma,now=new Date()) {
 requireDayReview();if(!['approved','rejected'].includes(action)||typeof comment!=='string'||comment.length>500||!comment.trim()&&action==='rejected')fail('Укажите, что нужно уточнить.',400);
 return db.$transaction(async tx=>{
  const admin=await tx.user.findUnique({where:{id:adminId}});if(!admin?.isActive||admin.role!=='ADMIN')fail('Недостаточно прав.',403);
  const first=await tx.payrollDayReview.findUnique({where:{id}});if(!first)fail('Запрос не найден.',404);
  const period=await reviewPeriod(tx,first.periodKey,true);
  const r=await tx.payrollDayReview.findUniqueOrThrow({where:{id}});
  if(r.status===action)return r;
  if(r.status!=='pending')fail('По запросу уже принято решение.');
  let dates:string[]=[],additional=0,accessOnly=r.accessOnly||period.accessOnly;
  if(action==='rejected'){
   if(fingerprint!==rejectionFingerprint(r))fail('Запрос изменился. Откройте его заново.');
  }else{
   const c=await context(tx,r.employeeId,r.periodKey,false,r.accessOnly);
   if(c.name!==r.payrollName||(!c.accessOnly&&c.rate*100!==r.dayRateCents)||fingerprint!==c.token)fail('Данные расчёта изменились. Откройте запрос заново.');
   dates=reviewDates(r.dates,r.periodKey,getMoscowDateKey(now),c.earliest);
   const app=await tx.workDayEntry.findMany({where:{userId:r.employeeId,date:{in:dates}},select:{date:true}});
   accessOnly=c.accessOnly;
   if(!accessOnly&&app.some(d=>!c.source?.dates.includes(d.date)))fail('Появились новые QR-отметки. Сначала обновите источники дней.');
   additional=accessOnly?0:dates.filter(d=>!c.known.has(d)).length;
  }
  const updated=await tx.payrollDayReview.update({where:{id},data:{status:action,accessOnly,decidedById:adminId,decidedAt:new Date(),decisionComment:comment.trim(),...(action==='approved'?{approvedAdditionalDays:additional,approvedAmountCents:additional*r.dayRateCents}:{})}});
  await tx.workdayNotification.create({data:{userId:r.employeeId,fingerprint:`payroll-days:${id}:${action}`,kind:'payroll_days_decision',title:action==='approved'?'Выходы подтверждены':'Уточните дни выхода',body:action==='approved'?(accessOnly?'Зарплата закрытого месяца не изменена.':r.periodKey+' · подтверждено '+dates.length+' дн.'):comment.trim(),scheduledAt:new Date(),status:'pending'}});
  return updated;
 },{isolationLevel:'Serializable',timeout:15000});
}
export async function cancelDayReview(id:string,employeeId:number,db:PrismaClient=prisma) {
 requireDayReview();return db.$transaction(async tx=>{
  const first=await tx.payrollDayReview.findFirst({where:{id,employeeId}});if(!first)fail('Запрос не найден.',404);
  await reviewPeriod(tx,first.periodKey,true);
  const row=await tx.payrollDayReview.findUniqueOrThrow({where:{id}});if(row.status==='cancelled')return row;
  if(row.status!=='pending')fail('Решение уже принято.');
  return tx.payrollDayReview.update({where:{id},data:{status:'cancelled',decidedAt:new Date()}});
 },{isolationLevel:'Serializable'});
}
