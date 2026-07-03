import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
import { getCurrentUser } from '@/lib/auth';
import { AdminQrTestClient } from './AdminQrTestClient';

export const dynamic = 'force-dynamic';

export default async function AdminQrTestPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/employee');

  return (
    <AdminShell>
      <AdminQrTestClient />
    </AdminShell>
  );
}
