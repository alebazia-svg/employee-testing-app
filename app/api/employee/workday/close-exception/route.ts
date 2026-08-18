import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findOpenRequiredWorkdayIssues, readIssueIds, sameIssueIds } from '@/lib/workday-required-issues';

const allowedReasons = new Set(['power', 'internet', 'one_c', 'kkm', 'other']);

function normalizeComment(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'EMPLOYEE') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const payload = await req.json().catch(() => ({}));
  const reasonCode = typeof payload.reasonCode === 'string' ? payload.reasonCode : '';
  const comment = normalizeComment(payload.comment);
  if (!allowedReasons.has(reasonCode)) return Response.json({ error: 'Выберите техническую причину' }, { status: 400 });
  if (!comment) return Response.json({ error: 'Коротко опишите, почему исправить сейчас невозможно' }, { status: 400 });
  if (comment.length > 1000) return Response.json({ error: 'Комментарий должен быть не длиннее 1000 символов' }, { status: 400 });

  const workDay = await prisma.workDayEntry.findFirst({
    where: { userId: user.id, status: { in: ['active', 'missing_checkout'] }, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  if (!workDay) return Response.json({ error: 'Нет активного рабочего дня' }, { status: 404 });

  const issues = await findOpenRequiredWorkdayIssues(prisma, user.id);
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
    const request = await tx.workdayCloseExceptionRequest.create({
      data: { workDayEntryId: workDay.id, employeeId: user.id, reasonCode, comment, issueIds, requestedAt: now },
    });
    const event = await tx.adminInboxEvent.create({
      data: {
        eventKey: `workday_close_exception:${request.id}:requested`,
        type: 'workday.close_exception_requested',
        title: 'Запрос на завершение дня',
        body: `${user.name}: техническая причина · незакрытых ошибок: ${issueIds.length}.`,
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
    return request;
  });

  return Response.json({ request: result, created: true });
}
