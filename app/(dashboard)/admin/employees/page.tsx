import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/AdminShell';
import EmployeesClient from './EmployeesClient';

export default async function EmployeesPage() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, login: true, role: true },
  });

  return (
    <AdminShell>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-slate-900'>Сотрудники</h1>
        <p className='text-sm text-slate-500'>Пользователи, роли и смена пароля.</p>
      </div>
      <EmployeesClient initialUsers={users} />
    </AdminShell>
  );
}
