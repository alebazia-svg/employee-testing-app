import { needsWorkdayEndReminder } from '@/lib/workday-end-policy';
import { EmployeeAppSetupProvider } from '@/components/workday/EmployeeAppSetupProvider';
import { EmployeeWorkHelpProvider } from '@/components/workday/EmployeeWorkHelp';
import { supportsScheduleNearReminders } from '@/lib/schedule-near-reminder';
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
  return <EmployeeAppSetupProvider key={user.id} enabled={supportsScheduleNearReminders(user.department)}><EmployeeWorkHelpProvider attendanceOnly={needsWorkdayEndReminder(user)} department={user.department} enabled={supportsScheduleNearReminders(user.department)}><EmployeeInterfaceStyle copper /><Suspense fallback={null}><CashIssueProvider key={user.id}><EmployeeActivityTracker /><EmployeePayrollSnapshots><EmployeeActionReminderProvider>{children}</EmployeeActionReminderProvider></EmployeePayrollSnapshots></CashIssueProvider></Suspense></EmployeeWorkHelpProvider></EmployeeAppSetupProvider>;
}
