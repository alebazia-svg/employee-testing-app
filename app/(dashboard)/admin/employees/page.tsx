import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/AdminShell';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import EmployeesClient from './EmployeesClient';

export const dynamic = 'force-dynamic';

export default async function EmployeesPage() {
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, login: true, role: true, department: true, isActive: true, payrollName: true,
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
