import { getCurrentAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { connectionMismatch } from '@/lib/portal-device-observation';

export async function POST(req: Request) {
  if (req.headers.get('sec-fetch-site') !== 'same-origin') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const raw = await req.text();
  let body;
  try { body = raw.length <= 1024 ? JSON.parse(raw) : null; } catch { body = null; }
  if (!body || typeof body !== 'object' || Object.keys(body).some(k => !['owned', 'sessionId', 'label', 'linkSessionId'].includes(k)) || typeof body.owned !== 'boolean' || typeof body.sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.sessionId) || (body.linkSessionId !== undefined && (!body.owned || typeof body.linkSessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.linkSessionId))) || (body.label !== undefined && (typeof body.label !== 'string' || body.label.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(body.label)))) return Response.json({ error: 'Invalid input' }, { status: 400 });
  if (body.owned && !body.label?.trim()) return Response.json({ error: 'Укажите название с именем владельца.' }, { status: 400 });
  try {
    // ADMIN may classify a known connection first observed under an employee.
    // Identity is resolved from the record, never a caller-supplied browser/user.
    // ownerUserId is the responsible administrator, not inferred human ownership.
    const target = await prisma.portalAccessSession.findFirst({ where: { id: body.sessionId, user: { isActive: true } }, select: { browserInstanceId: true, observedBrowserId: true } });
    if (!target) return Response.json({ error: 'Подключение не найдено. Обновите список.' }, { status: 404 });
    if (!target.browserInstanceId) return Response.json({ error: 'У старой записи нет идентификатора. Откройте обновлённый портал в этом браузере под любым доступным кабинетом и дождитесь новой записи.' }, { status: 409 });
    if (connectionMismatch(target.browserInstanceId, target.observedBrowserId)) return Response.json({ error: 'Коды сеанса и последнего подключения различаются. Сначала выполните сверку; назначение не изменено.' }, { status: 409 });
    const browserInstanceId = target.browserInstanceId;
    if (body.linkSessionId) {
      const result = await prisma.$transaction(async tx => {
        const linkedSession = await tx.portalAccessSession.findFirst({ where: { id: body.linkSessionId, user: { isActive: true } }, select: { browserInstanceId: true, observedBrowserId: true } });
        if (!linkedSession?.browserInstanceId || linkedSession.browserInstanceId === browserInstanceId || connectionMismatch(linkedSession.browserInstanceId, linkedSession.observedBrowserId)) return false;
        const linked = await tx.portalAccessBrowserOwner.findUnique({ where: { browserInstanceId: linkedSession.browserInstanceId } });
        const own = await tx.portalAccessBrowserOwner.findUnique({ where: { browserInstanceId } });
        if (!linked || linked.disabledAt || linked.ownerUserId !== admin.id || !linked.label || own && own.ownerUserId !== admin.id) return false;
        // Moving an already grouped connection is explicit and only moves that
        // browser. Other connections, history, auth and push remain untouched.
        const deviceGroupId = linked.deviceGroupId ?? linked.browserInstanceId;
        await tx.portalAccessBrowserOwner.update({ where: { browserInstanceId: linked.browserInstanceId }, data: { deviceGroupId } });
        await tx.portalAccessBrowserOwner.upsert({ where: { browserInstanceId }, create: { browserInstanceId, ownerUserId: admin.id, label: linked.label, deviceGroupId }, update: { label: linked.label, deviceGroupId, disabledAt: null, markedAt: new Date() } });
        return true;
      }, { isolationLevel: 'Serializable' });
      return result ? Response.json({ ok: true }) : Response.json({ error: 'Не удалось подтвердить оба подключения. Обновите список; объединение не выполнено.' }, { status: 409 });
    }
    if (body.owned) await prisma.portalAccessBrowserOwner.createMany({ skipDuplicates: true, data: [{ browserInstanceId, ownerUserId: admin.id }] });
    // Naming separately detaches only this browser from any manually linked group.
    const result = await prisma.portalAccessBrowserOwner.updateMany({ where: { browserInstanceId, ownerUserId: admin.id }, data: { deviceGroupId: null, markedAt: new Date(), disabledAt: body.owned ? null : new Date(), ...(body.label !== undefined ? { label: body.label.trim() || null } : {}) } });
    if (!result.count) return Response.json({ error: 'Не удалось изменить принадлежность браузера. Обновите список.' }, { status: 409 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: 'Сохранение не подтверждено. Обновите список перед повтором.' }, { status: 503 }); }
}
