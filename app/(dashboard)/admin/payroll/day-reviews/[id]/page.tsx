import { getCurrentUser } from '@/lib/auth';
import { notFound,redirect } from 'next/navigation';
import { payrollDayReviewEnabled } from '@/lib/payroll-day-review';
import { AdminShell } from '@/components/AdminShell';
import { PayrollDayReviewDecision } from '@/components/PayrollDayReviewDecision';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
 const u=await getCurrentUser();if(!u)redirect('/login');if(!u.isActive||u.role!=='ADMIN'||!payrollDayReviewEnabled())notFound();
 return <AdminShell pageTitle='Подтверждение выходов' pageDescription='Проверьте даты перед изменением начисления.'><PayrollDayReviewDecision id={(await params).id}/></AdminShell>;
}
