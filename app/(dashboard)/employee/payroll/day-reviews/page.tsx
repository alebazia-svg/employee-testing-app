import { departmentLabel } from '@/lib/workday';
import { getCurrentUser } from '@/lib/auth';
import { notFound,redirect } from 'next/navigation';
import { payrollDayReviewEnabled,validDayReviewPeriod } from '@/lib/payroll-day-review';
import { employeePayrollMonthAt } from '@/lib/employee-payroll-view';
import { EmployeePortalHeader,employeeHeaderDateLabel } from '../../EmployeePortalHeader';
import { PayrollDayReviewEmployee } from './PayrollDayReviewEmployee';
import '../payroll.css';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{month?:string}>}){
 const u=await getCurrentUser();if(!u)redirect('/login');if(!payrollDayReviewEnabled()||!u.isActive||u.role!=='EMPLOYEE'||u.portalArea!=='WORKDAY')notFound();
 const current=employeePayrollMonthAt(),month=(await searchParams).month??current;
 if(!validDayReviewPeriod(month,current))notFound();
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(new Date());
 return <main className='portal-neutral-design employee-material-ui min-h-[100dvh] overflow-x-clip bg-[#151a1d] text-slate-950 payroll-phone portal-palette-mobo portal-typography-refined'><div className='employee-material-shell relative mx-auto flex min-h-screen w-full max-w-[520px] flex-col bg-[#f7faf8] shadow-[0_0_70px_rgba(0,0,0,.24)] ring-1 ring-white/10'><EmployeePortalHeader name={u.name} meta={departmentLabel(u.department)+' · '+employeeHeaderDateLabel(today)}/><PayrollDayReviewEmployee month={month}/></div></main>;
}
