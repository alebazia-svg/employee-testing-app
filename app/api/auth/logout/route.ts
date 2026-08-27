import { cookies } from 'next/headers';
import { sessionCookieName } from '@/lib/session';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
  cookieStore.delete('userId');

  return Response.json({ ok: true });
}
