import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { createSessionToken, sessionCookieName, sessionMaxAgeSeconds } from '@/lib/session';
import { clearLoginFailures, loginAllowed, recordLoginFailure } from '@/lib/login-rate-limit';
import { recordPortalAccess } from '@/lib/portal-access-journal';

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
  try { await recordPortalAccess({ userId: user.id, token, userAgent: req.headers.get('user-agent') ?? '', login: true }); }
  catch { console.warn('PORTAL_ACCESS_JOURNAL_UNAVAILABLE'); }
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
