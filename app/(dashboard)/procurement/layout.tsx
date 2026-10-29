import { Suspense } from 'react';
import { EmployeeMobileStylePreload } from '@/components/EmployeeMobileStylePreload';
import { ProcurementWorkdayContent } from '@/components/ProcurementWorkdayContent';
import { EmployeeActivityTracker } from '@/components/EmployeeActivityTracker';
import { redirect } from 'next/navigation';
import { getCurrentUser, portalHomePath } from '@/lib/auth';
import { ProcurementShell } from '@/components/ProcurementShell';

export const dynamic = 'force-dynamic';

export default async function ProcurementLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'EMPLOYEE' || user.portalArea !== 'PROCUREMENT') redirect(portalHomePath(user));
  return <>{user.department === 'procurement' && <EmployeeMobileStylePreload/>}<ProcurementShell key={user.id} userName={user.name} workdayEnabled={user.department === 'procurement'} workdayContent={user.department === 'procurement' ? <Suspense fallback={<p className='px-4 py-6 text-sm text-slate-500'>Загружаем рабочий день…</p>}><ProcurementWorkdayContent user={user}/></Suspense> : undefined}><EmployeeActivityTracker />{children}</ProcurementShell></>;
}
