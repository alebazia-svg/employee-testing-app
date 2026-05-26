import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/AdminShell';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import EmployeesClient from './EmployeesClient';

export default async function EmployeesPage() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, login: true, role: true },
  });

  return (
    <AdminShell>
      <div className='mb-7'>
        <AdminBreadcrumbs current='Сотрудники' />
        <h1 className='text-3xl font-extrabold tracking-normal text-slate-950'>Сотрудники</h1>
        <p className='mt-1 text-base font-medium text-slate-500'>Управление списком сотрудников и статусами</p>
      </div>
      <EmployeesClient initialUsers={users} />
    </AdminShell>
  );
}
