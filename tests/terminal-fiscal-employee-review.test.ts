import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import type { MatchingAuditRecord, OneCCheck, TerminalMapping } from '../lib/terminal-fiscal-matching';
import {
  attributePeriodCoveredCashiers,
  evaluateTerminalFiscalEmployeeReview,
  evaluateTerminalFiscalPeriodCoverage,
  oneCChecksAvailableForEmployeeReview,
  syncTerminalFiscalEmployeeReviews,
  terminalFiscalEmployeeReviewText,
} from '../lib/terminal-fiscal-employee-review';
import {
  addAdminTerminalFiscalReviewMessage,
  addEmployeeTerminalFiscalReviewMessage,
  normalizeTerminalFiscalReviewMessage,
} from '../lib/terminal-fiscal-review-messages';
import { terminalFiscalAdminReviewView, terminalFiscalEmployeeReviewSummary } from '../lib/terminal-fiscal-employee-review-view';

const mapping: TerminalMapping = {
  id: 'mapping-1', terminalKey: 'terminal-1', oneCAcquiringTerminalRef: 'acquiring-1',
  oneCCashRegisterRef: 'kkm-1', kktRegistrationNumber: 'kkt-1', activeFrom: '2026-08-01T00:00:00.000Z',
};

function record(overrides: Partial<MatchingAuditRecord> = {}): MatchingAuditRecord {
  return {
    matchingKey: 'operation-1', version: 'mvp-1', status: 'pending', reasonCode: 'ONE_C_CANDIDATE_PENDING',
    evaluatedAt: '2026-08-17T16:45:00.000Z', graceUntil: '2026-08-17T18:32:00.000Z', mappingId: mapping.id,
    bankOperationKey: 'secret-operation', operationType: 'sale', amountKopecks: 1_250_000, candidateCount: 0,
    evidence: { bankTransactionDate: '2026-08-17T16:32:00.000Z' },
    sourceCheckedAt: { tbank: '2026-08-17T16:45:00.000Z', oneC: '2026-08-17T16:45:00.000Z', ofd: '2026-08-17T16:45:00.000Z' },
    sourceCompleteness: { tbank: true, oneC: true, ofd: false }, history: [],
    ...overrides,
  };
}

function check(input: {
  ref?: string;
  cashierRef?: string;
  cashRegisterRef?: string;
  dateTime?: string;
  amountKopecks?: number;
  operationType?: 'sale' | 'refund';
} = {}): OneCCheck {
  const operationType = input.operationType ?? 'sale';
  return {
    sourceRef: input.ref ?? 'check-nearby', sourceType: operationType === 'sale' ? 'sale_check' : 'refund_check', operationType,
    dateTime: input.dateTime ?? '2026-08-17T16:30:00.000Z', cashRegisterRef: input.cashRegisterRef ?? 'kkm-1',
    kktRegistrationNumber: 'kkt-1', totalKopecks: 100, electronicKopecks: 100,
    cashier: { ref: input.cashierRef ?? 'cashier-magomed', name: 'Костеренко Магомед' },
    cardPayments: [{ lineNumber: '1', amountKopecks: input.amountKopecks ?? 100, acquiringTerminalRef: 'acquiring-1', referenceNumber: '', authorizationCode: '', terminalReceiptNumber: '' }],
    items: [], fiscalState: 'confirmed', fiscalStateMeaning: 'data_state_only', fiscalConflict: false,
  };
}

test('first complete 1C read after ten minutes is enough when one nearby mapped cashier exists', () => {
  const target = record();
  assert.deepEqual(evaluateTerminalFiscalEmployeeReview({
    record: target, periodRecords: [target], mapping, oneCChecks: [check()],
    cashierMappings: [{ userId: 5, oneCCashierRef: 'cashier-magomed' }],
  }), { action: 'notify', employeeId: 5, attributionKey: 'kkm-day-cashier:cashier-magomed', source: 'kkm_day_cashier' });
  assert.equal(terminalFiscalEmployeeReviewText({ operationAt: new Date('2026-08-17T16:32:00.000Z'), amountKopecks: 1_250_000 }),
    'Оплата 12 500 ₽ в 19:32. Проверьте и пробейте чек.');
});

