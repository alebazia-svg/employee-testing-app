import 'server-only';

import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type {
  MatchingAuditRecord,
  OneCCheck,
  TerminalFiscalMatchingOutput,
  TerminalMapping,
} from '@/lib/terminal-fiscal-matching';

export const TERMINAL_FISCAL_EMPLOYEE_REVIEW_DELAY_MS = 15 * 60 * 1000;
export const TERMINAL_FISCAL_EMPLOYEE_REVIEW_WINDOW_MS = 15 * 60 * 1000;
const EMPLOYEE_REVIEW_REMINDER_MS = 60 * 60 * 1000;

type CashierMapping = { userId: number; oneCCashierRef: string };
type KkmResponsibility = {
  id: number;
  userId: number;
  oneCCashRegisterRef: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export type EmployeeReviewDecision =
  | { action: 'wait' | 'resolve' | 'admin_only'; reason: string }
  | { action: 'notify'; employeeId: number; attributionKey: string; source: 'kkm_responsibility' | 'kkm_day_cashier' | 'one_c_cashier' };

export type EmployeeReviewCoverageDecision = {
  state: 'covered' | 'uncovered' | 'ambiguous' | 'incomplete';
  reason:
    | 'PERIOD_OPERATION_COVERED'
    | 'PERIOD_OPERATION_UNCOVERED'
    | 'PERIOD_SOURCE_INCOMPLETE'
    | 'PERIOD_COVERAGE_CONFLICT'
    | 'PERIOD_PARTIAL_BUCKET_COVERAGE'
    | 'PERIOD_REVERSAL_PAIR';
  bankCount: number;
  bankSumKopecks: number;
  oneCCount: number;
  oneCSumKopecks: number;
};

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

export function oneCChecksAvailableForEmployeeReview(input: {
  checks: OneCCheck[];
  periodFrom: Date;
  sourceCheckedAt: string;
}) {
  const checkedAt = timestamp(input.sourceCheckedAt);
  if (checkedAt === null) return [];
  return input.checks.filter((check) => {
    const checkAt = timestamp(check.dateTime);
    return checkAt !== null && checkAt >= input.periodFrom.getTime() && checkAt <= checkedAt;
  });
}

function coverageBucket(type: string, amountKopecks: number) {
  return `${type}:${amountKopecks}`;
}

function eligibleOneCOperationType(check: OneCCheck) {
  if (check.sourceType === 'sale_check' && check.operationType === 'sale') return 'sale';
  if (check.sourceType === 'refund_check' && check.operationType === 'refund') return 'refund';
  return null;
}

/**
 * Employee-notification guard only. It never confirms a fiscal match and never
 * changes mvp-1. It asks a narrower, directional question: is this bank
 * operation already covered by a distinct eligible 1C card check somewhere in
 * the complete run period for the same physical chain?
 */
export function evaluateTerminalFiscalPeriodCoverage(input: {
  record: MatchingAuditRecord;
  periodRecords: MatchingAuditRecord[];
  mapping: TerminalMapping;
  oneCChecks: OneCCheck[];
}): EmployeeReviewCoverageDecision {
  const relevantRecords = input.periodRecords.filter((item) => (
    item.mappingId === input.mapping.id
    && (item.operationType === 'sale' || item.operationType === 'refund')
    && item.amountKopecks > 0
  ));
  const base = {
    bankCount: relevantRecords.length,
    bankSumKopecks: relevantRecords.reduce((sum, item) => sum + item.amountKopecks, 0),
  };
  if (relevantRecords.some((item) => !item.sourceCompleteness.tbank || !item.sourceCompleteness.oneC)) {
    return { state: 'incomplete', reason: 'PERIOD_SOURCE_INCOMPLETE', ...base, oneCCount: 0, oneCSumKopecks: 0 };
  }

  const eligibleChecks = input.oneCChecks.filter((check) => {
    const type = eligibleOneCOperationType(check);
    return type !== null
      && check.cashRegisterRef === input.mapping.oneCCashRegisterRef
      && check.cardPayments.length === 1
      && check.cardPayments[0]?.acquiringTerminalRef === input.mapping.oneCAcquiringTerminalRef
      && check.cardPayments[0].amountKopecks > 0;
  });
  const oneCBase = {
    oneCCount: eligibleChecks.length,
    oneCSumKopecks: eligibleChecks.reduce((sum, check) => sum + check.cardPayments[0].amountKopecks, 0),
  };
  if (relevantRecords.some((item) => ['BANK_OPERATION_DUPLICATE', 'BANK_OPERATION_INVALID', 'ONE_C_CHECK_REUSED'].includes(item.reasonCode))) {
    return { state: 'ambiguous', reason: 'PERIOD_COVERAGE_CONFLICT', ...base, ...oneCBase };
  }
  if (new Set(eligibleChecks.map((check) => check.sourceRef)).size !== eligibleChecks.length) {
    return { state: 'ambiguous', reason: 'PERIOD_COVERAGE_CONFLICT', ...base, ...oneCBase };
  }

  const assignedRefs = relevantRecords.flatMap((item) => item.oneCCheckKey ? [item.oneCCheckKey] : []);
  if (new Set(assignedRefs).size !== assignedRefs.length) {
    return { state: 'ambiguous', reason: 'PERIOD_COVERAGE_CONFLICT', ...base, ...oneCBase };
  }
  const assigned = new Set(assignedRefs);
  const unmatchedRecords = relevantRecords.filter((item) => !item.oneCCheckKey);
  const availableChecks = eligibleChecks.filter((check) => !assigned.has(check.sourceRef));
  const targetBucket = coverageBucket(input.record.operationType ?? '', input.record.amountKopecks);
  const sameBank = unmatchedRecords.filter((item) => coverageBucket(item.operationType ?? '', item.amountKopecks) === targetBucket);
  const sameOneC = availableChecks.filter((check) => (
    coverageBucket(eligibleOneCOperationType(check) ?? '', check.cardPayments[0].amountKopecks) === targetBucket
  ));

  if (!sameBank.some((item) => item.matchingKey === input.record.matchingKey)) {
    return { state: 'ambiguous', reason: 'PERIOD_COVERAGE_CONFLICT', ...base, ...oneCBase };
  }

  if (sameOneC.length >= sameBank.length) {
    return { state: 'covered', reason: 'PERIOD_OPERATION_COVERED', ...base, ...oneCBase };
  }
  if (sameOneC.length > 0) {
    return { state: 'ambiguous', reason: 'PERIOD_PARTIAL_BUCKET_COVERAGE', ...base, ...oneCBase };
  }

  const oppositeType = input.record.operationType === 'sale' ? 'refund' : 'sale';
  const oppositeBucket = coverageBucket(oppositeType, input.record.amountKopecks);
  const oppositeBank = unmatchedRecords.filter((item) => coverageBucket(item.operationType ?? '', item.amountKopecks) === oppositeBucket);
  const oppositeOneC = availableChecks.filter((check) => (
    coverageBucket(eligibleOneCOperationType(check) ?? '', check.cardPayments[0].amountKopecks) === oppositeBucket
  ));
  if (oppositeBank.length > 0 && oppositeOneC.length === 0) {
    return { state: 'ambiguous', reason: 'PERIOD_REVERSAL_PAIR', ...base, ...oneCBase };
  }
  return { state: 'uncovered', reason: 'PERIOD_OPERATION_UNCOVERED', ...base, ...oneCBase };
}

/**
 * Adds cashier context to bank operations that are covered only at the daily
 * amount-bucket level. This does not claim an exact bank -> 1C document pair,
 * does not change the matching status/reason and does not create an employee
 * error. Attribution is safe only when every still-available check in the
 * fully-covered bucket belongs to one cashier on the mapped physical chain.
 */
export function attributePeriodCoveredCashiers(input: {
  output: TerminalFiscalMatchingOutput;
  mapping: TerminalMapping;
  oneCChecks: OneCCheck[];
}): TerminalFiscalMatchingOutput {
  const assignedRefs = new Set(input.output.records.flatMap((record) => (
    record.mappingId === input.mapping.id && record.oneCCheckKey ? [record.oneCCheckKey] : []
  )));
  const availableChecks = input.oneCChecks.filter((check) => (
    !assignedRefs.has(check.sourceRef)
    && eligibleOneCOperationType(check) !== null
    && check.cashRegisterRef === input.mapping.oneCCashRegisterRef
    && check.cardPayments.length === 1
    && check.cardPayments[0]?.acquiringTerminalRef === input.mapping.oneCAcquiringTerminalRef
    && check.cardPayments[0].amountKopecks > 0
  ));
  const eligibleRecords = input.output.records.filter((record) => (
    record.mappingId === input.mapping.id
    && !record.oneCCheckKey
    && !record.oneCCashierRef
    && record.candidateCount === 0
    && record.sourceCompleteness.tbank
    && record.sourceCompleteness.oneC
    && (record.operationType === 'sale' || record.operationType === 'refund')
    && ['ONE_C_CANDIDATE_PENDING', 'ONE_C_CANDIDATE_NOT_FOUND'].includes(record.reasonCode)
  ));

  const cashierByMatchingKey = new Map<string, { ref: string; name: string }>();
  const bucketKeys = new Set(eligibleRecords.map((record) => coverageBucket(record.operationType ?? '', record.amountKopecks)));
  for (const bucketKey of bucketKeys) {
    const records = eligibleRecords.filter((record) => coverageBucket(record.operationType ?? '', record.amountKopecks) === bucketKey);
    const checks = availableChecks.filter((check) => (
      coverageBucket(eligibleOneCOperationType(check) ?? '', check.cardPayments[0].amountKopecks) === bucketKey
    ));
    if (checks.length < records.length || checks.some((check) => !check.cashier.ref)) continue;
    const cashierRefs = [...new Set(checks.map((check) => check.cashier.ref))];
    if (cashierRefs.length !== 1) continue;
    const cashier = { ref: cashierRefs[0], name: checks.find((check) => check.cashier.name)?.cashier.name ?? '' };
    records.forEach((record) => cashierByMatchingKey.set(record.matchingKey, cashier));
  }

  if (cashierByMatchingKey.size === 0) return input.output;
  return {
    ...input.output,
    records: input.output.records.map((record) => {
      const cashier = cashierByMatchingKey.get(record.matchingKey);
      return cashier ? { ...record, oneCCashierRef: cashier.ref, oneCCashierName: cashier.name } : record;
    }),
  };
}

export function evaluateTerminalFiscalEmployeeReview(input: {
  record: MatchingAuditRecord;
  periodRecords: MatchingAuditRecord[];
  mapping: TerminalMapping;
  oneCChecks: OneCCheck[];
  cashierMappings: CashierMapping[];
  kkmResponsibilities?: KkmResponsibility[];
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

  const coverage = evaluateTerminalFiscalPeriodCoverage({
    record,
    periodRecords: input.periodRecords,
    mapping,
    oneCChecks: input.oneCChecks,
  });
  if (coverage.state === 'incomplete') return { action: 'wait', reason: coverage.reason };
  if (coverage.state === 'covered') return { action: 'resolve', reason: coverage.reason };
  if (coverage.state === 'ambiguous') return { action: 'admin_only', reason: coverage.reason };

  const responsibilities = (input.kkmResponsibilities ?? []).filter((item) => (
    item.oneCCashRegisterRef === mapping.oneCCashRegisterRef
    && item.effectiveFrom.getTime() <= operationAt
    && (item.effectiveTo === null || item.effectiveTo.getTime() > operationAt)
  ));
  const responsibleEmployees = [...new Set(responsibilities.map((item) => item.userId))];
  if (responsibleEmployees.length === 1) {
    return {
      action: 'notify',
      employeeId: responsibleEmployees[0],
      attributionKey: `kkm-responsibility:${responsibilities[0].id}`,
      source: 'kkm_responsibility',
    };
  }
  if (responsibleEmployees.length > 1) return { action: 'admin_only', reason: 'KKM_RESPONSIBILITY_CONFLICT' };

  const dayCashierCounts = new Map<string, number>();
  for (const check of input.oneCChecks) {
    if (check.cashRegisterRef !== mapping.oneCCashRegisterRef || !check.cashier.ref) continue;
    dayCashierCounts.set(check.cashier.ref, (dayCashierCounts.get(check.cashier.ref) ?? 0) + 1);
  }
  const rankedDayCashiers = [...dayCashierCounts.entries()].sort((left, right) => right[1] - left[1]);
  if (rankedDayCashiers.length > 0 && (rankedDayCashiers.length === 1 || rankedDayCashiers[0][1] > rankedDayCashiers[1][1])) {
    const cashierRef = rankedDayCashiers[0][0];
    const dayEmployees = [...new Set(input.cashierMappings
      .filter((item) => item.oneCCashierRef === cashierRef)
      .map((item) => item.userId))];
    if (dayEmployees.length === 1) {
      return {
        action: 'notify',
        employeeId: dayEmployees[0],
        attributionKey: `kkm-day-cashier:${cashierRef}`,
        source: 'kkm_day_cashier',
      };
    }
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
  return { action: 'notify', employeeId: employees[0], attributionKey: `one-c-cashier:${cashierRefs[0]}`, source: 'one_c_cashier' };
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
  return `Оплата ${moneyFromKopecks(input.amountKopecks)} в ${moscowTime(input.operationAt)}. Проверьте и пробейте чек.`;
}

export async function syncTerminalFiscalEmployeeReviews(
  prisma: PrismaClient,
  input: {
    output: TerminalFiscalMatchingOutput;
    mapping: TerminalMapping;
    oneCChecks: OneCCheck[];
    mode?: 'notify' | 'shadow';
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
  let shadowed = 0;
  const mode = input.mode ?? 'notify';

  for (const record of input.output.records) {
    const reviewKey = terminalFiscalEmployeeReviewKey(record);
    const operationAt = new Date(record.evidence.bankTransactionDate);
    const operationDate = Number.isNaN(operationAt.getTime()) ? null : new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(operationAt);
    const kkmResponsibilities = operationDate ? await prisma.workdayKkmAssignment.findMany({
      where: {
        date: operationDate,
        oneCCashRegisterRef: input.mapping.oneCCashRegisterRef,
        effectiveFrom: { lte: operationAt },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: operationAt } }],
      },
      select: { id: true, userId: true, oneCCashRegisterRef: true, effectiveFrom: true, effectiveTo: true },
      take: 2,
    }) : [];
    const decision = evaluateTerminalFiscalEmployeeReview({
      record,
      periodRecords: input.output.records,
      mapping: input.mapping,
      oneCChecks: input.oneCChecks,
      cashierMappings: cashierMappings.flatMap((item) => item.oneCCashierRef
        ? [{ userId: item.userId, oneCCashierRef: item.oneCCashierRef }]
        : []),
      kkmResponsibilities,
    });
    if (decision.action === 'wait') continue;
    if (decision.action === 'resolve') {
      const count = await prisma.$transaction(async (tx) => {
        const result = await tx.terminalFiscalEmployeeReview.updateMany({
          where: { reviewKey, status: { in: ['open', 'admin_review', 'shadow_candidate'] } },
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
          where: { reviewKey, status: { in: ['open', 'shadow_candidate'] } },
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

    if (Number.isNaN(operationAt.getTime())) continue;
    const employeeId = decision.employeeId;
    const attributionKey = decision.attributionKey;
    const created = await prisma.$transaction(async (tx) => {
      const evaluatedAt = new Date(input.output.evaluatedAt);
      const existing = await tx.terminalFiscalEmployeeReview.findUnique({ where: { reviewKey } });
      if (existing && !['open', 'shadow_candidate'].includes(existing.status)) return false;
      const review = await tx.terminalFiscalEmployeeReview.upsert({
        where: { reviewKey },
        create: {
          reviewKey,
          matchingHash: digest(record.matchingKey),
          mappingId: record.mappingId ?? null,
          employeeId,
          status: mode === 'shadow' ? 'shadow_candidate' : 'open',
          reasonCode: record.reasonCode,
          bankOperationAt: operationAt,
          amountKopecks: record.amountKopecks,
          cashierRefHash: digest(attributionKey),
          detectedAt: evaluatedAt,
          lastCheckedAt: evaluatedAt,
        },
        update: {
          lastCheckedAt: evaluatedAt,
          ...(mode === 'shadow' ? { status: 'shadow_candidate' } : {}),
        },
      });
      if (mode === 'notify' && review.status === 'open') await tx.workdayNotification.upsert({
        where: { fingerprint: `${reviewKey}:created` },
        create: {
          userId: employeeId,
          reviewId: review.id,
          fingerprint: `${reviewKey}:created`,
          kind: 'terminal_fiscal_review',
          title: 'В 1С нет чека',
          body: terminalFiscalEmployeeReviewText({ operationAt, amountKopecks: record.amountKopecks }),
          scheduledAt: evaluatedAt,
        },
        update: {},
      });
      if (mode === 'notify' && existing && review.status === 'open'
        && evaluatedAt.getTime() - new Date(review.detectedAt).getTime() >= EMPLOYEE_REVIEW_REMINDER_MS) {
        const workdayDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(evaluatedAt);
        const activeWorkday = await tx.workDayEntry.findFirst({
          where: { userId: employeeId, date: workdayDate, status: 'active', endedAt: null },
          select: { id: true },
        });
        if (activeWorkday) {
          const reminderBucket = Math.floor(evaluatedAt.getTime() / EMPLOYEE_REVIEW_REMINDER_MS);
          await tx.workdayNotification.upsert({
            where: { fingerprint: `${reviewKey}:reminder:${reminderBucket}` },
            create: {
              userId: employeeId,
              reviewId: review.id,
              fingerprint: `${reviewKey}:reminder:${reminderBucket}`,
              kind: 'issue_reminder',
              title: 'Чек в 1С всё ещё не пробит',
              body: terminalFiscalEmployeeReviewText({ operationAt, amountKopecks: record.amountKopecks }),
              scheduledAt: evaluatedAt,
            },
            update: {},
          });
        }
      }
      return existing === null;
    });
    if (created && mode === 'notify') opened += 1;
    if (created && mode === 'shadow') shadowed += 1;
  }
  return { opened, resolved, adminOnly, shadowed };
}
