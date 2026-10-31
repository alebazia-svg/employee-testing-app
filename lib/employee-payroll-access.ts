import { getMoscowDateKey } from './workday';
import { PAYROLL_ACCESS_FROM } from './payroll-day-review';
export const PAYROLL_ACCESS_MANAGERS=['Кумахова Диана','Ахобекова Залина','Хурзокова Лиана','Чеченова Милана','Абшаева Зухра','Костеренко Магомед'];
export type PayrollRequiredAction={kind:'schedule'|'start'|'finish'|'days_review';title:string;message:string;label:string;href:string};
export function payrollRequiredAction(input:{today:string;tomorrow:string;planned:{date:string;status:string}[];workDays:{date:string;startedAt:Date;endedAt:Date|null;status:string}[];approvedDates:string[];vacationDates:string[];requireStart:boolean}):PayrollRequiredAction|null {
 if(input.today<PAYROLL_ACCESS_FROM)return null;
 const approved=new Set(input.approvedDates),vacation=new Set(input.vacationDates);
 const plans=new Map(input.planned.map(row=>[row.date,row.status]));
 const facts=new Map(input.workDays.filter(row=>Number.isFinite(row.startedAt.getTime())&&getMoscowDateKey(row.startedAt)===row.date&&['active','completed','missing_checkout'].includes(row.status)).map(row=>[row.date,row]));
 const missingPlan=[input.today,input.tomorrow].find(date=>!vacation.has(date)&&!['working','off'].includes(plans.get(date)??''));
 if(missingPlan)return {kind:'schedule',title:'Заполните график',message:'Укажите рабочие и выходные дни на сегодня и завтра, чтобы посмотреть расчёт.',label:'Открыть график',href:`/employee?tab=schedule&date=${missingPlan}`};
 const missingPast=input.planned.filter(row=>row.date>=PAYROLL_ACCESS_FROM&&row.date<input.today&&row.status==='working'&&!vacation.has(row.date)&&!approved.has(row.date)).find(row=>!facts.has(row.date));
 if(missingPast)return {kind:'days_review',title:'Подтвердите прошлые выходы',message:'Есть рабочие дни без отметок. Отправьте отработанные дни администратору на подтверждение.',label:'Выбрать дни',href:`/employee/payroll/day-reviews?month=${missingPast.date.slice(0,7)}`};
 const unfinished=[...facts.values()].find(row=>row.date>=PAYROLL_ACCESS_FROM&&row.date<input.today&&!row.endedAt&&!approved.has(row.date));
 if(unfinished)return {kind:'finish',title:'Завершите прошлую смену',message:'Откройте рабочий день и завершите незакрытую смену.',label:'Открыть рабочий день',href:'/employee'};
 if(input.requireStart&&plans.get(input.today)==='working'&&!vacation.has(input.today)&&!facts.has(input.today)&&!approved.has(input.today))return {kind:'start',title:'Отметьте начало смены',message:'Сегодня у вас рабочий день. Отсканируйте QR-код в магазине, чтобы посмотреть расчёт.',label:'Начать смену',href:'/employee'};
 return null;
}

/** Keep an already submitted obligation clear; do not ask the employee to resubmit. */
export function pendingPayrollDayAction(action:PayrollRequiredAction,pendingPeriods:string[]):PayrollRequiredAction {
 if(action.kind!=='days_review')return action;
 const month=new URL(action.href,'https://preview.invalid').searchParams.get('month');
 return month&&pendingPeriods.includes(month)?{...action,title:'Выходы на подтверждении',message:'Администратор проверяет ваши дни. После подтверждения расчёт обновится.',label:'Посмотреть запрос'}:action;
}

/** Approval opens the calculation once; an old approval must not trap remaining days in a redirect loop. */
export function openPayrollAfterDayReview(input:{latestId?:string;latestStatus?:string;pendingId?:string;reviewRequired:boolean}):boolean {
 return input.latestStatus==='approved'&&(!input.reviewRequired||Boolean(input.pendingId&&input.pendingId===input.latestId));
}
