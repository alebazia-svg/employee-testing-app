import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { passwordRequestAllowed } from '@/lib/password-access';
import { accessSessionIdentity, recordPortalAccess } from '@/lib/portal-access-journal';
import { sessionCookieName } from '@/lib/session';
import { supportsScheduleNearReminders } from '@/lib/schedule-near-reminder';
import { loadScheduleNearReminders } from '@/lib/work-schedule-notifications';
import { getMoscowDateKey } from '@/lib/workday';
import { validWorkHelpAcknowledgement, WORK_HELP_ACK_KIND, WORK_HELP_VERSION, workHelpAckKey, workHelpSnapshot } from '@/lib/employee-work-help';

const headers = { 'Cache-Control': 'no-store' };
async function employee() {
  const user = await getCurrentUser();
  return user?.role === 'EMPLOYEE' && user.isActive && supportsScheduleNearReminders(user.department) ? user : null;
}
export async function GET() {
  const user = await employee();
  if (!user) return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  try {
    const now = new Date(), today = getMoscowDateKey(now);
    const [states, ack] = await Promise.all([
      loadScheduleNearReminders(prisma, [user.id], today),
      prisma.portalActivityEvent.findUnique({ where: { userId_eventKey: { userId: user.id, eventKey: workHelpAckKey(today) } }, select: { createdAt: true } }),
    ]);
    return Response.json(workHelpSnapshot(states.get(user.id)!, ack?.createdAt ?? null, now), { headers });
  } catch { return Response.json({ error: 'Не удалось проверить график.' }, { status: 503, headers }); }
}
export async function POST(req: Request) {
  if (!passwordRequestAllowed(req)) return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  const user = await employee();
  if (!user) return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  const body = await req.text();
  if (body.length > 256) return Response.json({ error: 'Invalid request' }, { status: 413, headers });
  let input: unknown; try { input = JSON.parse(body); } catch { return Response.json({ error: 'Invalid request' }, { status: 400, headers }); }
  if (!validWorkHelpAcknowledgement(input)) return Response.json({ error: 'Обновите справку.' }, { status: 400, headers });
  const now = new Date(), today = getMoscowDateKey(now);
  const token = (await cookies()).get(sessionCookieName)?.value;
  const identity = accessSessionIdentity(token, user.id, now);
  if (!identity) return Response.json({ error: 'Войдите в приложение заново.' }, { status: 401, headers });
  try {
    // Reuse the authenticated access journal. This is an explicit UI acknowledgement,
    // independent of best-effort activity telemetry and notification read status.
    await recordPortalAccess({ userId: user.id, token, userAgent: req.headers.get('user-agent') ?? '', now });
    const session = await prisma.portalAccessSession.findUnique({ where: { sessionHash: identity.sessionHash } });
    if (!session || session.userId !== user.id || session.isService || session.loggedOutAt || session.expiresAt <= now) throw Error();
    const states = await loadScheduleNearReminders(prisma, [user.id], today);
    const ack = await prisma.portalActivityEvent.upsert({
      where: { userId_eventKey: { userId: user.id, eventKey: workHelpAckKey(today) } }, update: {},
      create: { userId: user.id, sessionId: session.id, eventKey: workHelpAckKey(today), section: 'schedule', kind: WORK_HELP_ACK_KIND, createdAt: now,
        context: { version: WORK_HELP_VERSION, button: 'understood', missingDates: states.get(user.id)!.missing } },
    });
    return Response.json({ ...workHelpSnapshot(states.get(user.id)!, ack.createdAt, now), recorded: true }, { headers });
  } catch { return Response.json({ error: 'Не удалось сохранить подтверждение. Попробуйте ещё раз.' }, { status: 503, headers }); }
}
