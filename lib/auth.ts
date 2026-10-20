import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { readSessionToken, sessionCookieName, sessionMatchesUser } from './session';

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(sessionCookieName)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  return user && sessionMatchesUser(session, user) ? user : null;
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
