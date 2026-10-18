import { getCurrentAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  if (req.headers.get('sec-fetch-site') !== 'same-origin') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const raw = await req.text();
  let body;
  try { body = raw.length <= 256 ? JSON.parse(raw) : null; } catch { body = null; }
  if (!body || typeof body !== 'object' || Object.keys(body).sort().join(',') !== 'owned,sessionId' || typeof body.owned !== 'boolean' || typeof body.sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.sessionId)) return Response.json({ error: 'Invalid input' }, { status: 400 });
  try {
    // Only a connection observed under this administrator's own account can be
    // labelled theirs. Employee sessions and caller-supplied identities are rejected.
    const target = await prisma.portalAccessSession.findFirst({ where: { id: body.sessionId, userId: admin.id }, select: { browserInstanceId: true } });
    if (!target) return Response.json({ error: 'Выберите подключение своего кабинета администратора.' }, { status: 404 });
    if (!target.browserInstanceId) return Response.json({ error: 'Браузер ещё не определён. Откройте обновлённый портал на этом устройстве под своим администратором.' }, { status: 409 });
    const browserInstanceId = target.browserInstanceId;
    if (body.owned) await prisma.portalAccessBrowserOwner.createMany({ skipDuplicates: true, data: [{ browserInstanceId, ownerUserId: admin.id }] });
    const result = await prisma.portalAccessBrowserOwner.updateMany({ where: { browserInstanceId, ownerUserId: admin.id }, data: { markedAt: new Date(), disabledAt: body.owned ? null : new Date() } });
    if (!result.count) return Response.json({ error: 'Не удалось изменить принадлежность браузера. Обновите список.' }, { status: 409 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: 'Сохранение не подтверждено. Обновите список перед повтором.' }, { status: 503 }); }
}
