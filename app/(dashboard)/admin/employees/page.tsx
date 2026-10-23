import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/AdminShell';
import EmployeesClient from './EmployeesClient';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EmployeesPage() {
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, login: true, role: true, sessionVersion: true, department: true, isActive: true, payrollName: true,
      payrollSalaryType: true, payrollReportGroup: true, payrollFixedSalary: true, payrollRuleFrom: true, payrollRuleThrough: true,
      portalArea: true, oneCManagerName: true, qrScanMode: true,
    },
  });

  return (
    <AdminShell pageTitle="Сотрудники" pageDescription="Справочник сотрудников, доступы в портал и данные для расчёта зарплаты.">
      <div className="mb-4 flex flex-wrap items-center gap-2"><Link href='/admin/employees/access' className='inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700'>Устройства и входы</Link></div>
      <div className='mt-5'><EmployeesClient currentUserId={admin.id} initialUsers={users} /></div>
    </AdminShell>
  );
}