test('builds a compact neutral employee workday summary', () => {
  assert.deepEqual(terminalFiscalEmployeeReviewSummary({
    bankOperationAt: '2026-08-17T16:32:00.000Z',
    amountKopecks: 1_250_000,
  }), {
    title: 'Проверьте продажу',
    meta: '19:32 · 12 500 ₽',
  });
});

test('admin review screen distinguishes unresolved ADMIN-only and confirmed late states', () => {
  const common = { bankOperationAt: '2026-08-17T16:26:39.000Z', amountKopecks: 50_000 };
  const admin = terminalFiscalAdminReviewView({ ...common, status: 'admin_review' });
  assert.equal(admin.statusLabel, 'Требуется проверить ADMIN');
  assert.match(admin.discussionMessage, /не закрытая ошибка/);

  const unavailable = terminalFiscalAdminReviewView({
    ...common,
    status: 'admin_review',
    match: { status: 'unavailable', reasonCode: 'SOURCE_OFD_INCOMPLETE', oneCSourceRef: null, timeDifferenceSeconds: null },
  });
  assert.equal(unavailable.statusLabel, 'Ожидается повторная сверка');
  assert.match(unavailable.message, /повторит проверку автоматически/);
  assert.match(unavailable.discussionMessage, /не ошибка сотрудника/);

  const foundWhileOfdWaits = terminalFiscalAdminReviewView({
    ...common,
    status: 'resolved',
    match: { status: 'unavailable', reasonCode: 'SOURCE_OFD_INCOMPLETE', oneCSourceRef: '00OF-002948', timeDifferenceSeconds: 437 },
  });
  assert.equal(foundWhileOfdWaits.statusLabel, 'Активная задача закрыта');
  assert.equal(foundWhileOfdWaits.title, 'Чек найден в 1С');
  assert.match(foundWhileOfdWaits.message, /подтверждение ОФД система повторит автоматически/);
  assert.match(foundWhileOfdWaits.discussionMessage, /Техническая сверка с ОФД продолжается/);

  const resolved = terminalFiscalAdminReviewView({
    ...common,
    status: 'resolved',
    match: { status: 'confirmed', reasonCode: 'MATCH_CONFIRMED_LATE', oneCSourceRef: '00OF-002948', timeDifferenceSeconds: 437 },
  });
  assert.equal(resolved.title, 'Оплата и чек сверены');
  assert.match(resolved.message, /00OF-002948/);
  assert.match(resolved.message, /7 мин 17 сек/);
});

test('does not notify before the safe read, with incomplete 1C, or with ambiguous cashier evidence', () => {
  const args = { mapping, oneCChecks: [check()], cashierMappings: [{ userId: 5, oneCCashierRef: 'cashier-magomed' }] };
  const early = record({ sourceCheckedAt: { tbank: '2026-08-17T16:39:00.000Z', oneC: '2026-08-17T16:39:00.000Z', ofd: '2026-08-17T16:39:00.000Z' } });
  const incomplete = record({ sourceCompleteness: { tbank: true, oneC: false, ofd: true } });
  const normal = record();
  assert.equal(evaluateTerminalFiscalEmployeeReview({ ...args, record: early, periodRecords: [early] }).action, 'wait');
  assert.equal(evaluateTerminalFiscalEmployeeReview({ ...args, record: incomplete, periodRecords: [incomplete] }).action, 'wait');
  assert.equal(evaluateTerminalFiscalEmployeeReview({ ...args, record: normal, periodRecords: [normal], oneCChecks: [check(), check({ ref: 'check-2', cashierRef: 'cashier-milana' })] }).action, 'admin_only');
  assert.equal(evaluateTerminalFiscalEmployeeReview({ ...args, record: normal, periodRecords: [normal], oneCChecks: [check({ cashierRef: '' })] }).action, 'admin_only');
});

