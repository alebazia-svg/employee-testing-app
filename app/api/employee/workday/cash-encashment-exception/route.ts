import { getCurrentUser } from '@/lib/auth';
import { cashEncashmentExceptionReasons, toCashEncashmentReasonCode, type CashEncashmentExceptionReason } from '@/lib/workday-cash-encashment-exception';
import { prisma } from '@/lib/prisma';
import { queueAdminInboxTelegramDelivery } from '@/lib/admin-inbox';

function normalizedComment(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'EMPLOYEE') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const payload = await req.json().catch(() => ({}));
  const reason = typeof payload.reason === 'string' ? payload.reason : '';
  const comment = normalizedComment(payload.comment);
  if (!(reason in cashEncashmentExceptionReasons)) return Response.json({ error: 'Выберите причину' }, { status: 400 });
  if (!comment) return Response.json({ error: 'Коротко укажите, где сейчас деньги' }, { status: 400 });
  if (comment.length > 1000) return Response.json({ error: 'Комментарий должен быть не длиннее 1000 символов' }, { status: 400 });

  const workDay = await prisma.workDayEntry.findFirst({
    where: { userId: user.id, status: { in: ['active', 'missing_checkout'] }, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  if (!workDay) return Response.json({ error: 'Нет активного рабочего дня' }, { status: 404 });

  const handover = await prisma.shiftControlTask.findFirst({
    where: { run: { workDayEntryId: workDay.id }, category: 'handover' },
    orderBy: { id: 'desc' },
  });
  const handoverData = handover?.handoverData;
  const personalCash = handoverData && typeof handoverData === 'object' && !Array.isArray(handoverData)
    ? (handoverData as Record<string, unknown>).personalCash
    : null;
  const balance = personalCash && typeof personalCash === 'object' && !Array.isArray(personalCash)
    ? Number((personalCash as Record<string, unknown>).cashBalance)
    : NaN;
  if (!Number.isFinite(balance) || balance <= 50_000) return Response.json({ error: 'Сначала внесите фактический остаток наличных свыше 50 000 ₽' }, { status: 409 });

  const reasonCode = toCashEncashmentReasonCode(reason as CashEncashmentExceptionReason);
  const pending = await prisma.workdayCloseExceptionRequest.findFirst({
    where: { workDayEntryId: workDay.id, status: 'pending', reasonCode: { startsWith: 'cash_encashment_' } },
    orderBy: { requestedAt: 'desc' },
  });
  if (pending) return Response.json({ request: pending, created: false });

  const now = new Date();
  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.workdayCloseExceptionRequest.create({
      data: { workDayEntryId: workDay.id, employeeId: user.id, reasonCode, comment, issueIds: [], requestedAt: now },
    });
    const event = await tx.adminInboxEvent.create({
      data: {
        eventKey: `cash-encashment-exception:${created.id}:requested`,
        type: 'workday.cash_encashment_exception_requested',
        title: 'Инкассация не выполнена',
        body: `${user.name}: остаток наличных ${balance.toLocaleString('ru-RU')} ₽. Требуется решение администратора.`,
        href: `/admin/workday/close-exceptions/${created.id}`,
        sourceType: 'workday_close_exception',
        sourceId: created.id,
        occurredAt: now,
      },
    });
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    if (admins.length) await tx.adminInboxReceipt.createMany({ data: admins.map((admin) => ({ eventId: event.id, userId: admin.id })), skipDuplicates: true });
    await queueAdminInboxTelegramDelivery({ db: tx, eventId: event.id });
    return created;
  });
  return Response.json({ request, created: true });
}
