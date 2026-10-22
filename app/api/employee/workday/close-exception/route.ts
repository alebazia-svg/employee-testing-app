import { validateWorkdayCloseRequest } from '@/lib/workday-close-request';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findOpenRequiredWorkdayIssues, readIssueIds, sameIssueIds } from '@/lib/workday-required-issues';
import { queueAdminInboxTelegramDelivery } from '@/lib/admin-inbox';
import { resolveCloseExceptionNotifications } from '@/lib/workday-notifications';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'EMPLOYEE') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const payload = await req.json().catch(() => ({}));
  const validation = validateWorkdayCloseRequest(payload.reasonCode, payload.comment);
  if (!validation.ok) return Response.json({ error: validation.error }, { status: 400 });
  const { reasonCode, comment } = validation;

  const workDay = await prisma.workDayEntry.findFirst({
    where: { userId: user.id, status: { in: ['active', 'missing_checkout'] }, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  if (!workDay) return Response.json({ error: 'Нет активного рабочего дня' }, { status: 404 });

  const issues = await findOpenRequiredWorkdayIssues(prisma, user.id, workDay.date);
  const issueIds = issues.map((issue) => issue.id).sort((a, b) => a - b);
  if (!issueIds.length) return Response.json({ error: 'Обязательных неисправленных ошибок уже нет' }, { status: 409 });

  const pending = await prisma.workdayCloseExceptionRequest.findMany({
    where: { workDayEntryId: workDay.id, status: 'pending' },
    orderBy: { requestedAt: 'desc' },
    take: 10,
  });
  const existing = pending.find((request) => sameIssueIds(readIssueIds(request.issueIds), issueIds));
  if (existing) return Response.json({ request: existing, created: false });

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    await resolveCloseExceptionNotifications(tx, { workDayEntryId: workDay.id, now, scope: 'required_issues' });
    const request = await tx.workdayCloseExceptionRequest.create({
      data: { workDayEntryId: workDay.id, employeeId: user.id, reasonCode, comment, issueIds, requestedAt: now },
    });
    const event = await tx.adminInboxEvent.create({
      data: {
        eventKey: `workday_close_exception:${request.id}:requested`,
        type: 'workday.close_exception_requested',
        title: `${user.name} · завершение смены`,
        body: `${({power:'Нет света',internet:'Нет интернета',one_c:'Не работает 1С',kkm:'Не работает касса',other:'Другая техническая причина'} as Record<string,string>)[reasonCode]} · неисправленных ошибок: ${issueIds.length}.`,
        href: `/admin/workday/close-exceptions/${request.id}`,
        sourceType: 'workday_close_exception',
        sourceId: request.id,
        occurredAt: now,
      },
    });
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    if (admins.length) await tx.adminInboxReceipt.createMany({
      data: admins.map((admin) => ({ eventId: event.id, userId: admin.id })),
      skipDuplicates: true,
    });
    await queueAdminInboxTelegramDelivery({ db: tx, eventId: event.id });
    return request;
  });

  return Response.json({ request: result, created: true });
}