test('addresses a missing check to the employee responsible for the mapped KKM at the operation time', () => {
  const target = record();
  assert.deepEqual(evaluateTerminalFiscalEmployeeReview({
    record: target,
    periodRecords: [target],
    mapping,
    oneCChecks: [],
    cashierMappings: [],
    kkmResponsibilities: [{
      id: 41,
      userId: 3,
      oneCCashRegisterRef: 'kkm-1',
      effectiveFrom: new Date('2026-08-17T06:00:00.000Z'),
      effectiveTo: null,
    }],
  }), { action: 'notify', employeeId: 3, attributionKey: 'kkm-responsibility:41', source: 'kkm_responsibility' });
});

test('keeps conflicting KKM responsibility assignments admin-only', () => {
  const target = record();
  const base = { oneCCashRegisterRef: 'kkm-1', effectiveFrom: new Date('2026-08-17T06:00:00.000Z'), effectiveTo: null };
  assert.deepEqual(evaluateTerminalFiscalEmployeeReview({
    record: target,
    periodRecords: [target],
    mapping,
    oneCChecks: [],
    cashierMappings: [],
    kkmResponsibilities: [{ id: 41, userId: 3, ...base }, { id: 42, userId: 4, ...base }],
  }), { action: 'admin_only', reason: 'KKM_RESPONSIBILITY_CONFLICT' });
});

test('uses the uniquely dominant cashier of the mapped KKM day when no manual responsibility exists', () => {
  const target = record();
  assert.deepEqual(evaluateTerminalFiscalEmployeeReview({
    record: target,
    periodRecords: [target],
    mapping,
    oneCChecks: [
      check({ ref: 'day-1', cashierRef: 'cashier-milana', dateTime: '2026-08-17T08:00:00.000Z' }),
      check({ ref: 'day-2', cashierRef: 'cashier-milana', dateTime: '2026-08-17T09:00:00.000Z' }),
      check({ ref: 'brief-substitute', cashierRef: 'cashier-diana', dateTime: '2026-08-17T10:00:00.000Z' }),
    ],
    cashierMappings: [
      { userId: 3, oneCCashierRef: 'cashier-milana' },
      { userId: 6, oneCCashierRef: 'cashier-diana' },
    ],
  }), { action: 'notify', employeeId: 3, attributionKey: 'kkm-day-cashier:cashier-milana', source: 'kkm_day_cashier' });
});

test('closes the employee task when a unique 1C check is found even if OFD is temporarily incomplete', () => {
  const found = record({
    status: 'unavailable',
    reasonCode: 'SOURCE_OFD_INCOMPLETE',
    oneCCheckKey: 'check-found',
    candidateCount: 1,
    sourceCompleteness: { tbank: true, oneC: true, ofd: false },
  });
  assert.deepEqual(evaluateTerminalFiscalEmployeeReview({
    record: found,
    periodRecords: [found],
    mapping,
    oneCChecks: [check({ ref: 'check-found' })],
    cashierMappings: [{ userId: 5, oneCCashierRef: 'cashier-magomed' }],
  }), { action: 'resolve', reason: 'ONE_C_CHECK_FOUND' });
});

test('uses the mapped KKM only and never workstation or OFD operator evidence', () => {
  const result = evaluateTerminalFiscalEmployeeReview({
    record: record(), periodRecords: [record()], mapping,
    oneCChecks: [
      check({ cashierRef: 'cashier-magomed' }),
      check({ ref: 'other-kkm', cashierRef: 'cashier-milana', cashRegisterRef: 'kkm-2' }),
    ],
    cashierMappings: [
      { userId: 5, oneCCashierRef: 'cashier-magomed' },
      { userId: 3, oneCCashierRef: 'cashier-milana' },
    ],
  });
  assert.deepEqual(result, { action: 'notify', employeeId: 5, attributionKey: 'kkm-day-cashier:cashier-magomed', source: 'kkm_day_cashier' });
});

