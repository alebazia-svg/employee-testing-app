import { redirect } from 'next/navigation';
import { getCurrentUser, portalHomePath } from '@/lib/auth';
import { ProcurementShell } from '@/components/ProcurementShell';

export const dynamic = 'force-dynamic';

export default async function ProcurementLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'EMPLOYEE' || user.portalArea !== 'PROCUREMENT') redirect(portalHomePath(user));
  return <ProcurementShell userName={user.name}>{children}</ProcurementShell>;
}
