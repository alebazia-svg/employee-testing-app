import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, login: true, role: true },
  });

  return Response.json(users);
}

export async function POST(req: Request) {
  const { name, login, password, role } = await req.json();
  const user = await prisma.user.create({
    data: {
      name,
      login,
      passwordHash: await bcrypt.hash(password, 10),
      role,
    },
    select: { id: true, name: true, login: true, role: true },
  });

  return Response.json(user);
}
