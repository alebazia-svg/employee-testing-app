import 'server-only';

import type { PrismaClient } from '@prisma/client';
import { queueAdminInboxTelegramDelivery } from '@/lib/admin-inbox';

export function normalizeTerminalFiscalReviewMessage(value: unknown) {
  const body = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!body) return { ok: false as const, error: 'Напишите короткое сообщение.' };
  if (body.length > 1000) return { ok: false as const, error: 'Сообщение должно быть не длиннее 1000 символов.' };
  return { ok: true as const, body };
}

function short(value: string, max = 180) {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

export async function addEmployeeTerminalFiscalReviewMessage(input: {
  prisma: PrismaClient;
  reviewId: string;
  employeeId: number;
  body: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return input.prisma.$transaction(async (tx) => {
    const review = await tx.terminalFiscalEmployeeReview.findFirst({
      where: { id: input.reviewId, employeeId: input.employeeId, status: 'open' },
      include: { employee: { select: { name: true } } },
    });
    if (!review) throw new Error('REVIEW_NOT_AVAILABLE');
    const message = await tx.terminalFiscalReviewMessage.create({
      data: { reviewId: review.id, authorId: input.employeeId, body: input.body, createdAt: now },
    });
    const event = await tx.adminInboxEvent.create({
      data: {
        eventKey: `terminal_fiscal_review:employee_message:${message.id}`,
        type: 'terminal_fiscal_review.employee_message',
        title: 'Сообщение по проверке продажи',
        body: `${review.employee.name}: ${short(input.body)}`,
        href: `/admin/workday/payment-checks/${review.id}`,
        sourceType: 'terminal_fiscal_review',
        sourceId: review.id,
        occurredAt: now,
      },
    });
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    if (admins.length) await tx.adminInboxReceipt.createMany({
      data: admins.map((admin) => ({ eventId: event.id, userId: admin.id })),
      skipDuplicates: true,
    });
    await queueAdminInboxTelegramDelivery({ db: tx, eventId: event.id });
    return { messageId: message.id, inboxEventId: event.id };
  });
}

export async function addAdminTerminalFiscalReviewMessage(input: {
  prisma: PrismaClient;
  reviewId: string;
  adminId: number;
  body: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return input.prisma.$transaction(async (tx) => {
    const review = await tx.terminalFiscalEmployeeReview.findFirst({
      where: { id: input.reviewId, status: 'open' },
      select: { id: true, employeeId: true },
    });
    if (!review) throw new Error('REVIEW_NOT_AVAILABLE');
    const message = await tx.terminalFiscalReviewMessage.create({
      data: { reviewId: review.id, authorId: input.adminId, body: input.body, createdAt: now },
    });
    await tx.workdayNotification.create({
      data: {
        userId: review.employeeId,
        reviewId: review.id,
        fingerprint: `terminal-fiscal-review:${review.id}:admin-message:${message.id}`,
        kind: 'terminal_fiscal_review_reply',
        title: 'Ответ администратора',
        body: short(input.body),
        scheduledAt: now,
      },
    });
    return { messageId: message.id };
  });
}
