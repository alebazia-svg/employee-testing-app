import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { EmployeePortalHeader, employeeHeaderDateLabel } from '../EmployeePortalHeader';
import { PersonalPayrollClient } from './PersonalPayrollClient';
import { payrollFeatureState } from '@/lib/payroll-features';
import './payroll.css';

export const dynamic = 'force-dynamic';

export default async function PersonalPayrollPage() {
  if (!payrollFeatureState().employeeEnabled) notFound();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.isActive || user.role !== 'EMPLOYEE' || user.portalArea !== 'WORKDAY') notFound();
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());
  return <main className='portal-neutral-design employee-material-ui portal-palette-mobo portal-typography-refined payroll-phone min-h-[100dvh]'>
    <div className='employee-material-shell mx-auto min-h-[100dvh] w-full max-w-[520px]'>
      <EmployeePortalHeader name={user.name} meta={`${user.department === 'wholesale' ? 'Опт' : 'Розница'} · ${employeeHeaderDateLabel(today)}`} />
      <PersonalPayrollClient currentMonth={today.slice(0, 7)} />
    </div>
  </main>;
}
