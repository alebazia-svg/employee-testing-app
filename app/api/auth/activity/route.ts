import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { accessBrowserCookie, validAccessBrowserId } from '@/lib/portal-access-identity';
import { getCurrentUser } from '@/lib/auth';
import { sessionCookieName } from '@/lib/session';
import { parsePushObservation, recordPortalAccess } from '@/lib/portal-access-journal';
import { observeAppUpdate } from '@/lib/portal-app-update-server';

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
    const jar = await cookies();
    const token = jar.get(sessionCookieName)?.value;
    const savedId = jar.get(accessBrowserCookie)?.value;
    const browserInstanceId = validAccessBrowserId(savedId) ? savedId : randomUUID();
    await recordPortalAccess({ userId: user.id, token, browserInstanceId, userAgent: req.headers.get('user-agent') ?? '', push: observation });
    if (browserInstanceId !== savedId) jar.set(accessBrowserCookie, browserInstanceId, { httpOnly: true, secure: new URL(req.url).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 31536000 });
    const updateCommand = observation.app ? await observeAppUpdate(user.id, token, observation.app) : null;
    return Response.json({ ok: true, ...(updateCommand ? { updateCommand } : {}) });
  } catch {
    return Response.json({ error: 'Journal unavailable' }, { status: 503 });
  }
}
