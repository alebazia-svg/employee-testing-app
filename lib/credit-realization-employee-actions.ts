import 'server-only';

import type { PrismaClient } from '@prisma/client';

export type CreditRealizationEmployeeAction = 'not_found' | 'not_mine';

const actionCopy = {
  not_found: {
    title: 'Сотрудник не находит документ кредитной продажи',
    body: (name: string, document: string) => `${name} не находит документ для чека по реализации ${document}.`,
  },
  not_mine: {
    title: 'Нужно проверить ответственного в реализации',
    body: (name: string, document: string) => `${name} сообщил(а), что реализация ${document} относится к другому сотруднику.`,
  },
} as const;

export async function applyCreditRealizationEmployeeAction(input: {
  prisma: PrismaClient;
  issueId: number;
  userId: number;
  action: CreditRealizationEmployeeAction;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return input.prisma.$transaction(async (tx) => {
    const issue = await tx.workdayControlIssue.findFirst({
      where: { id: input.issueId, userId: input.userId, ruleKey: 'credit_realization_mismatch', status: 'open', employeeActionRequired: true },
      include: { user: { select: { name: true } } },
    });
    if (!issue) throw new Error('ISSUE_NOT_AVAILABLE');
    const source = issue.sourceData && typeof issue.sourceData === 'object' && !Array.isArray(issue.sourceData) ? issue.sourceData as Record<string, unknown> : {};
    const documentNumber = String(source.documentNumber || '').trim() || 'без номера';
    const paymentDocumentNumber = String(source.paymentDocumentNumber || '').trim();
    const reasonCode = String(source.reasonCode || '');
    const missingDocument = reasonCode === 'REQUIRED_CASH_RECEIPT_FISCAL_RECEIPT_MISSING'
      ? `ПКО ${paymentDocumentNumber || 'по реализации'}`
      : reasonCode === 'REQUIRED_ACQUIRING_FISCAL_RECEIPT_MISSING'
        ? `эквайринговую операцию ${paymentDocumentNumber || 'по реализации'}`
        : `реализацию ${documentNumber}`;
    const copy = actionCopy[input.action];
    const event = await tx.adminInboxEvent.upsert({
      where: { eventKey: `credit_issue:${issue.id}:${input.action}:${input.userId}` },
      update: { title: copy.title, body: input.action === 'not_found' ? `${issue.user.name} не находит ${missingDocument}.` : copy.body(issue.user.name, documentNumber), occurredAt: now },
      create: {
        eventKey: `credit_issue:${issue.id}:${input.action}:${input.userId}`,
        type: 'workday_issue.employee_action',
        title: copy.title,
        body: input.action === 'not_found' ? `${issue.user.name} не находит ${missingDocument}.` : copy.body(issue.user.name, documentNumber),
        href: `/admin/workday/issues/${issue.id}`,
        sourceType: 'workday_control_issue',
        sourceId: String(issue.id),
        occurredAt: now,
      },
    });
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    if (admins.length) await tx.adminInboxReceipt.createMany({ data: admins.map((admin) => ({ eventId: event.id, userId: admin.id })), skipDuplicates: true });
    return { state: input.action };
  });
}
