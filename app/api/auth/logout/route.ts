import { cookies } from 'next/headers';
import { sessionCookieName } from '@/lib/session';
import { getCurrentUser } from '@/lib/auth';
import { recordPortalLogout } from '@/lib/portal-access-journal';

export async function POST() {
  const cookieStore = await cookies();
  try {
    const user = await getCurrentUser();
    if (user) await recordPortalLogout(cookieStore.get(sessionCookieName)?.value, user.id);
  } catch { console.warn('PORTAL_ACCESS_JOURNAL_UNAVAILABLE'); }
  cookieStore.delete(sessionCookieName);
  cookieStore.delete('userId');

  return Response.json({ ok: true });
}
