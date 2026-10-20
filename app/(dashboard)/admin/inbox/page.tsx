import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
import { getCurrentUser } from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import { loadAdminInbox } from '@/lib/admin-inbox-data';
import { AdminInboxListClient } from './AdminInboxListClient';

export const dynamic = 'force-dynamic';

export default async function AdminInboxPage({ searchParams }: { searchParams: Promise<{ view?: string; review?:string }> }) {
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  const { view,review } = await searchParams;
  const initialView = view === 'history' || view === 'system' ? view : 'attention';
  const { items, attention, technicalCount } = await loadAdminInbox({ userId: admin.id, limit: 200, view: initialView === 'system' ? 'system' : 'history' });
  const fiscalReceipt=review?await prisma.adminInboxReceipt.findFirst({where:{userId:admin.id,event:{sourceType:'terminal_fiscal_review',sourceId:review}},include:{event:true}}):null;
  const initialReview=fiscalReceipt?{id:fiscalReceipt.id,audience:'admin' as const,sourceType:fiscalReceipt.event.sourceType,sourceId:fiscalReceipt.event.sourceId,href:fiscalReceipt.event.href,title:fiscalReceipt.event.title,body:fiscalReceipt.event.body}:null;
  return (
    <AdminShell pageTitle="Уведомления" pageDescription="Решения на сегодня и ближайшие оплаты. Просмотр сообщения не означает согласование заявки.">

      {process.env.PORTAL_ISOLATED_DEMO === '1' && <p className='mb-3 text-xs text-[#925b38]'>Учебный стенд · показаны примеры заявок. Рабочие данные и отправка push не подключены.</p>}
      <AdminInboxListClient initialReview={initialReview} initialItems={items} initialAttention={attention} initialView={initialView} technicalCount={technicalCount} />
    </AdminShell>
  );
}
