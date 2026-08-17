import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashWorkstationToken, WORKSTATION_COOKIE_NAME } from '@/lib/workstation-context';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await req.json().catch(() => ({}));
  const token = typeof payload.token === 'string' ? payload.token.trim() : '';
  if (!token) return Response.json({ error: 'Код рабочего места не указан' }, { status: 400 });
  const binding = await prisma.workstationDeviceBinding.findUnique({
    where: { tokenHash: hashWorkstationToken(token) },
    include: { workstation: { select: { code: true, label: true, isActive: true } } },
  });
  if (!binding?.isActive || binding.revokedAt || !binding.workstation.isActive) {
    return Response.json({ error: 'Код рабочего места недействителен' }, { status: 404 });
  }
  cookies().set(WORKSTATION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return Response.json({ ok: true, workstation: binding.workstation });
}
