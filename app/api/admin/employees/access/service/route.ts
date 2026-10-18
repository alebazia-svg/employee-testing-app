import { getCurrentAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Classification changes neither authorization nor notification subscriptions.
export async function POST(req: Request) {
  if (req.headers.get('sec-fetch-site') !== 'same-origin') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const raw = await req.text();
  let body;
  try { body = raw.length <= 256 ? JSON.parse(raw) : null; } catch { body = null; }
  if (!body || typeof body !== 'object' || Object.keys(body).sort().join(',') !== 'isService,sessionId' || typeof body.isService !== 'boolean' || typeof body.sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.sessionId)) return Response.json({ error: 'Invalid input' }, { status: 400 });
  try {
    const target = await prisma.portalAccessSession.findUnique({ where: { id: body.sessionId }, select: { id: true, userId: true, browserInstanceId: true } });
    if (!target) return Response.json({ error: 'Подключение не найдено.' }, { status: 404 });
    await prisma.portalAccessSession.updateMany({
      where: target.browserInstanceId ? { userId: target.userId, browserInstanceId: target.browserInstanceId } : { id: target.id, userId: target.userId },
      data: { isService: body.isService, serviceMarkedAt: new Date(), serviceMarkedBy: admin.id },
    });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: 'Не удалось сохранить отметку. Обновите список перед повтором.' }, { status: 503 }); }
}
