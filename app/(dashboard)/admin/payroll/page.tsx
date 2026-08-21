import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AdminPayrollPage from './PayrollClient';

export const dynamic = 'force-dynamic';

export default async function PayrollPage() {
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  return <AdminPayrollPage />;
}
