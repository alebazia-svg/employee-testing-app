import 'server-only';

import type { PrismaClient } from '@prisma/client';
import { queueAdminInboxTelegramDelivery } from '@/lib/admin-inbox';

export function normalizeWorkdayIssueMessage(value: unknown) {
  const body = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!body) return { ok: false as const, error: 'Напишите короткое сообщение.' };
  if (body.length > 1000) return { ok: false as const, error: 'Сообщение должно быть не длиннее 1000 символов.' };
  return { ok: true as const, body };
}

function short(value: string, max = 180) {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

export async function addEmployeeWorkdayIssueMessage(input: {
  prisma: PrismaClient;
  issueId: number;
  employeeId: number;
  body: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return input.prisma.$transaction(async (tx) => {
    const issue = await tx.workdayControlIssue.findFirst({
      where: { id: input.issueId, userId: input.employeeId, status: 'open', employeeActionRequired: true },
      include: { user: { select: { name: true } } },
    });
    if (!issue) throw new Error('ISSUE_NOT_AVAILABLE');
    const message = await tx.workdayControlIssueMessage.create({
      data: { issueId: issue.id, authorId: input.employeeId, body: input.body, createdAt: now },
    });
    const event = await tx.adminInboxEvent.create({
      data: {
        eventKey: `workday_issue:employee_message:${message.id}`,
        type: 'workday_issue.employee_message',
        title: 'Сообщение по обязательной ошибке',
        body: `${issue.user.name}: ${short(input.body)}`,
        href: `/admin/workday/issues/${issue.id}`,
        sourceType: 'workday_control_issue',
        sourceId: String(issue.id),
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

export async function addAdminWorkdayIssueMessage(input: {
  prisma: PrismaClient;
  issueId: number;
  adminId: number;
  body: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return input.prisma.$transaction(async (tx) => {
    const issue = await tx.workdayControlIssue.findFirst({ where: { id: input.issueId, status: 'open' } });
    if (!issue) throw new Error('ISSUE_NOT_AVAILABLE');
    const message = await tx.workdayControlIssueMessage.create({
      data: { issueId: issue.id, authorId: input.adminId, body: input.body, createdAt: now },
    });
    await tx.workdayNotification.create({
      data: {
        userId: issue.userId,
        issueId: issue.id,
        fingerprint: `workday-issue:${issue.id}:admin-message:${message.id}`,
        kind: 'workday_issue_reply',
        title: 'Ответ администратора',
        body: short(input.body),
        scheduledAt: now,
      },
    });
    return { messageId: message.id };
  });
}
