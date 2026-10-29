import { EmployeeActivityTracker } from '@/components/EmployeeActivityTracker';
import { Suspense } from 'react';
import { CashIssueProvider } from './CashIssueClient';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { EmployeeInterfaceStyle } from '@/components/EmployeeInterfaceStyle';
import { EmployeeActionReminderProvider } from '@/components/workday/EmployeeActionReminder';
import { EmployeePayrollSnapshots } from '@/components/EmployeePayrollSnapshots';

export const dynamic = 'force-dynamic';

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'EMPLOYEE') redirect('/admin');
  if (user.portalArea === 'PROCUREMENT' && user.department !== 'procurement') redirect('/procurement');
  return <><EmployeeInterfaceStyle copper /><Suspense fallback={null}><CashIssueProvider key={user.id}><EmployeeActivityTracker /><EmployeePayrollSnapshots><EmployeeActionReminderProvider>{children}</EmployeeActionReminderProvider></EmployeePayrollSnapshots></CashIssueProvider></Suspense></>;
}