test('period coverage suppresses a false employee notification outside the strict five-minute match window', () => {
  const target = record({
    matchingKey: 'late-bank-operation',
    amountKopecks: 50_000,
    evidence: { bankTransactionDate: '2026-08-17T16:26:00.000Z' },
  });
  const strict = record({
    matchingKey: 'strict-bank-operation', status: 'confirmed', reasonCode: 'MATCH_CONFIRMED',
    amountKopecks: 75_000, oneCCheckKey: 'strict-check', candidateCount: 1,
  });
  const checks = [
    check({ ref: 'strict-check', amountKopecks: 75_000 }),
    check({ ref: 'late-check', amountKopecks: 50_000, dateTime: '2026-08-17T16:33:18.000Z' }),
  ];
  assert.deepEqual(evaluateTerminalFiscalPeriodCoverage({
    record: target, periodRecords: [strict, target], mapping, oneCChecks: checks,
  }).state, 'covered');
  assert.deepEqual(evaluateTerminalFiscalEmployeeReview({
    record: target, periodRecords: [strict, target], mapping, oneCChecks: checks,
    cashierMappings: [{ userId: 5, oneCCashierRef: 'cashier-magomed' }],
  }), { action: 'resolve', reason: 'PERIOD_OPERATION_COVERED' });
});

test('attributes fully covered delayed operations to the single cashier without claiming exact document matches', () => {
  const delayedA = record({
    matchingKey: 'bank-500-a', amountKopecks: 50_000,
    status: 'needs_review', reasonCode: 'ONE_C_CANDIDATE_NOT_FOUND',
  });
  const delayedB = record({
    matchingKey: 'bank-500-b', amountKopecks: 50_000,
    status: 'needs_review', reasonCode: 'ONE_C_CANDIDATE_NOT_FOUND',
  });
  const output = attributePeriodCoveredCashiers({
    output: { version: 'mvp-1', evaluatedAt: delayedA.evaluatedAt, records: [delayedA, delayedB] },
    mapping,
    oneCChecks: [
      check({ ref: 'late-check-a', amountKopecks: 50_000, cashierRef: 'cashier-zukhra' }),
      check({ ref: 'late-check-b', amountKopecks: 50_000, cashierRef: 'cashier-zukhra' }),
    ],
  });
  assert.deepEqual(output.records.map((item) => ({
    cashier: item.oneCCashierRef,
    status: item.status,
    reason: item.reasonCode,
    check: item.oneCCheckKey,
  })), [
    { cashier: 'cashier-zukhra', status: 'needs_review', reason: 'ONE_C_CANDIDATE_NOT_FOUND', check: undefined },
    { cashier: 'cashier-zukhra', status: 'needs_review', reason: 'ONE_C_CANDIDATE_NOT_FOUND', check: undefined },
  ]);
});

test('does not attribute period coverage when cashiers conflict or checks cover only part of the bucket', () => {
  const delayedA = record({ matchingKey: 'bank-a', amountKopecks: 50_000 });
  const delayedB = record({ matchingKey: 'bank-b', amountKopecks: 50_000 });
  const base = { version: 'mvp-1', evaluatedAt: delayedA.evaluatedAt, records: [delayedA, delayedB] };
  const conflicting = attributePeriodCoveredCashiers({
    output: base,
    mapping,
    oneCChecks: [
      check({ ref: 'check-zukhra', amountKopecks: 50_000, cashierRef: 'cashier-zukhra' }),
      check({ ref: 'check-milana', amountKopecks: 50_000, cashierRef: 'cashier-milana' }),
    ],
  });
  const partial = attributePeriodCoveredCashiers({
    output: base,
    mapping,
    oneCChecks: [check({ ref: 'check-only', amountKopecks: 50_000, cashierRef: 'cashier-zukhra' })],
  });
  assert.deepEqual(conflicting.records.map((item) => item.oneCCashierRef), [undefined, undefined]);
  assert.deepEqual(partial.records.map((item) => item.oneCCashierRef), [undefined, undefined]);
});

