import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { getCurrentUser } from '@/lib/auth';
import { loadAdminInbox } from '@/lib/admin-inbox-data';
import { AdminInboxListClient } from './AdminInboxListClient';

export const dynamic = 'force-dynamic';

export default async function AdminInboxPage() {
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  const { items } = await loadAdminInbox({ userId: admin.id, limit: 200 });
  return (
    <AdminShell>
      <AdminBreadcrumbs current='Уведомления' />
      <div className='mt-3'>
        <h1 className='text-[26px] font-extrabold tracking-normal text-slate-950 md:text-[28px]'>Inbox</h1>
        <p className='mt-1 max-w-3xl text-sm font-medium text-slate-500'>Здесь видно, что появилось нового. Прочтение не закрывает проблему, не согласует заявку и не меняет её рабочий статус.</p>
      </div>
      <AdminInboxListClient initialItems={items} />
    </AdminShell>
  );
}
