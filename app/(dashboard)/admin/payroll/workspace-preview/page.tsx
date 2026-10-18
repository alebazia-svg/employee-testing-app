import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AdminPayrollPage from '../PayrollClient';
import '../payroll-settlement-preview.css';
export const dynamic = 'force-dynamic';
export default async function PayrollWorkspacePreview() {
  if (process.env.PAYROLL_SETTLEMENT_PREVIEW !== '1') notFound();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/employee');
  return <AdminPayrollPage liveWorkspace testEnvironment />;
}