test('employee guard sees a later 1C check already present at source read time without widening matching input', () => {
  const checks = [
    check({ ref: 'inside-matching-period', dateTime: '2026-08-17T16:29:00.000Z' }),
    check({ ref: 'after-matching-period', dateTime: '2026-08-17T16:33:18.000Z' }),
    check({ ref: 'after-source-read', dateTime: '2026-08-17T16:46:00.000Z' }),
  ];
  assert.deepEqual(oneCChecksAvailableForEmployeeReview({
    checks,
    periodFrom: new Date('2026-08-16T21:00:00.000Z'),
    sourceCheckedAt: '2026-08-17T16:45:00.000Z',
  }).map((item) => item.sourceRef), ['inside-matching-period', 'after-matching-period']);
});

test('equal period counts and totals do not cover different type-and-amount buckets', () => {
  const target = record({ matchingKey: 'bank-100', amountKopecks: 10_000 });
  const peer = record({ matchingKey: 'bank-200', amountKopecks: 20_000 });
  const checks = [
    check({ ref: 'check-150-a', amountKopecks: 15_000 }),
    check({ ref: 'check-150-b', amountKopecks: 15_000 }),
  ];
  const coverage = evaluateTerminalFiscalPeriodCoverage({ record: target, periodRecords: [target, peer], mapping, oneCChecks: checks });
  assert.equal(coverage.bankCount, coverage.oneCCount);
  assert.equal(coverage.bankSumKopecks, coverage.oneCSumKopecks);
  assert.deepEqual({ state: coverage.state, reason: coverage.reason }, {
    state: 'uncovered', reason: 'PERIOD_OPERATION_UNCOVERED',
  });
});

test('partial one-to-one coverage of identical operations stays ADMIN-only', () => {
  const target = record({ matchingKey: 'bank-500-a', amountKopecks: 50_000 });
  const peer = record({ matchingKey: 'bank-500-b', amountKopecks: 50_000 });
  const checks = [check({ ref: 'only-check-500', amountKopecks: 50_000 })];
  assert.deepEqual(evaluateTerminalFiscalEmployeeReview({
    record: target, periodRecords: [target, peer], mapping, oneCChecks: checks,
    cashierMappings: [{ userId: 5, oneCCashierRef: 'cashier-magomed' }],
  }), { action: 'admin_only', reason: 'PERIOD_PARTIAL_BUCKET_COVERAGE' });
});

test('uncovered equal sale and refund movements remain ADMIN-only, including the two 1-ruble tests', () => {
  const sale = record({ matchingKey: 'test-sale', amountKopecks: 100 });
  const refund = record({
    matchingKey: 'test-refund', operationType: 'refund', amountKopecks: 100,
    evidence: { bankTransactionDate: '2026-08-17T17:27:00.000Z' },
  });
  assert.deepEqual(evaluateTerminalFiscalEmployeeReview({
    record: sale, periodRecords: [sale, refund], mapping, oneCChecks: [],
    cashierMappings: [{ userId: 5, oneCCashierRef: 'cashier-magomed' }],
  }), { action: 'admin_only', reason: 'PERIOD_REVERSAL_PAIR' });
});

test('a check already consumed by another bank operation cannot cover the missing operation again', () => {
  const target = record({ matchingKey: 'missing-500', amountKopecks: 50_000 });
  const strict = record({
    matchingKey: 'strict-500', status: 'confirmed', reasonCode: 'MATCH_CONFIRMED',
    amountKopecks: 50_000, oneCCheckKey: 'single-check-500', candidateCount: 1,
  });
  const coverage = evaluateTerminalFiscalPeriodCoverage({
    record: target,
    periodRecords: [strict, target],
    mapping,
    oneCChecks: [check({ ref: 'single-check-500', amountKopecks: 50_000 })],
  });
  assert.deepEqual({ state: coverage.state, reason: coverage.reason }, {
    state: 'uncovered', reason: 'PERIOD_OPERATION_UNCOVERED',
  });
});

