import { requireAdminApi } from '@/lib/admin-api-auth';
import { prisma } from '@/lib/prisma';
import { activityDayBounds, ACTIVITY_RETENTION_DAYS } from '@/lib/employee-activity-policy';
import { employeeActivityReport } from '@/lib/employee-activity-report';
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;
  const id = Number((await context.params).id);
  const date = new URL(req.url).searchParams.get('date') || '';
  const bounds = activityDayBounds(date), now = new Date();
  if (!Number.isSafeInteger(id) || id <= 0 || !bounds || bounds.start > now || +bounds.end < +now - ACTIVITY_RETENTION_DAYS * 86400000) return Response.json({ error: 'Выберите дату за последние 90 дней.' }, { status: 400 });
  if (!await prisma.user.findFirst({ where: { id, role: 'EMPLOYEE' }, select: { id: true } })) return new Response(null, { status: 404 });
  try { return Response.json(await employeeActivityReport(id, date, now), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch { return Response.json({ error: 'История временно недоступна. Рабочие данные сотрудника не изменены.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
