import { getCurrentUser, portalHomePath } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ProcurementHome } from './ProcurementHome';
export const dynamic = 'force-dynamic';
export default async function ProcurementPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'EMPLOYEE' || user.portalArea !== 'PROCUREMENT') redirect(portalHomePath(user));
  return <ProcurementHome user={user} />;
}
