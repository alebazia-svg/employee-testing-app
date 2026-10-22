import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { PersonalPayrollScreen } from './PersonalPayrollScreen';
import { payrollFeatureState } from '@/lib/payroll-features';

export const dynamic = 'force-dynamic';

export default async function PersonalPayrollPage() {
  if (!payrollFeatureState().employeeEnabled) notFound();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.isActive || user.role !== 'EMPLOYEE' || user.portalArea !== 'WORKDAY') notFound();
  return <PersonalPayrollScreen user={user} />;
}
