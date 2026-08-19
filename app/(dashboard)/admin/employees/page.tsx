import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/AdminShell';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { getMoscowDateKey } from '@/lib/workday';
import EmployeesClient from './EmployeesClient';

export const dynamic = 'force-dynamic';

export default async function EmployeesPage() {
  const today = getMoscowDateKey();
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, login: true, role: true, department: true, isActive: true, payrollName: true,
      workSchedules: { where: { date: today }, take: 1, select: { status: true } },
      workDays: { where: { date: today }, take: 1, orderBy: { startedAt: 'desc' }, select: { status: true, startedAt: true, endedAt: true } },
      _count: {
        select: {
          workdayControlIssues: { where: { status: 'open' } },
          terminalFiscalReviews: { where: { status: { in: ['open', 'admin_review'] } } },
        },
      },
    },
  });

  const rows = users.map((user) => {
    const workDay = user.workDays[0] ?? null;
    const schedule = user.workSchedules[0]?.status ?? null;
    const todayState = user.role === 'ADMIN'
      ? 'admin'
      : workDay?.endedAt || workDay?.status === 'completed'
        ? 'completed'
        : workDay
          ? 'working'
          : schedule === 'working'
            ? 'not_started'
            : schedule === 'off'
              ? 'off'
              : 'no_schedule';
    return {
      id: user.id,
      name: user.name,
      login: user.login,
      role: user.role,
      department: user.department,
      isActive: user.isActive,
      payrollName: user.payrollName,
      todayState,
      attentionCount: user._count.workdayControlIssues + user._count.terminalFiscalReviews,
    };
  });

  return (
    <AdminShell>
      <AdminBreadcrumbs current='Сотрудники' />
      <AdminPageHeader eyebrow='Команда' title='Сотрудники' description='Сегодняшнее состояние сотрудников и настройки доступа к порталу.' />
      <div className='mt-5'><EmployeesClient initialUsers={rows} /></div>
    </AdminShell>
  );
}
