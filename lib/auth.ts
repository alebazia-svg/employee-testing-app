import { cookies } from 'next/headers';
import { prisma } from './prisma';
export async function getCurrentUser() {
  const userId = cookies().get('userId')?.value;
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: Number(userId) } });
}
