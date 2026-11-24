import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { readSessionToken, sessionAccessId, sessionCookieName, sessionTokenFromCookies, sessionMatchesUser } from './session';

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = sessionTokenFromCookies(cookieStore);
  const session = readSessionToken(token);
  if (!token || !session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !sessionMatchesUser(session, user)) return null;
  if (user.role === 'EMPLOYEE') {
    const access = await prisma.portalAccessSession.findUnique({
      where: { sessionHash: sessionAccessId(token, session) },
      select: { loggedOutAt: true },
    });
    if (access?.loggedOutAt || (session.accessId && !access)) return null;
    const primary = cookieStore.get(sessionCookieName)?.value;
    if (primary && primary !== token) {
      const rollbackAccess = await prisma.portalAccessSession.findUnique({
        where: { sessionHash: sessionAccessId(primary, { ...session, accessId: undefined }) },
        select: { loggedOutAt: true },
      });
      if (rollbackAccess?.loggedOutAt) return null;
    }
  }
  return user;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function getCurrentAdmin() {
  const user = await getCurrentUser();
  return user?.role === 'ADMIN' ? user : null;
}

export function portalHomePath(user: { role: string; portalArea?: string | null }) {
  if (user.role === 'ADMIN') return '/admin';
  return user.portalArea === 'PROCUREMENT' ? '/procurement' : '/employee';
}
