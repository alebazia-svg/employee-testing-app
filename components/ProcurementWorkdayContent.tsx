import { loadEmployeeHome } from '@/lib/employee-home';
import { EmployeeTodayClient } from '@/app/(dashboard)/employee/EmployeeTodayClient';
import { CashIssueProvider } from '@/app/(dashboard)/employee/CashIssueClient';
import { EmployeePayrollSnapshots } from './EmployeePayrollSnapshots';
import { EmployeeActionReminderProvider } from './workday/EmployeeActionReminder';

/** Same authenticated workday loader/actions as /employee, with no financial-source reads. */
export async function ProcurementWorkdayContent({ user }: { user: Parameters<typeof loadEmployeeHome>[0] }) {
  const home = await loadEmployeeHome(user);
  return <CashIssueProvider><EmployeePayrollSnapshots><EmployeeActionReminderProvider>
    <EmployeeTodayClient {...home} />
  </EmployeeActionReminderProvider></EmployeePayrollSnapshots></CashIssueProvider>;
}
