import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  const { login, password } = await req.json();
  const user = await prisma.user.findUnique({ where: { login } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return Response.json({ error: 'Неверный логин или пароль' }, { status: 401 });
  }

  cookies().set('userId', String(user.id), { path: '/' });

  return Response.json({ role: user.role });
}
