import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { payrollFeatureState } from '@/lib/payroll-features';

export const dynamic = 'force-dynamic';

export default async function PersonalPayrollPage() {
  if (!payrollFeatureState().employeeEnabled) notFound();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.isActive || user.role !== 'EMPLOYEE' || user.portalArea !== 'WORKDAY') notFound();
  redirect('/employee?tab=payroll');
}
