import { cookies } from 'next/headers';
import { sessionAccessCookieName, sessionCookieName, sessionTokenFromCookies } from '@/lib/session';
import { getCurrentUser } from '@/lib/auth';
import { recordPortalLogout } from '@/lib/portal-access-journal';

export async function POST() {
  const cookieStore = await cookies();
  try {
    const user = await getCurrentUser();
    if (user) {
      const token = sessionTokenFromCookies(cookieStore);
      const primary = cookieStore.get(sessionCookieName)?.value;
      await recordPortalLogout(token, user.id);
      if (primary && primary !== token) await recordPortalLogout(primary, user.id, true);
    }
  } catch { console.warn('PORTAL_ACCESS_JOURNAL_UNAVAILABLE'); }
  cookieStore.delete(sessionCookieName);
  cookieStore.delete(sessionAccessCookieName);
  cookieStore.delete('userId');

  return Response.json({ ok: true });
}
