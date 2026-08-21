import { cookies } from 'next/headers';
import { sessionCookieName } from '@/lib/session';

export async function POST() {
  cookies().delete(sessionCookieName);
  cookies().delete('userId');

  return Response.json({ ok: true });
}
