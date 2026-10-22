import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ReminderComparison } from './ReminderComparison';

export const dynamic = 'force-dynamic';

export default async function ReminderComparisonPage() {
  if (process.env.PORTAL_ISOLATED_DEMO !== '1') notFound();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.isActive || user.role !== 'EMPLOYEE' || user.portalArea !== 'WORKDAY') notFound();
  return <ReminderComparison />;
}
