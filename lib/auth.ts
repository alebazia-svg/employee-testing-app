import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { readSessionToken, sessionCookieName } from './session';

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(sessionCookieName)?.value);
  if (!session) return null;
  return prisma.user.findFirst({ where: { id: session.userId, isActive: true } });
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
