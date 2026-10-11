import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
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
    <AdminShell pageTitle="История уведомлений" pageDescription="Хронология новых событий. Прочтение не закрывает проблему, не согласует заявку и не меняет рабочий статус.">

      <AdminInboxListClient initialItems={items} />
    </AdminShell>
  );
}
