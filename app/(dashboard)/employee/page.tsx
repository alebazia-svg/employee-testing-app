import { procurementWorkdayEntry } from '@/lib/procurement-mobile-navigation';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { loadEmployeeHome } from '@/lib/employee-home';
import { EmployeeTodayClient } from './EmployeeTodayClient';
export const dynamic = 'force-dynamic';
export default async function Employee({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.portalArea === 'PROCUREMENT' && user.department === 'procurement') redirect(procurementWorkdayEntry(await searchParams));
  return <EmployeeTodayClient {...await loadEmployeeHome(user)} />;
}
