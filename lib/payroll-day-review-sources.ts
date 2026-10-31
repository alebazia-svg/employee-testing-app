import type { AttendanceRow } from './google-sheets';
import { findAttendanceMatches, payrollAttendanceConfig } from './payroll-calculation-engine';
import type { PayrollAttendanceFormSummary, PayrollAttendanceSourceSummary } from './payroll-attendance-snapshot';
import { validPayrollDate, type PayrollDaySource } from './payroll-day-review';
type Person={id:number;name:string;payrollName:string|null;role:string;isActive:boolean;portalArea:string};
export function buildReviewDaySources(input:{periodKey:string;through:string;users:Person[];googleRows:AttendanceRow[];formSummaries:PayrollAttendanceFormSummary[];appSources:PayrollAttendanceSourceSummary[];dianaDates:string[]}) {
 const sources:PayrollDaySource[]=[];
 for(const u of input.users){
  const name=u.payrollName?.trim();if(!name||!u.isActive||u.role!=='EMPLOYEE'||u.portalArea!=='WORKDAY'
   ||input.users.filter(v=>(v.payrollName?.trim()||v.name.trim())===name).length!==1)continue;
  if(name==='Кумахова Диана'){sources.push({userId:u.id,employee:name,sourceEmployee:name,kind:'schedule',dates:input.dianaDates});continue;}
  const config=payrollAttendanceConfig[name];if(config?.sourceType!=='form')continue;
  const matches=findAttendanceMatches(input.formSummaries,config.attendanceNames);if(matches.length>1)throw Error('Неоднозначный источник выходов сотрудника.');
  const dates=new Set<string>();
  for(const row of findAttendanceMatches(input.googleRows,config.attendanceNames)){
   const raw=row.timestamp||row.date;const ru=raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
   const date=ru?`${ru[3]}-${ru[2].padStart(2,'0')}-${ru[1].padStart(2,'0')}`:raw.slice(0,10);
   if(!validPayrollDate(date))throw Error('Не удалось определить дату исходной отметки.');
   if(date.startsWith(input.periodKey+'-')&&date<=input.through)dates.add(date);
  }
  input.appSources.filter(s=>s.userId===u.id).forEach(s=>s.appDates.forEach(d=>dates.add(d)));
  if(dates.size!==(matches[0]?.uniqueFormDates??0))throw Error('Даты источника не совпадают с количеством выходов.');
  sources.push({userId:u.id,employee:name,sourceEmployee:matches[0]?.employee??config.attendanceNames[0],kind:'form',dates:[...dates].sort()});
 }
 return sources;
}
