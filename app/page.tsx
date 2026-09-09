import { redirect } from 'next/navigation';
import { getCurrentUser, portalHomePath } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  redirect(portalHomePath(user));
}