test('one review and notification are created without duplicates and a later 1C check resolves them', async () => {
  const reviews: any[] = [];
  const notifications: any[] = [];
  const db: any = {
    workdayKkmAssignment: { findMany: async () => [] },
    userOneCCashboxMapping: { findMany: async () => [{ userId: 5, oneCCashierRef: 'cashier-magomed' }] },
    terminalFiscalEmployeeReview: {
      findUnique: async ({ where }: any) => reviews.find((row) => row.reviewKey === where.reviewKey) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = reviews.find((row) => row.reviewKey === where.reviewKey);
        if (existing) return Object.assign(existing, update);
        const row = { id: `review-${reviews.length + 1}`, status: 'open', ...create };
        reviews.push(row);
        return row;
      },
      update: async ({ where, data }: any) => Object.assign(reviews.find((row) => row.id === where.id), data),
      updateMany: async ({ where, data }: any) => {
        const rows = reviews.filter((row) => row.reviewKey === where.reviewKey && (Array.isArray(where.status?.in) ? where.status.in.includes(row.status) : row.status === where.status));
        rows.forEach((row) => Object.assign(row, data)); return { count: rows.length };
      },
    },
    workdayNotification: {
      upsert: async ({ where, create, update }: any) => {
        const existing = notifications.find((row) => row.fingerprint === where.fingerprint);
        if (existing) return Object.assign(existing, update);
        notifications.push({ id: notifications.length + 1, status: 'pending', ...create });
        return notifications.at(-1);
      },
      updateMany: async ({ where, data }: any) => {
        const review = reviews.find((row) => row.reviewKey === where.review.reviewKey);
        const rows = notifications.filter((row) => row.reviewId === review?.id && row.status === where.status);
        rows.forEach((row) => Object.assign(row, data)); return { count: rows.length };
      },
    },
    $transaction: async (callback: any) => callback(db),
  };
  const output = { version: 'mvp-1', evaluatedAt: record().evaluatedAt, records: [record()] };
  assert.deepEqual(await syncTerminalFiscalEmployeeReviews(db as PrismaClient, { output, mapping, oneCChecks: [check()] }), { opened: 1, resolved: 0, adminOnly: 0, shadowed: 0 });
  assert.deepEqual(await syncTerminalFiscalEmployeeReviews(db as PrismaClient, { output, mapping, oneCChecks: [check()] }), { opened: 0, resolved: 0, adminOnly: 0, shadowed: 0 });
  assert.equal(reviews.length, 1);
  assert.equal(notifications.length, 1);
  assert.equal(JSON.stringify(reviews).includes('secret-operation'), false);

  const found = record({ status: 'confirmed', reasonCode: 'MATCH_CONFIRMED', candidateCount: 1, oneCCheckKey: 'check-found' });
  assert.deepEqual(await syncTerminalFiscalEmployeeReviews(db as PrismaClient, { output: { ...output, records: [found] }, mapping, oneCChecks: [check()] }), { opened: 0, resolved: 1, adminOnly: 0, shadowed: 0 });
  assert.equal(reviews[0].status, 'resolved');
  assert.equal(notifications[0].status, 'cancelled');
});

