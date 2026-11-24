import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { accessBrowserCookie, validAccessBrowserId } from '@/lib/portal-access-identity';
import { getCurrentUser } from '@/lib/auth';
import { createSessionToken, readSessionToken, sessionAccessId, sessionAccessCookieName, sessionCookieName, sessionTokenFromCookies, sessionMatchesUser, sessionMaxAgeSeconds } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { parsePushObservation, recordPortalAccess } from '@/lib/portal-access-journal';
import { observeAppUpdate } from '@/lib/portal-app-update-server';
import { accessClientIp } from '@/lib/portal-access-network';
import { portalRequestOrigin } from '@/lib/portal-device-observation';

export async function POST(req: Request) {
  // Browser-only same-origin endpoint. No cross-origin tracking or public ingestion.
  if (req.headers.get('sec-fetch-site') !== 'same-origin') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const raw = await req.text();
  if (raw.length > 6000) return Response.json({ error: 'Invalid input' }, { status: 400 });
  let observation; try { observation = parsePushObservation(JSON.parse(raw)); } catch { observation = null; }
  if (!observation) return Response.json({ error: 'Invalid input' }, { status: 400 });
  try {
    const jar = await cookies();
    const token = sessionTokenFromCookies(jar);
    const savedId = jar.get(accessBrowserCookie)?.value;
    const browserInstanceId = validAccessBrowserId(savedId) ? savedId : randomUUID();
    await recordPortalAccess({ userId: user.id, token, browserInstanceId, origin: portalRequestOrigin(req), clientIp: accessClientIp(req.headers), userAgent: req.headers.get('user-agent') ?? '', push: observation });
    if (browserInstanceId !== savedId) jar.set(accessBrowserCookie, browserInstanceId, { httpOnly: true, secure: new URL(req.url).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 31536000 });
    const updateCommand = observation.app ? await observeAppUpdate(user.id, token, observation.app, new Date(), browserInstanceId) : null;
    const now = Date.now();
    const foregroundAt = Number(req.headers.get('x-portal-foreground-at'));
    const session = readSessionToken(token, now);
    if (user.role === 'EMPLOYEE' && token && session && sessionMatchesUser(session, user, now)
      && Number.isSafeInteger(foregroundAt) && foregroundAt > 0
      && foregroundAt <= now + 5000 && foregroundAt > now - 120000
      && session.expiresAt - now <= 7 * 24 * 60 * 60 * 1000) {
      const accessId = sessionAccessId(token, session);
      // Preserve the original authorization and its device/activity history.
      const renewed = await prisma.portalAccessSession.updateMany({
        where: { sessionHash: accessId, userId: user.id, loggedOutAt: null,
          user: { isActive: true, role: 'EMPLOYEE', sessionVersion: session.sessionVersion } },
        data: { expiresAt: new Date(now + sessionMaxAgeSeconds * 1000) },
      });
      if (renewed.count) {
        const cookieOptions = {
          httpOnly: true, secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax' as const, path: '/', maxAge: sessionMaxAgeSeconds,
        };
        jar.set(sessionCookieName, createSessionToken(user.id, now, { sessionVersion: session.sessionVersion }), cookieOptions);
        jar.set(sessionAccessCookieName, createSessionToken(user.id, now, { sessionVersion: session.sessionVersion, accessId }), cookieOptions);
      }
    }
    return Response.json({ ok: true, ...(updateCommand ? { updateCommand } : {}) });
  } catch {
    return Response.json({ error: 'Journal unavailable' }, { status: 503 });
  }
}
