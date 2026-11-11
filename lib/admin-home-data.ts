import { loadTeamCalendarEvidence } from './team-calendar-evidence';
import { calendarCorrectionSourceId } from './team-calendar-fact';
import { resolveControlCalendarDay } from './team-control-calendar';
import 'server-only';
import { prisma } from './prisma';
import { getMoscowDateKey, departmentLabel, formatTime, getMoscowMinutes } from './workday';
import { evaluateWorkdayTiming } from './workday-timing';
import { googleDay, resolveTeamSchedule, teamStartControl, clockMinutes } from './team-control';
import { resolveTeamAttendance } from './team-attendance';
import { getTeamGoogleSnapshot } from './team-control-source';
import { readAdminPlans } from './procurement-admin-plans';
import { paymentListRemainder } from './procurement-list-amount';
import { savedPaymentEvidence } from './procurement-evidence-continuity';
import { isFinishedPaymentState } from './procurement-small-remainder';
import { needsProcurementReceipt } from './procurement-receipt-policy';
import { expenseListItem } from './expense-request-list-item';
import { loadTaxManagementReview } from './tax-management-review-source';
import { managementTotals } from './tax-management-review';
import { loadPortalReports } from './ausn-portal-view';
import { buildTaxWorkspace } from './tax-workspace-data';
import { taxPaymentHistory } from './tax-manager-brief';
import { loadAdminForecastSources } from './procurement-admin-forecast-source';
import { loadHomePayroll } from './admin-home-payroll';
import { readPayrollSettlementSource } from './payroll-settlement-source';
import { paymentCardSummary } from './payroll-payment-summary';
import { currentPayrollSettlement, completeSettlementTotal } from './payroll-current-export';
import { loadAdminInbox } from './admin-inbox-data';
import { loadOpenHandoverReviews } from './workday-handover-review-server';
import { HANDOVER_REVIEW_FROM_DATE, handoverReviewHref } from './workday-handover-review';
import { getTerminalFiscalWorkdaySummary, presentTerminalFiscalWorkdaySummary } from './terminal-fiscal-summary';
import type { HomeSection, HomeData, HomeAction, HomeWorkday, HomePayments, HomeTaxes, HomeAnalytics } from './admin-home';

