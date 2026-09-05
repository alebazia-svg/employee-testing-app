import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/AdminShell';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import EmployeesClient from './EmployeesClient';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

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
    },
  });

  return (
    <AdminShell>
      <AdminBreadcrumbs current='Сотрудники' />
      <AdminPageHeader eyebrow='Команда' title='Сотрудники' description='Справочник сотрудников, доступы в портал и данные для расчёта зарплаты.' />
      <div className='mt-5'><EmployeesClient initialUsers={users} /></div>
    </AdminShell>
  );
}
