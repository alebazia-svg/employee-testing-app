import 'server-only';
import { prisma } from './prisma';
import type { Prisma, PrismaClient } from '@prisma/client';
import { getMoscowDateKey, buildDateRange } from './workday';
import { getPrivatePayrollBinding } from './payroll-current-read';
import { PAYROLL_ACCESS_FROM,payrollDayReviewEnabled,reviewDates } from './payroll-day-review';
import { PAYROLL_ACCESS_MANAGERS,payrollRequiredAction,pendingPayrollDayAction } from './employee-payroll-access';
export async function readPayrollAccess(userId:number,now=new Date(),db:PrismaClient=prisma) {
 if(!payrollDayReviewEnabled())return null;
 return db.$transaction(tx=>readPayrollAccessInTransaction(tx,userId,now),{isolationLevel:'RepeatableRead'});
}
/** Share the same access decision with the request screen, within its read snapshot. */
export async function readPayrollAccessInTransaction(tx:Prisma.TransactionClient,userId:number,now=new Date()) {
 if(!payrollDayReviewEnabled())return null;
  const users=await tx.user.findMany({select:{id:true,name:true,payrollName:true,role:true,isActive:true,department:true,portalArea:true,payrollSalaryType:true,payrollReportGroup:true,payrollFixedSalary:true,payrollRuleFrom:true,payrollRuleThrough:true}});
  const name=getPrivatePayrollBinding(users,userId),u=users.find(u=>u.id===userId);
  if(!name||u?.portalArea!=='WORKDAY'||!PAYROLL_ACCESS_MANAGERS.includes(name))return null;
  const today=getMoscowDateKey(now);if(today<PAYROLL_ACCESS_FROM)return null;
  const tomorrow=buildDateRange(today,2)[1];
  const [planned,workDays,reviews,vacations]=await Promise.all([
   tx.workScheduleEntry.findMany({where:{userId,date:{gte:PAYROLL_ACCESS_FROM,lte:tomorrow}},select:{date:true,status:true}}),
   tx.workDayEntry.findMany({where:{userId,date:{gte:PAYROLL_ACCESS_FROM,lte:today}},select:{date:true,startedAt:true,endedAt:true,status:true}}),
   tx.payrollDayReview.findMany({where:{employeeId:userId,payrollName:name,status:{in:['approved','pending']}},select:{periodKey:true,dates:true,status:true}}),
   tx.employeeVacation.findMany({where:{userId,status:'active',dateFrom:{lte:tomorrow},dateTo:{gte:PAYROLL_ACCESS_FROM}},select:{dateFrom:true,dateTo:true}}),
  ]);
  const approved=reviews.filter(r=>r.status==='approved'),pendingPeriods=reviews.filter(r=>r.status==='pending').map(r=>r.periodKey);
  const vacationDates=[...new Set(vacations.flatMap(v=>{const from=v.dateFrom>PAYROLL_ACCESS_FROM?v.dateFrom:PAYROLL_ACCESS_FROM;const to=v.dateTo<tomorrow?v.dateTo:tomorrow;const n=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;return n>0&&n<=4000?buildDateRange(from,n):[];}))];
  const action=payrollRequiredAction({today,tomorrow,planned,workDays,vacationDates,approvedDates:approved.flatMap(r=>reviewDates(r.dates,r.periodKey,'9999-12-31',r.periodKey+'-01')),requireStart:true});
  if(action)return pendingPayrollDayAction(action,pendingPeriods);
  return null;
}