const detailHref=(date:string,id:number)=>`/admin/workday?date=${date}&control=all&employee=${id}#employees-control`;
const rub=(value:number)=>value.toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽';
async function workday(now:Date):Promise<HomeWorkday>{
 const date=getMoscowDateKey(now);
 const startOfDay=new Date(`${date}T00:00:00+03:00`);
 const [users,schedules,vacations,days,runs,issues,requests,reviews,google,cashErrors,handovers,terminal]=await Promise.all([
  prisma.user.findMany({where:{role:'EMPLOYEE',isActive:true,department:{in:['retail','wholesale','procurement']}},include:{accessSessions:{where:{loggedOutAt:null,expiresAt:{gt:now},listArchivedAt:null},orderBy:{lastSeenAt:'desc'},take:1}}}),
  prisma.workScheduleEntry.findMany({where:{date}}),prisma.employeeVacation.findMany({where:{status:'active',dateFrom:{lte:date},dateTo:{gte:date}}}),
  prisma.workDayEntry.findMany({where:{date}}),prisma.shiftControlRun.findMany({where:{date},include:{tasks:{orderBy:{sortOrder:'asc'}}}}),
  prisma.workdayControlIssue.findMany({where:{status:'open',employeeActionRequired:true,user:{isActive:true}},include:{user:true,messages:{orderBy:{createdAt:'desc'},take:1,include:{author:{select:{role:true}}}}}}),
  prisma.workdayCloseExceptionRequest.findMany({where:{status:'pending',consumedAt:null,workDayEntry:{endedAt:null,status:{in:['active','missing_checkout']}}},include:{employee:true,workDayEntry:true}}),
  prisma.terminalFiscalEmployeeReview.findMany({where:{status:{in:['open','admin_review']},employee:{isActive:true}},include:{employee:true,messages:{orderBy:{createdAt:'desc'},take:1,include:{author:{select:{role:true}}}}}}),
  getTeamGoogleSnapshot(),
  prisma.cashOperation.findMany({where:{date:{gte:HANDOVER_REVIEW_FROM_DATE},status:{in:['one_c_error','manual_in_progress','retrying_1c']},user:{isActive:true}},include:{user:{select:{id:true,name:true}}},orderBy:{updatedAt:'asc'}}),
  loadOpenHandoverReviews(prisma),
  getTerminalFiscalWorkdaySummary({periodFrom:startOfDay,periodTo:new Date(startOfDay.getTime()+86_400_000)}),
 ]);
 const calendarEvidence=await loadTeamCalendarEvidence(prisma,{userIds:users.map(u=>u.id),dates:[date],now,workdays:days});
 const result:HomeWorkday={date,working:0,off:0,completed:0,notStarted:0,actions:[],timing:[],departments:[],missingPlans:[],devices:[]};
 const groups=new Map<string,number>();
 for(const user of users){
  const day=days.find(row=>row.userId===user.id),run=runs.find(row=>row.userId===user.id);
  const g=googleDay(user.name,date,google.plans,google.marks);
  const plan=resolveTeamSchedule({name:user.name,appStatus:schedules.find(row=>row.userId===user.id)?.status,googlePlan:g.plan,googleAvailable:google.planAvailable,vacation:vacations.some(row=>row.userId===user.id)});
  const evidence=calendarEvidence.get(calendarCorrectionSourceId(user.id,date));
  const calendarDay=resolveControlCalendarDay({date,department:user.department,plan:plan.state,source:plan.source,vacation:vacations.some(row=>row.userId===user.id),qrAccepted:evidence?.qrAccepted??false,correction:evidence?.history[0],now,hasWorkDay:Boolean(day)});
  const attendance=resolveTeamAttendance({date,today:date,workDay:day,google:g,googleAvailable:google.marksAvailable,fallbackState:plan.label});
  if(calendarDay.calendarState==='off'||calendarDay.calendarState==='vacation')result.off++;
  // An audited working day without a created shift is accounted,
  // but must not invent current presence or a completed shift on the home page.
  else if(!calendarDay.settled){if(attendance.active){result.working++;groups.set(user.department,(groups.get(user.department)||0)+1);}else if(attendance.end!=='—'||day?.status==='completed')result.completed++;else if(plan.status==='off')result.off++;}
  const start=calendarDay.settled?{missing:false}:teamStartControl(plan.state,attendance.start!=='—',attendance.marksAvailable,date,date,getMoscowMinutes(now),clockMinutes(attendance.shift));
  if(start.missing){result.notStarted++;result.actions.push({id:`start-${user.id}`,title:`${user.name}: проверить начало дня`,detail:'По плану нет отметки начала',href:detailHref(date,user.id),tone:'attention'});}
  if(['unknown','unavailable'].includes(plan.state))result.missingPlans.push({id:`plan-${user.id}`,title:`План: ${user.name}`,detail:plan.label,href:`/admin/attendance?date=${date}`});
  const violations=evaluateWorkdayTiming({dateKey:date,department:user.department,scheduleStatus:calendarDay.settled?'off':plan.status,workDay:day,tasks:run?.tasks,now});
  for(const v of violations){
   const action:HomeAction={id:`timing-${user.id}-${v.id}`,title:`${user.name}: ${v.label.toLocaleLowerCase('ru-RU')}`,detail:v.detail,href:detailHref(date,user.id),tone:'attention'};
   if(v.kind==='task_overdue'||v.kind==='missing_checkout')result.actions.push(action);else result.timing.push(action);
  }
  const device=user.accessSessions[0];
  if(device&&['denied','unsubscribed','unsupported','not_subscribed'].includes(device.pushState))result.devices.push({id:`device-${user.id}`,title:`Уведомления: ${user.name}`,detail:`Не подключены · связь ${formatTime(device.lastSeenAt)}`,href:'/admin/employees/access'});
 }
 for(const row of requests)result.actions.push({id:`close-${row.id}`,title:`Решение администратора · ${row.employee.name}`,detail:row.comment||'Запрос на завершение смены',href:`/admin/workday/close-exceptions/${row.id}`,tone:'attention'});
 for(const row of cashErrors)result.actions.push({id:`cash-${row.id}`,title:`Администратору: проверить проведение инкассации`,detail:`${row.user.name} · ${row.date} · ${rub(row.amount)} · ${row.status==='manual_in_progress'?'В ручной обработке':row.status==='retrying_1c'?'Повторное проведение в 1С':'Ошибка проведения в 1С'}`,href:detailHref(row.date,row.user.id),tone:'attention'});
 for(const task of handovers)result.actions.push({id:`handover-${task.id}`,title:'Администратору: проверить сдачу смены',detail:`${task.run.user.name} · ${task.run.date}`,href:handoverReviewHref(task.run.date,task.run.userId),tone:'attention'});
 const fiscal=presentTerminalFiscalWorkdaySummary(terminal);
 if(!['confirmed','not_run'].includes(fiscal.status)){
  result.paymentCheck={id:'fiscal-source',title:`Сверка оплат: ${fiscal.label.toLocaleLowerCase('ru-RU')}`,detail:fiscal.detail,href:`/admin/workday?date=${date}`,tone:fiscal.status==='pending'?'normal':'attention'};
  // Normal asynchronous waiting is information, not an invented administrator task.
  if(fiscal.status!=='pending')result.actions.push(result.paymentCheck);
 }
 for(const row of issues)result.actions.push({id:`issue-${row.id}`,title:`${row.user.name}: ${row.title}`,detail:row.messages[0]?.author.role==='EMPLOYEE'?'Есть ответ сотрудника':row.detail,href:`/admin/workday/issues/${row.id}`,tone:'attention'});
 for(const row of reviews){if(row.reasonCode.startsWith('SOURCE_')&&!row.messages.length)continue;result.actions.push({id:`review-${row.id}`,title:row.status==='admin_review'?'Проверка администратора по оплате':`${row.employee.name}: проверить оплату`,detail:`${rub(row.amountKopecks/100)} · ${getMoscowDateKey(row.bankOperationAt)}`,href:`/admin/workday/payment-checks/${row.id}`,tone:'attention'});}
 result.departments=[...groups].map(([name,count])=>({name:departmentLabel(name),count}));
 return result;
}
async function payments():Promise<HomePayments>{
 const [plans,cases,receipts,sync]=await Promise.all([
  readAdminPlans(),prisma.expenseRequestAdminCase.findMany({where:{currentCycleOrigin:'live',deletionMark:false,OR:[{isNotApproved:true},{currentStatusKey:{in:['approved','payable']}}]},include:{evaluations:{orderBy:{evaluatedAt:'desc'},take:1}}}),
  prisma.supplierPaymentReceipt.groupBy({by:['planId'],_count:{_all:true}}),prisma.expenseRequestSyncRun.findFirst({where:{status:'completed',sourceComplete:true},orderBy:{completedAt:'desc'},select:{completedAt:true}}),
 ]);
 const queue=cases.map(expenseListItem).filter(row=>row.stage!=='closed');
 const receiptCount=new Map(receipts.map(row=>[row.planId,row._count._all]));
 const active=plans.filter(p=>['SUBMITTED','APPROVED'].includes(p.status)&&!isFinishedPaymentState(savedPaymentEvidence(p)?.evidence.state));
 const planHref=(id:string)=>`/admin/procurement?payment=${encodeURIComponent(id)}`;
 return {plans:active.map(p=>({id:p.id,supplier:p.supplierPartner,date:p.plannedDate.toISOString().slice(0,10),amount:Number(p.plannedAmount),foreign:p.foreignAmount===null?null:Number(p.foreignAmount),currency:p.currency,status:p.status,statusLabel:p.status==='SUBMITTED'?'Администратору: согласовать':savedPaymentEvidence(p)?paymentListRemainder({plannedAmount:Number(p.plannedAmount),foreignAmount:p.foreignAmount===null?null:Number(p.foreignAmount),paymentMethod:p.paymentMethod,evidence:savedPaymentEvidence(p)!.evidence})||'Согласовано · последняя сверка':'Статус оплаты уточняется',href:planHref(p.id)})),
  receipts:plans.filter(p=>needsProcurementReceipt({...p,plannedDate:p.plannedDate.toISOString(),createdAt:p.createdAt.toISOString(),evidence:savedPaymentEvidence(p)?.evidence},receiptCount.get(p.id)||0,getMoscowDateKey())).map(p=>({id:`receipt-${p.id}`,title:'Исполнителю оплаты: приложить чек',detail:`${p.supplierPartner} · ${rub(Number(p.plannedAmount))}`,href:planHref(p.id)})),
  expenseCount:queue.length,expenseCheckedAt:sync?.completedAt?.toISOString()??null,
  expenseActions:queue.map(row=>({id:`expense-${row.id}`,title:row.stage==='decision'?'Администратору: согласовать расход':'Заявка на выдачу денег',detail:[row.person,row.amount===null?'Сумма не подтверждена':rub(row.amount),row.purpose].filter(Boolean).join(' · '),href:`/admin/expense-requests?request=${row.id}`}))};
}
async function taxes(now:Date):Promise<HomeTaxes>{
 const [documents,reports]=await Promise.all([prisma.taxControlDocument.findMany({orderBy:{createdAt:'desc'}}),loadPortalReports(undefined,{latestPerScope:true})]);
 const review=await loadTaxManagementReview(documents);
 const workspace=buildTaxWorkspace({reports,documents,now});
 const latest=taxPaymentHistory(workspace.full).find(row=>row.assessed!==undefined);
 const totals=review?managementTotals(review):null;
 return {cutoff:review?.cutoff??null,reviewedAt:review?.reviewedAt??null,confirmedOn:review?.accountantConfirmation?.confirmedOn??null,confirmationSource:review?.accountantConfirmation?.source??null,income:totals?totals.fns/100:null,threshold:totals?totals.limitCents/100:null,excess:totals?Math.max(0,totals.fns-totals.limitCents)/100:null,crossedOn:review?.fnsCrossing??null,ausnEndedOn:review?.regimeStatus?.ausnEndedOn??null,usnConfirmed:review?.regimeStatus?false:null,
  findings:(review?.findings.filter(row=>row.status!=='verified')??[]).map((row,i)=>({id:`tax-${i}`,title:row.title,detail:row.action,href:'/admin/taxes?tab=reconciliation'})),assessment:latest?.assessed??null,assessmentPeriod:latest?.periodKey??null};
}
async function analytics(now:Date):Promise<HomeAnalytics>{
 const current=getMoscowDateKey(now).slice(0,7);
 const run=await prisma.payrollRun.findFirst({where:{status:'FINAL',period:{periodKey:{lt:current}}},orderBy:[{period:{periodKey:'desc'}},{createdAt:'desc'}],include:{period:true,employeeResults:true,analyticsRows:true}});
 if(!run)return {period:null,revenue:null,profit:null,margin:null,sourceAt:null,source:'Нет финального расчёта',priceReviewCount:null};
 const extended=await prisma.salesAnalyticsReport.findFirst({where:{period:run.period.periodKey,sourceReportType:'extended_vgp'},orderBy:{uploadedAt:'desc'},include:{rows:true}});
 const rows=extended?.rows??run.analyticsRows;
 const summary=run.sourceSummary&&typeof run.sourceSummary==='object'&&!Array.isArray(run.sourceSummary)?run.sourceSummary as Record<string,unknown>:{};
 const revenue=rows.length?rows.reduce((s,r)=>s+r.revenue,0):typeof summary.totalRevenue==='number'?summary.totalRevenue:run.employeeResults.length?run.employeeResults.reduce((s,r)=>s+r.revenue,0):null;
 const profit=rows.length?rows.reduce((s,r)=>s+r.grossProfit,0):typeof summary.totalGrossProfit==='number'?summary.totalGrossProfit:run.employeeResults.length?run.employeeResults.reduce((s,r)=>s+r.grossProfit,0):null;
 return {period:run.period.periodKey,revenue,profit,margin:revenue&&profit!==null?profit/revenue*100:null,sourceAt:(extended?.uploadedAt??run.updatedAt).toISOString(),source:extended?'Расширенный ВВП':'Финальный расчёт',priceReviewCount:rows.length?rows.filter(row=>row.grossProfit<0).length:null};
}
async function finance(now:Date){
 const source=await loadAdminForecastSources(getMoscowDateKey(now));
 // This card's amount is manager cash. Another healthy source (for example
 // salary balances) must not erase its last successful value during a cash outage.
 if(!source.manager)throw Error('Manager cash source unavailable');
 const boxes=source.manager?.cashboxes;
 const cash=boxes&&boxes.length?boxes.reduce((s,row)=>s+Math.round(row.balance*100),0)/100:null;
 const sourceComplete=Boolean(source.owner?.money?.complete&&source.payroll?.sourceComplete&&source.debts?.calculationReady);
 return {cash,checkedAt:source.manager?.checkedAt??source.checkedAt??null,sourceComplete,detail:sourceComplete?'Источники получены; покрытие оплат смотрите в плане подготовки.':'Источники денег не подтверждены полностью. Учётные остатки не равны свободным деньгам.'};
}
async function settlement(now:Date){
 const period=getMoscowDateKey(now).slice(0,7);
 const [source,payroll]=await Promise.all([readPayrollSettlementSource(period,getMoscowDateKey(now)),loadHomePayroll(now)]);
 if(!source.balance)throw Error('Balance unavailable');
 const evidence={...source,balance:source.balance};
 const rows=payroll.names.map(name=>currentPayrollSettlement(name,paymentCardSummary(evidence,name,payroll.names)));
 return {period,paid:rows.length?completeSettlementTotal(rows,'paid'):null,remaining:rows.length?completeSettlementTotal(rows,'remaining'):null,unassigned:rows.filter(row=>row.paid===null).length,unresolved:rows.filter(row=>row.paid===null||row.remaining===null).map(row=>row.employeeName),checkedAt:source.balance.checkedAt};
}
/** No source refresh that writes workflow, notification-read state or snapshots. */
export async function loadHomeSection<K extends HomeSection>(section:K,adminId:number,now=new Date()):Promise<HomeData[K]>{
 const loaders={workday:()=>workday(now),payments,taxes:()=>taxes(now),payroll:()=>loadHomePayroll(now),settlement:()=>settlement(now),finance:()=>finance(now),analytics:()=>analytics(now),service:async()=>{
  const inbox=await loadAdminInbox({userId:adminId,limit:100,view:'system',now});
  return {items:inbox.items.filter(row=>row.meta.category==='system'&&row.sourceState.active).map(row=>({id:row.id,title:row.event.title,detail:`${row.event.body} · ${new Date(row.event.occurredAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})}`,href:row.event.href}))};
 }};
 return await loaders[section]() as HomeData[K];
}
