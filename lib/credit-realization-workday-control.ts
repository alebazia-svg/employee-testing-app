import 'server-only';

import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

export const CREDIT_REALIZATION_EMPLOYEE_CUTOVER = new Date('2026-08-18T00:00:00+03:00');

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function creditRealizationIssueFingerprint(realizationRef: string) {
  return `credit-realization:${digest(realizationRef)}`;
}

export function creditRealizationReminderFingerprint(realizationRef: string) {
  return `credit-realization-reminder:${digest(realizationRef)}`;
}

export function creditRealizationIssueAction(value: {
  status: string;
  employeeActionCandidate: boolean;
  realizationAt: Date;
  completeMismatchReads: number;
}, now = new Date()) {
  if (value.realizationAt < CREDIT_REALIZATION_EMPLOYEE_CUTOVER) return 'none' as const;
  if (value.status === 'mismatch' && value.employeeActionCandidate) {
    const ageMinutes = (now.getTime() - value.realizationAt.getTime()) / 60_000;
    if (ageMinutes < 15) return 'none' as const;
    return 'open' as const;
  }
  return 'resolve' as const;
}

function moscowDate(value: Date) {
  return value.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });
}

function issueSourceData(controlCase: {
  documentNumber: string;
  realizationAt: Date;
  amountKopecks: number;
  reasonCode: string;
  receiptDelayMinutes: number | null;
  receiptCashierRef: string | null;
  receiptCashierName: string | null;
}) {
  return {
    documentNumber: controlCase.documentNumber,
    realizationAt: controlCase.realizationAt.toISOString(),
    amountKopecks: controlCase.amountKopecks,
    reasonCode: controlCase.reasonCode,
    receiptDelayMinutes: controlCase.receiptDelayMinutes,
    receiptCashierRef: controlCase.receiptCashierRef,
    receiptCashierName: controlCase.receiptCashierName,
  };
}

function issueDetail(documentNumber: string, reasonCode: string) {
  const details: Record<string, string> = {
    REQUIRED_FISCAL_RECEIPT_MISSING: 'Обязательный чек не найден в 1С и ОФД.',
    REQUIRED_REALIZATION_FISCAL_RECEIPT_MISSING: 'Чек с передачей суммы в кредит не найден в 1С и ОФД.',
    REQUIRED_CASH_RECEIPT_FISCAL_RECEIPT_MISSING: 'Чек из связанного ПКО первоначального взноса не найден в 1С и ОФД.',
    REQUIRED_ACQUIRING_FISCAL_RECEIPT_MISSING: 'Чек из связанной эквайринговой операции первоначального взноса не найден в 1С и ОФД.',
    PAYMENT_DOCUMENT_NOT_POSTED: 'Связанный документ первоначального взноса не проведён.',
    COUNTERPARTY_MISMATCH: 'Контрагент реализации и документа первоначального взноса не совпадает.',
    FISCALIZED_FROM_WRONG_SOURCE: 'Чек сформирован не из требуемого документа.',
    EXTRA_OR_DUPLICATE_FISCAL_RECEIPT: 'Найдена лишняя или повторная фискализация.',
    FISCAL_TOTAL_MISMATCH: 'Сумма фискальной операции не совпадает с реализацией.',
    CURRENT_PAYMENT_MISMATCH: 'Текущая оплата в чеке не совпадает с первоначальным взносом.',
    CREDIT_REMAINDER_MISMATCH: 'Остаток передачи в кредит указан неверно.',
    FISCAL_RECEIPT_AFTER_SALE_DAY: 'Чек пробит не в день реализации.',
  };
  return `Реализация ${documentNumber}. ${details[reasonCode] ?? 'Автоматическая проверка обнаружила подтверждённое расхождение.'}`;
}

export async function syncCreditRealizationWorkdayControl(prisma: PrismaClient, now = new Date()) {
  const cases = await prisma.creditRealizationControlCase.findMany({
    where: { realizationAt: { gte: CREDIT_REALIZATION_EMPLOYEE_CUTOVER } },
    orderBy: { realizationAt: 'asc' },
  });
  let opened = 0;
  let reminded = 0;
  let resolved = 0;
  let unassigned = 0;

  for (const controlCase of cases) {
    const fingerprint = creditRealizationIssueFingerprint(controlCase.realizationRef);
    const reminderFingerprint = creditRealizationReminderFingerprint(controlCase.realizationRef);
    const action = creditRealizationIssueAction(controlCase, now);
    if (action === 'none') continue;
    if (action === 'resolve') {
      const count = await prisma.$transaction(async (tx) => {
        const result = await tx.workdayControlIssue.updateMany({
          where: { fingerprint, status: 'open' },
          data: {
            status: 'resolved',
            employeeActionRequired: false,
            resolvedAt: now,
            nextReminderAt: null,
            sourceData: issueSourceData(controlCase),
          },
        });
        if (result.count > 0) {
          await tx.workdayNotification.updateMany({
            where: { issue: { fingerprint }, status: 'pending' },
            data: { status: 'cancelled' },
          });
        }
        await tx.workdayNotification.updateMany({
          where: { fingerprint: reminderFingerprint, status: { in: ['pending', 'sent'] } },
          data: { status: 'cancelled' },
        });
        return result.count;
      });
      resolved += count;
      continue;
    }

    if (!controlCase.managerRef) {
      unassigned += 1;
      continue;
    }
    const mappings = await prisma.userOneCCashboxMapping.findMany({
      where: { oneCCashierRef: controlCase.managerRef, isActive: true },
      select: { userId: true },
      take: 2,
    });
    if (mappings.length !== 1) {
      unassigned += 1;
      continue;
    }

    const userId = mappings[0].userId;
    const lifecycle = await prisma.$transaction(async (tx) => {
      const existing = await tx.workdayControlIssue.findUnique({ where: { fingerprint } });
      const reopening = Boolean(existing && existing.status !== 'open');
      const detail = issueDetail(controlCase.documentNumber, controlCase.reasonCode);
      const originDate = moscowDate(controlCase.realizationAt);
      const severity = moscowDate(now) > originDate ? 'error' : 'warning';
      await tx.workdayNotification.updateMany({
        where: { fingerprint: reminderFingerprint, status: { in: ['pending', 'sent'] } },
        data: { status: 'cancelled' },
      });
      const issue = await tx.workdayControlIssue.upsert({
        where: { fingerprint },
        create: {
          userId, fingerprint, ruleKey: 'credit_realization_mismatch', severity, status: 'open',
          title: 'Чек по кредитной продаже', detail,
          sourceData: issueSourceData(controlCase), employeeActionRequired: true, originDate,
          detectedAt: now, lastDetectedAt: now,
        },
        update: {
          userId, severity, status: 'open', title: 'Чек по кредитной продаже', detail,
          sourceData: issueSourceData(controlCase), employeeActionRequired: true, originDate,
          ...(reopening ? { detectedAt: now } : {}),
          lastDetectedAt: now, resolvedAt: null,
        },
      });
      if (!existing || reopening) {
        await tx.workdayNotification.create({
          data: {
            userId, issueId: issue.id, fingerprint: `issue:${issue.id}:detected:${now.toISOString()}`,
            kind: 'issue_detected', title: issue.title,
            body: `Реализация ${controlCase.documentNumber} · ${(controlCase.amountKopecks / 100).toLocaleString('ru-RU')} ₽. Чек не найден. Проверьте оформление в 1С.`, scheduledAt: now,
          },
        });
        return 'opened' as const;
      }
      return 'unchanged' as const;
    });
    if (lifecycle === 'opened') opened += 1;
  }
  return { reminded, opened, resolved, unassigned };
}
