import 'server-only';
import type { PrismaClient } from '@prisma/client';

export type TerminalFiscalEmployeeAction = 'open' | 'help' | 'not_mine' | 'undo_not_mine';

async function notifyAdmins(tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0], input: {
  reviewId: string; eventKey: string; title: string; body: string; now: Date;
}) {
  const event = await tx.adminInboxEvent.upsert({
    where: { eventKey: input.eventKey },
    update: { title: input.title, body: input.body, occurredAt: input.now },
    create: { eventKey: input.eventKey, type: 'terminal_fiscal_review.employee_action', title: input.title, body: input.body, href: `/admin/workday/payment-checks/${input.reviewId}`, sourceType: 'terminal_fiscal_review', sourceId: input.reviewId, occurredAt: input.now },
  });
  const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  if (admins.length) await tx.adminInboxReceipt.createMany({ data: admins.map((admin) => ({ eventId: event.id, userId: admin.id })), skipDuplicates: true });
}

export async function applyTerminalFiscalEmployeeAction(input: {
  prisma: PrismaClient; reviewId: string; userId: number; action: TerminalFiscalEmployeeAction; now?: Date;
}) {
  const now = input.now ?? new Date();
  return input.prisma.$transaction(async (tx) => {
    const review = await tx.terminalFiscalEmployeeReview.findFirst({
      where: { id: input.reviewId, status: 'open', OR: [{ employeeId: input.userId }, { participants: { some: { userId: input.userId } } }] },
      include: { participants: { include: { user: { select: { id: true, name: true } } } } },
    });
    if (!review) throw new Error('REVIEW_NOT_AVAILABLE');
    let participant = review.participants.find((item) => item.userId === input.userId);
    if (!participant) participant = await tx.terminalFiscalReviewParticipant.create({ data: { reviewId: review.id, userId: input.userId }, include: { user: { select: { id: true, name: true } } } });

    if (input.action === 'open') {
      const otherHandler = review.participants.find((item) => item.userId !== input.userId && item.response === 'pending' && item.handlingUntil && item.handlingUntil > now);
      if (!otherHandler) {
        const handlingUntil = new Date(now.getTime() + 15 * 60_000);
        await tx.terminalFiscalReviewParticipant.update({ where: { id: participant.id }, data: { openedAt: now, handlingUntil } });
        return { state: participant.response, handlerName: null, handlingUntil: handlingUntil.toISOString() };
      }
      return { state: participant.response, handlerName: otherHandler.user.name, handlingUntil: otherHandler.handlingUntil?.toISOString() ?? null };
    }

    if (input.action === 'help') {
      await tx.terminalFiscalReviewParticipant.update({ where: { id: participant.id }, data: { response: 'help', respondedAt: now, handlingUntil: null } });
      await notifyAdmins(tx, { reviewId: review.id, eventKey: `terminal_fiscal_review:help:${review.id}:${input.userId}`, title: 'Сотрудник не находит чек', body: `${participant.user.name} не находит чек по оплате ${(review.amountKopecks / 100).toLocaleString('ru-RU')} ₽.`, now });
      return { state: 'help', handlerName: null, handlingUntil: null };
    }

    if (input.action === 'not_mine') {
      await tx.terminalFiscalReviewParticipant.update({ where: { id: participant.id }, data: { response: 'not_mine', respondedAt: now, handlingUntil: null } });
      const colleagues = review.participants.filter((item) => item.userId !== input.userId && item.response !== 'not_mine');
      for (const colleague of colleagues) await tx.workdayNotification.upsert({
        where: { fingerprint: `terminal-fiscal-review:${review.id}:not-mine:${colleague.userId}` },
        update: { status: 'pending', pushStatus: 'pending', scheduledAt: now, readAt: null },
        create: { userId: colleague.userId, reviewId: review.id, fingerprint: `terminal-fiscal-review:${review.id}:not-mine:${colleague.userId}`, kind: 'terminal_fiscal_review_reassigned', title: 'Проверьте оплату', body: `Оплата отмечена как чужая сотрудником: ${participant.user.name}. Проверьте чек ${(review.amountKopecks / 100).toLocaleString('ru-RU')} ₽.`, scheduledAt: now },
      });
      if (!colleagues.length) await notifyAdmins(tx, { reviewId: review.id, eventKey: `terminal_fiscal_review:no-owner:${review.id}`, title: 'Сотрудники не определили чек', body: `По оплате ${(review.amountKopecks / 100).toLocaleString('ru-RU')} ₽ никто из смены не подтвердил ответственность.`, now });
      return { state: 'not_mine', handlerName: null, handlingUntil: null };
    }

    const handlingUntil = new Date(now.getTime() + 15 * 60_000);
    await tx.terminalFiscalReviewParticipant.update({ where: { id: participant.id }, data: { response: 'pending', respondedAt: null, openedAt: now, handlingUntil } });
    return { state: 'pending', handlerName: null, handlingUntil: handlingUntil.toISOString() };
  });
}
