import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/AdminShell';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
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
      id: true, name: true, login: true, role: true, department: true, isActive: true, payrollName: true,
      payrollSalaryType: true, payrollReportGroup: true, payrollFixedSalary: true, payrollRuleFrom: true, payrollRuleThrough: true,
      portalArea: true, oneCManagerName: true,
    },
  });

  return (
    <AdminShell>
      <AdminBreadcrumbs current='Сотрудники' />
      <AdminPageHeader eyebrow='Команда' title='Сотрудники' description='Справочник сотрудников, доступы в портал и данные для расчёта зарплаты.' actions={<Link href='/admin/employees/access' className='inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700'>Устройства и входы</Link>} />
      <div className='mt-5'><EmployeesClient initialUsers={users} /></div>
    </AdminShell>
  );
}
