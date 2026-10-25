import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import EmployeesPage from '../page';
import EmployeeDayPreview from './EmployeeDayPreview';

export const dynamic = 'force-dynamic';

export default async function ActivityPreviewPage() {
  if (process.env.EMPLOYEE_ACTIVITY_PREVIEW !== '1') notFound();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/employee');
  return <><EmployeesPage /><EmployeeDayPreview /></>;
}
