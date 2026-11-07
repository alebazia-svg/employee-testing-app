import { loadEmployeeHome } from '@/lib/employee-home';
import { EmployeeTodayClient } from '@/app/(dashboard)/employee/EmployeeTodayClient';
import { EmployeePayrollSnapshots } from './EmployeePayrollSnapshots';

/** Same authenticated workday loader/actions as /employee, with no financial-source reads. */
export async function ProcurementWorkdayContent({ user }: { user: Parameters<typeof loadEmployeeHome>[0] }) {
  const home = await loadEmployeeHome(user);
  return <EmployeePayrollSnapshots>
    <EmployeeTodayClient {...home} />
  </EmployeePayrollSnapshots>;
}
