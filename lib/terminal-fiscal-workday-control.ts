import 'server-only';

import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { MatchingAuditRecord, TerminalFiscalMatchingOutput } from '@/lib/terminal-fiscal-matching';
import { attributeTerminalFiscalEmployee } from '@/lib/terminal-fiscal-attribution';

const REMINDER_MS = 60 * 60 * 1000;

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function moscowDateKey(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(value);
}

function moscowTime(value: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(value);
}

export function terminalFiscalIssueFingerprint(record: Pick<MatchingAuditRecord, 'matchingKey'>) {
  return `terminal-fiscal:${digest(record.matchingKey)}`;
}

export function terminalFiscalIssueAction(record: Pick<MatchingAuditRecord, 'status' | 'reasonCode'>) {
  if (record.status === 'confirmed') return 'resolve' as const;
  if (record.status === 'mismatch') return 'open' as const;
  return 'none' as const;
}

function issueDetail(record: Pick<MatchingAuditRecord, 'reasonCode'>, operationAt: Date) {
  const reasons: Partial<Record<MatchingAuditRecord['reasonCode'], string>> = {
    OFD_OPERATION_TYPE_MISMATCH: 'Не совпадает тип операции в 1С и фискальном чеке.',
    OFD_TOTAL_AMOUNT_MISMATCH: 'Не совпадает общая сумма чека в 1С и ОФД.',
    OFD_ELECTRONIC_AMOUNT_MISMATCH: 'Не совпадает сумма оплаты терминалом в Т-Банке, 1С или ОФД.',
    OFD_KKT_MISMATCH: 'Фискальный чек зарегистрирован на другой ККТ.',
  };
  return `Операция около ${moscowTime(operationAt)}. ${reasons[record.reasonCode] ?? 'Автоматическая сверка обнаружила подтверждённое расхождение.'}`;
}

export async function syncTerminalFiscalWorkdayControl(
  prisma: PrismaClient,
  output: TerminalFiscalMatchingOutput,
  now = new Date(output.evaluatedAt),
) {
  let opened = 0;
  let resolved = 0;
  let reminders = 0;
  let unassigned = 0;

  for (const record of output.records) {
    const action = terminalFiscalIssueAction(record);
    if (action === 'none') continue;
    const fingerprint = terminalFiscalIssueFingerprint(record);
    if (action === 'resolve') {
      const resolvedCount = await prisma.$transaction(async (tx) => {
        const result = await tx.workdayControlIssue.updateMany({
          where: { fingerprint, status: 'open' },
          data: { status: 'resolved', resolvedAt: now, nextReminderAt: null },
        });
        if (result.count > 0) {
          await tx.workdayNotification.updateMany({
            where: { issue: { fingerprint }, status: 'pending' },
            data: { status: 'cancelled' },
          });
        }
        return result.count;
      });
      resolved += resolvedCount;
      continue;
    }

    const operationAt = new Date(record.evidence.bankTransactionDate);
    if (Number.isNaN(operationAt.getTime())) {
      unassigned += 1;
      continue;
    }
    const cashierMappings = record.oneCCashierRef ? await prisma.userOneCCashboxMapping.findMany({
        where: { oneCCashierRef: record.oneCCashierRef, isActive: true },
        select: { userId: true, oneCCashierRef: true },
        take: 2,
      }) : [];
    const attribution = attributeTerminalFiscalEmployee({
      status: record.status,
      reasonCode: record.reasonCode,
      oneCCashierRef: record.oneCCashierRef ?? null,
    }, cashierMappings.flatMap((row) => row.oneCCashierRef ? [{ userId: row.userId, oneCCashierRef: row.oneCCashierRef }] : []));
    if (attribution.employeeId === null || attribution.effectiveStatus !== 'mismatch') {
      unassigned += 1;
      continue;
    }

    const userId = attribution.employeeId;
    const lifecycle = await prisma.$transaction(async (tx) => {
      const existing = await tx.workdayControlIssue.findUnique({ where: { fingerprint } });
      const reopening = Boolean(existing && existing.status !== 'open');
      const detail = issueDetail(record, operationAt);
      const issue = await tx.workdayControlIssue.upsert({
        where: { fingerprint },
        create: {
          userId,
          fingerprint,
          ruleKey: 'terminal_fiscal_mismatch',
          severity: 'error',
          status: 'open',
          title: 'Проверьте оплату терминалом',
          detail,
          sourceData: {
            matchingHash: fingerprint.slice('terminal-fiscal:'.length),
            reasonCode: record.reasonCode,
            operationAt: operationAt.toISOString(),
            date: moscowDateKey(operationAt),
          },
          detectedAt: now,
          lastDetectedAt: now,
          nextReminderAt: new Date(now.getTime() + REMINDER_MS),
        },
        update: {
          userId,
          severity: 'error',
          status: 'open',
          title: 'Проверьте оплату терминалом',
          detail,
          sourceData: {
            matchingHash: fingerprint.slice('terminal-fiscal:'.length),
            reasonCode: record.reasonCode,
            operationAt: operationAt.toISOString(),
            date: moscowDateKey(operationAt),
          },
          ...(reopening ? {
            detectedAt: now,
            nextReminderAt: new Date(now.getTime() + REMINDER_MS),
          } : {}),
          lastDetectedAt: now,
          resolvedAt: null,
        },
      });

      if (!existing || reopening) {
        const notificationFingerprint = `issue:${issue.id}:detected:${now.toISOString()}`;
        await tx.workdayNotification.create({
          data: {
            userId,
            issueId: issue.id,
            fingerprint: notificationFingerprint,
            kind: 'issue_detected',
            title: 'Проверьте оплату',
            body: `${issue.detail} Откройте задачу.`,
            scheduledAt: now,
          },
        });
        return 'opened' as const;
      }
      if (existing.nextReminderAt && existing.nextReminderAt <= now) {
        const activeWorkday = await tx.workDayEntry.findFirst({
          where: {
            userId,
            date: moscowDateKey(now),
            status: 'active',
            endedAt: null,
          },
          select: { id: true },
        });
        if (!activeWorkday) return 'unchanged' as const;
        const reminderBucket = Math.floor(now.getTime() / REMINDER_MS);
        await tx.workdayNotification.upsert({
          where: { fingerprint: `issue:${issue.id}:reminder:${reminderBucket}` },
          create: {
            userId,
            issueId: issue.id,
            fingerprint: `issue:${issue.id}:reminder:${reminderBucket}`,
            kind: 'issue_reminder',
            title: 'Проверьте оплату',
            body: `Задача всё ещё ожидает действия. ${issue.detail}`,
            scheduledAt: now,
          },
          update: {},
        });
        await tx.workdayControlIssue.update({
          where: { id: issue.id },
          data: { nextReminderAt: new Date(now.getTime() + REMINDER_MS) },
        });
        return 'reminded' as const;
      }
      return 'unchanged' as const;
    });
    if (lifecycle === 'opened') opened += 1;
    if (lifecycle === 'reminded') reminders += 1;
  }

  return { opened, resolved, reminders, unassigned };
}
