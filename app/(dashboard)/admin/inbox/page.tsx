import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
import { getCurrentUser } from '@/lib/auth';
import { loadAdminInbox } from '@/lib/admin-inbox-data';
import { AdminInboxListClient } from './AdminInboxListClient';

export const dynamic = 'force-dynamic';

export default async function AdminInboxPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  const { view } = await searchParams;
  const initialView = view === 'history' || view === 'system' ? view : 'attention';
  const { items, attention, technicalCount } = await loadAdminInbox({ userId: admin.id, limit: 200, view: initialView === 'system' ? 'system' : 'history' });
  return (
    <AdminShell pageTitle="Уведомления" pageDescription="Нерешённые дела остаются здесь до результата. Просмотр сообщения не означает согласование заявки.">

      {process.env.PORTAL_ISOLATED_DEMO === '1' && <p className='mb-3 text-xs text-[#925b38]'>Учебный стенд · показаны примеры заявок. Рабочие данные и отправка push не подключены.</p>}
      <AdminInboxListClient initialItems={items} initialAttention={attention} initialView={initialView} technicalCount={technicalCount} />
    </AdminShell>
  );
}
