import { cookies } from 'next/headers';
import { getCurrentAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { accessBrowserCookie } from '@/lib/portal-access-identity';

// List visibility only. Session validity, observations, names and push stay intact.
export async function POST(req: Request) {
  if (req.headers.get('sec-fetch-site') !== 'same-origin') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const raw = await req.text();
  let body;
  try { body = raw.length <= 512 ? JSON.parse(raw) : null; } catch { body = null; }
  if (!body || typeof body !== 'object' || Object.keys(body).some(k => !['sessionId', 'archived', 'lastSeenAt'].includes(k))
    || typeof body.sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.sessionId) || typeof body.archived !== 'boolean'
    || (body.archived && (typeof body.lastSeenAt !== 'string' || !Number.isFinite(Date.parse(body.lastSeenAt))))) return Response.json({ error: 'Invalid input' }, { status: 400 });
  try {
    const currentId = (await cookies()).get(accessBrowserCookie)?.value;
    const result = await prisma.$transaction(async tx => {
      const target = await tx.portalAccessSession.findUnique({ where: { id: body.sessionId }, select: { id: true, userId: true, browserInstanceId: true, isService: true, lastSeenAt: true, user: { select: { role: true } } } });
      if (!target) return { error: 'Подключение не найдено. Обновите список.', status: 404 };
      const scope = target.browserInstanceId ? { userId: target.userId, browserInstanceId: target.browserInstanceId } : { id: target.id, userId: target.userId };
      if (body.archived) {
        if (target.browserInstanceId && target.browserInstanceId === currentId) return { error: 'Текущее подключение нельзя убрать в историю.', status: 409 };
        const owner = target.browserInstanceId ? await tx.portalAccessBrowserOwner.findFirst({ where: { browserInstanceId: target.browserInstanceId, disabledAt: null, label: { not: null }, owner: { isActive: true, role: 'ADMIN' } }, select: { browserInstanceId: true } }) : null;
        if (owner) return { error: 'У подключения сохранено название. Ручное скрытие доступно только для неподтверждённых записей.', status: 409 };
        const administrative = target.user.role === 'ADMIN' || target.isService || Boolean(target.browserInstanceId && await tx.portalAccessSession.findFirst({ where: { browserInstanceId: target.browserInstanceId, user: { role: 'ADMIN' } }, select: { id: true } }));
        if (!administrative) return { error: 'Это не администраторское подключение.', status: 409 };
        const latest = await tx.portalAccessSession.findFirst({ where: scope, orderBy: { lastSeenAt: 'desc' }, select: { lastSeenAt: true } });
        if (!latest || latest.lastSeenAt.getTime() !== Date.parse(body.lastSeenAt)) return { error: 'Поступили новые сведения. Обновите список перед скрытием.', status: 409 };
      }
      await tx.portalAccessSession.updateMany({ where: scope, data: { listArchivedAt: body.archived ? new Date() : null } });
      return { ok: true };
    }, { isolationLevel: 'Serializable' });
    return 'error' in result ? Response.json({ error: result.error }, { status: result.status }) : Response.json(result);
  } catch { return Response.json({ error: 'Результат не подтверждён. Обновите список перед повтором.' }, { status: 503 }); }
}
