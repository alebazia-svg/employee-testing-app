import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AdminShell } from '@/components/AdminShell';
import AdminPageJournalPreview from './AdminPageJournalPreview';

export const dynamic = 'force-dynamic';
export default async function Page() {
  if (process.env.ADMIN_PAGE_JOURNAL_PREVIEW !== '1' || process.env.PORTAL_ISOLATED_DEMO !== '1') notFound();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/employee');
  return <AdminShell pageTitle='Устройства и входы' pageDescription='Кто пользуется порталом и где подключены уведомления.' headerWidthClass='max-w-6xl'>
    <div className='mx-auto max-w-6xl mb-4 text-sm'><Link href='/admin/employees' className='text-slate-600 hover:underline'>← Сотрудники</Link></div>
    <AdminPageJournalPreview />
  </AdminShell>;
}
