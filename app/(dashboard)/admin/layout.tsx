import { redirect } from 'next/navigation';
import { getCurrentUser, portalHomePath } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect(portalHomePath(user));
  return children;
}
