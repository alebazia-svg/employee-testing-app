import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { createSessionToken, sessionCookieName, sessionMaxAgeSeconds } from '@/lib/session';
import { clearLoginFailures, loginAllowed, recordLoginFailure } from '@/lib/login-rate-limit';
import { recordPortalAccess } from '@/lib/portal-access-journal';
import { randomUUID } from 'node:crypto';
import { accessBrowserCookie, validAccessBrowserId } from '@/lib/portal-access-identity';
import { accessClientIp } from '@/lib/portal-access-network';

export async function POST(req: Request) {
  const { login, password } = await req.json();
  if (!loginAllowed(req, login)) {
    return Response.json({ error: 'Слишком много попыток входа. Подождите 15 минут.' }, { status: 429 });
  }
  const user = await prisma.user.findUnique({ where: { login } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    recordLoginFailure(req, login);
    return Response.json({ error: 'Неверный логин или пароль' }, { status: 401 });
  }

  if (!user.isActive) {
    recordLoginFailure(req, login);
    return Response.json({ error: 'Пользователь отключён' }, { status: 403 });
  }

  clearLoginFailures(req, login);

  const cookieStore = await cookies();
  const token = createSessionToken(user.id);
  const previousBrowser = cookieStore.get(accessBrowserCookie)?.value;
  const browserInstanceId = validAccessBrowserId(previousBrowser) ? previousBrowser : randomUUID();
  try { await recordPortalAccess({ userId: user.id, token, browserInstanceId, origin: req.url, clientIp: accessClientIp(req.headers), userAgent: req.headers.get('user-agent') ?? '', login: true }); }
  catch { console.warn('PORTAL_ACCESS_JOURNAL_UNAVAILABLE'); }
  cookieStore.set(accessBrowserCookie, browserInstanceId, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 31536000 });
  cookieStore.set(sessionCookieName, token, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: sessionMaxAgeSeconds,
  });
  cookieStore.delete('userId');

  return Response.json({ role: user.role, portalArea: user.portalArea });
}
