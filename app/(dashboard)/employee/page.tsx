import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { loadEmployeeHome } from '@/lib/employee-home';
import { EmployeeTodayClient } from './EmployeeTodayClient';
export const dynamic = 'force-dynamic';
export default async function Employee() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <EmployeeTodayClient {...await loadEmployeeHome(user)} />;
}
