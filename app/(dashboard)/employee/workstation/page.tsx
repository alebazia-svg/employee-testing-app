import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { WorkstationBindingClient } from './WorkstationBindingClient';

export const dynamic = 'force-dynamic';

export default async function WorkstationBindingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <WorkstationBindingClient />;
}
