import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { claimWorkstationDevice, resolveWorkstationContext, WORKSTATION_COOKIE_NAME } from '@/lib/workstation-context';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const context = await resolveWorkstationContext(prisma, { token: cookies().get(WORKSTATION_COOKIE_NAME)?.value });
  return Response.json(context.status === 'resolved'
    ? { bound: true, workstation: { code: context.workstation.code, label: context.workstation.label } }
    : { bound: false });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await req.json().catch(() => ({}));
  const code = typeof payload.code === 'string' ? payload.code.trim() : '';
  if (!code) return Response.json({ error: 'Код рабочего места не указан' }, { status: 400 });
  const binding = await claimWorkstationDevice(prisma, { code });
  if (binding.status !== 'bound') {
    return Response.json({ error: 'Код рабочего места недействителен' }, { status: 404 });
  }
  cookies().set(WORKSTATION_COOKIE_NAME, binding.deviceToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return Response.json({ ok: true, workstation: binding.workstation });
}
