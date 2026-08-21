import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isCashEncashmentException } from '@/lib/workday-cash-encashment-exception';
import { resolveCloseExceptionNotifications } from '@/lib/workday-notifications';

const decisions = new Set(['approved', 'rejected']);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const payload = await req.json().catch(() => ({}));
  const status = typeof payload.status === 'string' ? payload.status : '';
  const decisionComment = String(payload.decisionComment ?? '').replace(/\s+/g, ' ').trim();
  if (!decisions.has(status)) return Response.json({ error: 'Выберите решение' }, { status: 400 });
  if (status === 'rejected' && !decisionComment) return Response.json({ error: 'Коротко укажите причину отказа' }, { status: 400 });
  if (decisionComment.length > 1000) return Response.json({ error: 'Комментарий должен быть не длиннее 1000 символов' }, { status: 400 });

  const existing = await prisma.workdayCloseExceptionRequest.findUnique({ where: { id: params.id } });
  if (!existing) return Response.json({ error: 'Запрос не найден' }, { status: 404 });
  if (existing.status !== 'pending') return Response.json({ request: existing, changed: false });
  const cashEncashmentException = isCashEncashmentException(existing.reasonCode);

  const now = new Date();
  const request = await prisma.$transaction(async (tx) => {
    await resolveCloseExceptionNotifications(tx, {
      workDayEntryId: existing.workDayEntryId,
      now,
      scope: cashEncashmentException ? 'cash_encashment' : 'required_issues',
    });
    const updated = await tx.workdayCloseExceptionRequest.update({
      where: { id: existing.id },
      data: { status, decisionComment, decidedAt: now, decidedById: admin.id },
    });
    await tx.workdayNotification.create({
      data: {
        userId: existing.employeeId,
        fingerprint: `workday-close-exception:${existing.id}:${status}`,
        kind: 'workday_close_exception_decision',
        title: status === 'approved'
          ? cashEncashmentException ? 'Можно завершить день без инкассации' : 'Можно завершить рабочий день'
          : 'Запрос не согласован',
        body: status === 'approved'
          ? cashEncashmentException
            ? 'Администратор разрешил завершить день без инкассации. РКО и ПКО не будут созданы; ситуация останется под контролем.'
            : 'Администратор разрешил завершить день. Неисправленная проблема останется под контролем.'
          : decisionComment,
        scheduledAt: now,
      },
    });
    return updated;
  });
  return Response.json({ request, changed: true });
}
