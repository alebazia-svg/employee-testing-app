import 'server-only';

import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type {
  MatchingAuditRecord,
  OneCCheck,
  TerminalFiscalMatchingOutput,
  TerminalMapping,
} from '@/lib/terminal-fiscal-matching';

export const TERMINAL_FISCAL_EMPLOYEE_REVIEW_DELAY_MS = 10 * 60 * 1000;
export const TERMINAL_FISCAL_EMPLOYEE_REVIEW_WINDOW_MS = 15 * 60 * 1000;

type CashierMapping = { userId: number; oneCCashierRef: string };

export type EmployeeReviewDecision =
  | { action: 'wait' | 'resolve' | 'admin_only'; reason: string }
  | { action: 'notify'; employeeId: number; cashierRef: string };

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function terminalFiscalEmployeeReviewKey(record: Pick<MatchingAuditRecord, 'matchingKey'>) {
  return `terminal-fiscal-review:${digest(record.matchingKey)}`;
}

function timestamp(value: string | undefined) {
  const parsed = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function evaluateTerminalFiscalEmployeeReview(input: {
  record: MatchingAuditRecord;
  mapping: TerminalMapping;
  oneCChecks: OneCCheck[];
  cashierMappings: CashierMapping[];
}): EmployeeReviewDecision {
  const { record, mapping } = input;
  if (record.oneCCheckKey || record.status === 'confirmed' || record.status === 'mismatch') {
    return { action: 'resolve', reason: 'ONE_C_CHECK_FOUND' };
  }
  if (!record.sourceCompleteness.tbank || !record.sourceCompleteness.oneC) {
    return { action: 'wait', reason: 'SOURCE_INCOMPLETE' };
  }
  if (record.candidateCount > 0) return { action: 'admin_only', reason: 'ONE_C_CANDIDATE_AMBIGUOUS' };
  if (record.operationType !== 'sale') return { action: 'wait', reason: 'NOT_A_SALE' };
  if (!['ONE_C_CANDIDATE_PENDING', 'ONE_C_CANDIDATE_NOT_FOUND'].includes(record.reasonCode)) {
    return { action: 'admin_only', reason: 'NOT_AN_ELIGIBLE_MISSING_SALE' };
  }
  const operationAt = timestamp(record.evidence.bankTransactionDate);
  const oneCCheckedAt = timestamp(record.sourceCheckedAt.oneC);
  if (operationAt === null || oneCCheckedAt === null || oneCCheckedAt < operationAt + TERMINAL_FISCAL_EMPLOYEE_REVIEW_DELAY_MS) {
    return { action: 'wait', reason: 'FIRST_SAFE_READ_NOT_REACHED' };
  }

  const nearby = input.oneCChecks.filter((check) => {
    const checkAt = timestamp(check.dateTime);
    return checkAt !== null
      && check.sourceType === 'sale_check'
      && check.operationType === 'sale'
      && check.cashRegisterRef === mapping.oneCCashRegisterRef
      && Math.abs(checkAt - operationAt) <= TERMINAL_FISCAL_EMPLOYEE_REVIEW_WINDOW_MS;
  });
  if (nearby.length === 0 || nearby.some((check) => !check.cashier.ref)) {
    return { action: 'admin_only', reason: nearby.length === 0 ? 'NO_NEARBY_CASHIER' : 'NEARBY_CASHIER_MISSING' };
  }
  const cashierRefs = [...new Set(nearby.map((check) => check.cashier.ref))];
  if (cashierRefs.length !== 1) return { action: 'admin_only', reason: 'MULTIPLE_NEARBY_CASHIERS' };
  const employees = [...new Set(input.cashierMappings
    .filter((item) => item.oneCCashierRef === cashierRefs[0])
    .map((item) => item.userId))];
  if (employees.length !== 1) return { action: 'admin_only', reason: employees.length ? 'CASHIER_MAPPING_CONFLICT' : 'CASHIER_NOT_MAPPED' };
  return { action: 'notify', employeeId: employees[0], cashierRef: cashierRefs[0] };
}

function moscowTime(value: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(value);
}

function moneyFromKopecks(value: number) {
  const rubles = value / 100;
  return `${rubles.toLocaleString('ru-RU', {
    minimumFractionDigits: Number.isInteger(rubles) ? 0 : 2,
    maximumFractionDigits: 2,
  })} ₽`;
}

export function terminalFiscalEmployeeReviewText(input: { operationAt: Date; amountKopecks: number }) {
  return `Чек ${moscowTime(input.operationAt)} — ${moneyFromKopecks(input.amountKopecks)} в 1С не найден. Проверьте продажу.`;
}

export async function syncTerminalFiscalEmployeeReviews(
  prisma: PrismaClient,
  input: {
    output: TerminalFiscalMatchingOutput;
    mapping: TerminalMapping;
    oneCChecks: OneCCheck[];
  },
) {
  const refs = [...new Set(input.oneCChecks.map((check) => check.cashier.ref).filter(Boolean))];
  const cashierMappings = refs.length ? await prisma.userOneCCashboxMapping.findMany({
    where: { oneCCashierRef: { in: refs }, isActive: true },
    select: { userId: true, oneCCashierRef: true },
  }) : [];
  let opened = 0;
  let resolved = 0;
  let adminOnly = 0;

  for (const record of input.output.records) {
    const reviewKey = terminalFiscalEmployeeReviewKey(record);
    const decision = evaluateTerminalFiscalEmployeeReview({
      record,
      mapping: input.mapping,
      oneCChecks: input.oneCChecks,
      cashierMappings: cashierMappings.flatMap((item) => item.oneCCashierRef
        ? [{ userId: item.userId, oneCCashierRef: item.oneCCashierRef }]
        : []),
    });
    if (decision.action === 'wait') continue;
    if (decision.action === 'resolve') {
      const count = await prisma.$transaction(async (tx) => {
        const result = await tx.terminalFiscalEmployeeReview.updateMany({
          where: { reviewKey, status: { in: ['open', 'admin_review'] } },
          data: { status: 'resolved', resolvedAt: new Date(input.output.evaluatedAt), lastCheckedAt: new Date(input.output.evaluatedAt) },
        });
        if (result.count) await tx.workdayNotification.updateMany({
          where: { review: { reviewKey }, status: 'pending' },
          data: { status: 'cancelled' },
        });
        return result.count;
      });
      resolved += count;
      continue;
    }
    if (decision.action === 'admin_only') {
      const changed = await prisma.$transaction(async (tx) => {
        const result = await tx.terminalFiscalEmployeeReview.updateMany({
          where: { reviewKey, status: 'open' },
          data: { status: 'admin_review', lastCheckedAt: new Date(input.output.evaluatedAt) },
        });
        if (result.count) await tx.workdayNotification.updateMany({
          where: { review: { reviewKey }, status: 'pending' },
          data: { status: 'cancelled' },
        });
        return result.count;
      });
      adminOnly += 1;
      continue;
    }
    if (decision.action !== 'notify') continue;

    const operationAt = new Date(record.evidence.bankTransactionDate);
    if (Number.isNaN(operationAt.getTime())) continue;
    const employeeId = decision.employeeId;
    const cashierRef = decision.cashierRef;
    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.terminalFiscalEmployeeReview.findUnique({ where: { reviewKey } });
      const review = await tx.terminalFiscalEmployeeReview.upsert({
        where: { reviewKey },
        create: {
          reviewKey,
          matchingHash: digest(record.matchingKey),
          mappingId: record.mappingId ?? null,
          employeeId,
          reasonCode: record.reasonCode,
          bankOperationAt: operationAt,
          amountKopecks: record.amountKopecks,
          cashierRefHash: digest(cashierRef),
          detectedAt: new Date(input.output.evaluatedAt),
          lastCheckedAt: new Date(input.output.evaluatedAt),
        },
        update: { lastCheckedAt: new Date(input.output.evaluatedAt) },
      });
      if (review.status === 'open') await tx.workdayNotification.upsert({
        where: { fingerprint: `${reviewKey}:created` },
        create: {
          userId: employeeId,
          reviewId: review.id,
          fingerprint: `${reviewKey}:created`,
          kind: 'terminal_fiscal_review',
          title: 'Проверьте продажу',
          body: terminalFiscalEmployeeReviewText({ operationAt, amountKopecks: record.amountKopecks }),
          scheduledAt: new Date(input.output.evaluatedAt),
        },
        update: {},
      });
      return existing === null;
    });
    if (created) opened += 1;
  }
  return { opened, resolved, adminOnly };
}
