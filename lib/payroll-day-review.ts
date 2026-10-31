import type { PayrollAttendanceSnapshotPayload } from './payroll-attendance-snapshot';
export const PAYROLL_ACCESS_FROM = '2026-10-31';
export const DIANA_REVIEW_NAME = 'Кумахова Диана';
export const payrollDayReviewEnabled = () => process.env.PAYROLL_DAY_REVIEW_ENABLED === '1';
// After the first approval, emergency UI shutdown must preserve accounting.
export const payrollDayAccountingEnabled = () => payrollDayReviewEnabled() || process.env.PAYROLL_DAY_REVIEW_ACCOUNTING_ENABLED === '1';
export type PayrollDaySource = { userId:number; employee:string; sourceEmployee:string; kind:'form'|'schedule'; dates:string[] };
export type ApprovedDayReview = { employeeId:number; payrollName:string; periodKey:string; dates:unknown; accessOnly?:boolean };
export function validPayrollDate(date:unknown):date is string {
 return typeof date==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
}
export function reviewDates(value:unknown,period:string,today:string,earliest:string):string[] {
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)||!Array.isArray(value)||!value.length||value.length>31
  ||value.some(date=>!validPayrollDate(date)||!date.startsWith(period+'-')||date>=today||date<earliest)
  ||new Set(value).size!==value.length)throw Error('Выберите прошедшие отработанные дни выбранного месяца.');
 return [...value].sort();
}
export function validDaySources(value:unknown,period:string):value is PayrollDaySource[] {
 if(!Array.isArray(value)||value.length>200)return false;
 const ids=new Set<number>(),names=new Set<string>();
 for(const row of value){
  if(!row||!Number.isSafeInteger(row.userId)||row.userId<=0||typeof row.employee!=='string'||!row.employee.trim()
   ||typeof row.sourceEmployee!=='string'||!row.sourceEmployee.trim()||ids.has(row.userId)||names.has(row.employee)||!['form','schedule'].includes(row.kind)||!Array.isArray(row.dates)
   ||row.dates.length>31||new Set(row.dates).size!==row.dates.length||row.dates.some((d:unknown)=>!validPayrollDate(d)||!d.startsWith(period+'-')))return false;
  ids.add(row.userId);names.add(row.employee);
 }
 return true;
}
/** A complete refreshed source can explicitly prove no marks yet; absence alone cannot. */
export function prepareDayReviewSource(payload:PayrollAttendanceSnapshotPayload,userId:number,name:string) {
 const source=payload.dayReviewSources?.find(row=>row.userId===userId&&row.employee===name);
 if(source?.kind!=='form'||source.dates.length||payload.formSummaries.some(row=>row.employee===source.sourceEmployee))return payload;
 return {...payload,formSummaries:[...payload.formSummaries,{employee:source.sourceEmployee,formRows:0,uniqueFormDates:0,workedDays:0,lateCount:0}]};
}
/** Overlay approvals on raw source dates, never on a previously overlaid count. */
export function applyApprovedPayrollDays(payload:PayrollAttendanceSnapshotPayload,reviews:ApprovedDayReview[]) {
 reviews=reviews.filter(row=>!row.accessOnly);
 if(!reviews.length)return payload;
 if(!payload.dayReviewSources||!validDaySources(payload.dayReviewSources,payload.period.periodKey))throw Error('Обновите источники рабочих дней перед подтверждением.');
 let prepared=payload;for(const review of reviews)prepared=prepareDayReviewSource(prepared,review.employeeId,review.payrollName);
 const result=structuredClone(prepared);
 const groups=new Map<string,Set<string>>();
 for(const review of reviews){
  if(review.periodKey!==payload.period.periodKey)throw Error('Период подтверждения не совпадает.');
  const source=payload.dayReviewSources.find(s=>s.userId===review.employeeId&&s.employee===review.payrollName);
  if(!source)throw Error('Нет точной привязки источника дней сотрудника.');
  const dates=reviewDates(review.dates,review.periodKey,'9999-12-31',review.payrollName===DIANA_REVIEW_NAME?'2026-10-01':PAYROLL_ACCESS_FROM);
  const all=groups.get(source.employee)??new Set(source.dates);dates.forEach(date=>all.add(date));groups.set(source.employee,all);
 }
 for(const [employee,dates]of groups){
  const source=payload.dayReviewSources.find(s=>s.employee===employee)!;
  if(source.kind==='schedule'){
   const rows=result.scheduleSummaries.filter(s=>s.employee===source.sourceEmployee);if(rows.length!==1||rows[0].scheduleDays!==source.dates.length)throw Error('Источник дней изменился.');
   rows[0].scheduleDays=dates.size;
  }else{
   const rows=result.formSummaries.filter(s=>s.employee===source.sourceEmployee);if(rows.length!==1||rows[0].uniqueFormDates!==source.dates.length)throw Error('Источник дней изменился.');
   rows[0].uniqueFormDates=dates.size;rows[0].workedDays=dates.size;
  }
 }
 return result;
}

export function validDayReviewPeriod(period:string,current:string) {
 return /^20\d{2}-(0[1-9]|1[0-2])$/.test(period)&&period>='2026-10'&&period<=current;
}
