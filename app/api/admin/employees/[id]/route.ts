import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { name, login, password, role } = await req.json();
  const userId = Number(params.id);

  if (role !== 'ADMIN') {
    const current = await prisma.user.findUnique({ where: { id: userId } });
    if (current?.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return Response.json({ error: 'Нельзя убрать роль у последнего администратора' }, { status: 400 });
      }
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      login,
      role,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
    select: { id: true, name: true, login: true, role: true },
  });

  return Response.json(user);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const userId = Number(params.id);
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (user?.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) {
      return Response.json({ error: 'Нельзя удалить последнего администратора' }, { status: 400 });
    }
  }

  await prisma.user.delete({ where: { id: userId } });

  return Response.json({ ok: true });
}
