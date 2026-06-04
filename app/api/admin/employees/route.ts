import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, login: true, role: true, department: true, isActive: true, payrollName: true },
  });

  return Response.json(users);
}

export async function POST(req: Request) {
  const { name, login, password, role, department, isActive, payrollName } = await req.json();
  if (!name?.trim() || !login?.trim() || !password?.trim()) {
    return Response.json({ error: 'Заполните имя, логин и пароль' }, { status: 400 });
  }

  try {
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        login: login.trim(),
        passwordHash: await bcrypt.hash(password, 10),
        role: role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE',
        department: typeof department === 'string' ? department : 'retail',
        isActive: typeof isActive === 'boolean' ? isActive : true,
        payrollName: typeof payrollName === 'string' && payrollName.trim() ? payrollName.trim() : null,
      },
      select: { id: true, name: true, login: true, role: true, department: true, isActive: true, payrollName: true },
    });

    return Response.json(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return Response.json({ error: 'Пользователь с таким логином уже существует' }, { status: 409 });
    }
    throw error;
  }
}
