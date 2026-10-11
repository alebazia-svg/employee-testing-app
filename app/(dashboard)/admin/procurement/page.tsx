import { Suspense } from 'react';
import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { getCurrentUser, portalHomePath } from '@/lib/auth';
import { AdminShell } from '@/components/AdminShell';
import { readAdminPlans } from '@/lib/procurement-admin-plans';
import { adminInitialView } from '@/lib/procurement-admin-initial-view';
import { expenseRequestMoscowCalendarDate } from '@/lib/expense-request-source';
import { AdminProcurementStream } from './AdminProcurementStream';
import { AdminProcurementLive } from './AdminProcurementLive';

export const dynamic = 'force-dynamic';
export default async function AdminProcurementPage() {
  // Guard here too: layouts and pages can be evaluated concurrently.
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect(portalHomePath(user));
  const plans = await readAdminPlans();
  const generation = randomUUID();
  const initial = adminInitialView(plans, expenseRequestMoscowCalendarDate(new Date()));
  return <AdminShell pageTitle="Платёжный календарь" headerWidthClass="max-w-[1440px]">
    <AdminProcurementStream initial={initial} generation={generation}>
      <Suspense fallback={null}>
        <AdminProcurementLive initialPlans={plans} generation={generation}/>
      </Suspense>
    </AdminProcurementStream>
  </AdminShell>;
}