test('shadow mode records one would-notify candidate without creating an employee notification', async () => {
  const reviews: any[] = [];
  const notifications: any[] = [];
  const db: any = {
    workdayKkmAssignment: { findMany: async () => [] },
    userOneCCashboxMapping: { findMany: async () => [{ userId: 5, oneCCashierRef: 'cashier-magomed' }] },
    terminalFiscalEmployeeReview: {
      findUnique: async ({ where }: any) => reviews.find((row) => row.reviewKey === where.reviewKey) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = reviews.find((row) => row.reviewKey === where.reviewKey);
        if (existing) return Object.assign(existing, update);
        const row = { id: `review-${reviews.length + 1}`, ...create };
        reviews.push(row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const rows = reviews.filter((row) => row.reviewKey === where.reviewKey && (Array.isArray(where.status?.in) ? where.status.in.includes(row.status) : row.status === where.status));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    workdayNotification: {
      upsert: async ({ create }: any) => { notifications.push(create); return create; },
      updateMany: async () => ({ count: 0 }),
    },
    $transaction: async (callback: any) => callback(db),
  };
  const target = record();
  const output = { version: 'mvp-1', evaluatedAt: target.evaluatedAt, records: [target] };
  assert.deepEqual(await syncTerminalFiscalEmployeeReviews(db as PrismaClient, {
    output, mapping, oneCChecks: [check()], mode: 'shadow',
  }), { opened: 0, resolved: 0, adminOnly: 0, shadowed: 1 });
  assert.deepEqual(await syncTerminalFiscalEmployeeReviews(db as PrismaClient, {
    output, mapping, oneCChecks: [check()], mode: 'shadow',
  }), { opened: 0, resolved: 0, adminOnly: 0, shadowed: 0 });
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].status, 'shadow_candidate');
  assert.equal(reviews[0].employeeId, 5);
  assert.equal(notifications.length, 0);

  const found = record({ status: 'confirmed', reasonCode: 'MATCH_CONFIRMED', candidateCount: 1, oneCCheckKey: 'check-found' });
  assert.deepEqual(await syncTerminalFiscalEmployeeReviews(db as PrismaClient, {
    output: { ...output, records: [found] }, mapping, oneCChecks: [check()], mode: 'shadow',
  }), { opened: 0, resolved: 1, adminOnly: 0, shadowed: 0 });
  assert.equal(reviews[0].status, 'resolved');
});

test('review messages are short plain text and cannot be empty', () => {
  assert.deepEqual(normalizeTerminalFiscalReviewMessage('  Нужно   уточнить у второго менеджера. '), { ok: true, body: 'Нужно уточнить у второго менеджера.' });
  assert.equal(normalizeTerminalFiscalReviewMessage('   ').ok, false);
  assert.equal(normalizeTerminalFiscalReviewMessage('x'.repeat(1001)).ok, false);
});

test('employee message goes to ADMIN inbox and ADMIN reply uses the existing employee notification channel', async () => {
  const messages: any[] = [];
  const events: any[] = [];
  const receipts: any[] = [];
  const deliveries: any[] = [];
  const notifications: any[] = [];
  const db: any = {
    terminalFiscalEmployeeReview: {
      findFirst: async ({ where }: any) => where.employeeId
        ? { id: 'review-1', employeeId: 5, status: 'open', employee: { name: 'Костеренко Магомед' } }
        : { id: 'review-1', employeeId: 5, status: 'open' },
    },
    terminalFiscalReviewMessage: {
      create: async ({ data }: any) => { const row = { id: `message-${messages.length + 1}`, ...data }; messages.push(row); return row; },
    },
    adminInboxEvent: {
      create: async ({ data }: any) => { const row = { id: `event-${events.length + 1}`, ...data }; events.push(row); return row; },
    },
    adminInboxReceipt: { createMany: async ({ data }: any) => { receipts.push(...data); return { count: data.length }; } },
    adminInboxDelivery: {
      upsert: async ({ create }: any) => { const row = { id: `delivery-${deliveries.length + 1}`, ...create }; deliveries.push(row); return row; },
    },
    user: { findMany: async () => [{ id: 1 }] },
    workdayNotification: {
      create: async ({ data }: any) => { const row = { id: notifications.length + 1, ...data }; notifications.push(row); return row; },
    },
    $transaction: async (callback: any) => callback(db),
  };
  await addEmployeeTerminalFiscalReviewMessage({ prisma: db as PrismaClient, reviewId: 'review-1', employeeId: 5, body: 'Нужно уточнить продажу.' });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'terminal_fiscal_review.employee_message');
  assert.equal(receipts.length, 1);
  assert.equal(deliveries.length, 1);
  assert.equal(notifications.length, 0);

  await addAdminTerminalFiscalReviewMessage({ prisma: db as PrismaClient, reviewId: 'review-1', adminId: 1, body: 'Проверьте журнал продаж.' });
  assert.equal(messages.length, 2);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].reviewId, 'review-1');
  assert.equal(notifications[0].kind, 'terminal_fiscal_review_reply');
});
