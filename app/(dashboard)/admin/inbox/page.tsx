import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminInboxListClient } from './AdminInboxListClient';

export const dynamic = 'force-dynamic';

export default async function AdminInboxPage() {
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  const rows = await prisma.adminInboxReceipt.findMany({
    where: { userId: admin.id },
    include: { event: true },
    orderBy: { event: { occurredAt: 'desc' } },
    take: 200,
  });
  const items = rows.map((row) => ({
    id: row.id,
    readAt: row.readAt?.toISOString() ?? null,
    event: { ...row.event, occurredAt: row.event.occurredAt.toISOString(), createdAt: row.event.createdAt.toISOString() },
  }));
  return (
    <AdminShell>
      <AdminBreadcrumbs current='Уведомления' />
      <div className='mt-3'>
        <h1 className='text-[26px] font-extrabold tracking-normal text-slate-950 md:text-[28px]'>Уведомления ADMIN</h1>
        <p className='mt-1 max-w-3xl text-sm font-medium text-slate-500'>Общий inbox событий портала. Прочтение уведомления не меняет заявку, не согласует её и не закрывает проблему.</p>
      </div>
      <AdminInboxListClient initialItems={items} />
    </AdminShell>
  );
}
