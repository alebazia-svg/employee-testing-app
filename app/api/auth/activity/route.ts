import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { sessionCookieName } from '@/lib/session';
import { parsePushObservation, recordPortalAccess } from '@/lib/portal-access-journal';

export async function POST(req: Request) {
  // Browser-only same-origin endpoint. No cross-origin tracking or public ingestion.
  if (req.headers.get('sec-fetch-site') !== 'same-origin') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const raw = await req.text();
  if (raw.length > 5000) return Response.json({ error: 'Invalid input' }, { status: 400 });
  let observation; try { observation = parsePushObservation(JSON.parse(raw)); } catch { observation = null; }
  if (!observation) return Response.json({ error: 'Invalid input' }, { status: 400 });
  try {
    const token = (await cookies()).get(sessionCookieName)?.value;
    await recordPortalAccess({ userId: user.id, token, userAgent: req.headers.get('user-agent') ?? '', push: observation });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Journal unavailable' }, { status: 503 });
  }
}
