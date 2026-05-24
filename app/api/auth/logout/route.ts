import { cookies } from 'next/headers';

export async function POST() {
  cookies().delete('userId');

  return Response.json({ ok: true });
}
