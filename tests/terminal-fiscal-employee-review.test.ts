import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import type { MatchingAuditRecord, OneCCheck, TerminalMapping } from '../lib/terminal-fiscal-matching';
import {
  evaluateTerminalFiscalEmployeeReview,
  syncTerminalFiscalEmployeeReviews,
  terminalFiscalEmployeeReviewText,
} from '../lib/terminal-fiscal-employee-review';
import {
  addAdminTerminalFiscalReviewMessage,
  addEmployeeTerminalFiscalReviewMessage,
  normalizeTerminalFiscalReviewMessage,
} from '../lib/terminal-fiscal-review-messages';

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

function check(input: { ref?: string; cashierRef?: string; cashRegisterRef?: string; dateTime?: string } = {}): OneCCheck {
  return {
    sourceRef: input.ref ?? 'check-nearby', sourceType: 'sale_check', operationType: 'sale',
    dateTime: input.dateTime ?? '2026-08-17T16:30:00.000Z', cashRegisterRef: input.cashRegisterRef ?? 'kkm-1',
    kktRegistrationNumber: 'kkt-1', totalKopecks: 100, electronicKopecks: 100,
    cashier: { ref: input.cashierRef ?? 'cashier-magomed', name: 'Костеренко Магомед' },
    cardPayments: [{ lineNumber: '1', amountKopecks: 100, acquiringTerminalRef: 'acquiring-1', referenceNumber: '', authorizationCode: '', terminalReceiptNumber: '' }],
    items: [], fiscalState: 'confirmed', fiscalStateMeaning: 'data_state_only', fiscalConflict: false,
  };
}

test('first complete 1C read after ten minutes is enough when one nearby mapped cashier exists', () => {
  assert.deepEqual(evaluateTerminalFiscalEmployeeReview({
    record: record(), mapping, oneCChecks: [check()],
    cashierMappings: [{ userId: 5, oneCCashierRef: 'cashier-magomed' }],
  }), { action: 'notify', employeeId: 5, cashierRef: 'cashier-magomed' });
  assert.equal(terminalFiscalEmployeeReviewText({ operationAt: new Date('2026-08-17T16:32:00.000Z'), amountKopecks: 1_250_000 }),
    'Чек 19:32 — 12 500 ₽ в 1С не найден. Проверьте продажу.');
});

test('does not notify before the safe read, with incomplete 1C, or with ambiguous cashier evidence', () => {
  const args = { mapping, oneCChecks: [check()], cashierMappings: [{ userId: 5, oneCCashierRef: 'cashier-magomed' }] };
  assert.equal(evaluateTerminalFiscalEmployeeReview({ ...args, record: record({ sourceCheckedAt: { tbank: '2026-08-17T16:39:00.000Z', oneC: '2026-08-17T16:39:00.000Z', ofd: '2026-08-17T16:39:00.000Z' } }) }).action, 'wait');
  assert.equal(evaluateTerminalFiscalEmployeeReview({ ...args, record: record({ sourceCompleteness: { tbank: true, oneC: false, ofd: true } }) }).action, 'wait');
  assert.equal(evaluateTerminalFiscalEmployeeReview({ ...args, record: record(), oneCChecks: [check(), check({ ref: 'check-2', cashierRef: 'cashier-milana' })] }).action, 'admin_only');
  assert.equal(evaluateTerminalFiscalEmployeeReview({ ...args, record: record(), oneCChecks: [check({ cashierRef: '' })] }).action, 'admin_only');
});

test('uses the mapped KKM only and never workstation or OFD operator evidence', () => {
  const result = evaluateTerminalFiscalEmployeeReview({
    record: record(), mapping,
    oneCChecks: [
      check({ cashierRef: 'cashier-magomed' }),
      check({ ref: 'other-kkm', cashierRef: 'cashier-milana', cashRegisterRef: 'kkm-2' }),
    ],
    cashierMappings: [
      { userId: 5, oneCCashierRef: 'cashier-magomed' },
      { userId: 3, oneCCashierRef: 'cashier-milana' },
    ],
  });
  assert.deepEqual(result, { action: 'notify', employeeId: 5, cashierRef: 'cashier-magomed' });
});

test('one review and notification are created without duplicates and a later 1C check resolves them', async () => {
  const reviews: any[] = [];
  const notifications: any[] = [];
  const db: any = {
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
  assert.deepEqual(await syncTerminalFiscalEmployeeReviews(db as PrismaClient, { output, mapping, oneCChecks: [check()] }), { opened: 1, resolved: 0, adminOnly: 0 });
  assert.deepEqual(await syncTerminalFiscalEmployeeReviews(db as PrismaClient, { output, mapping, oneCChecks: [check()] }), { opened: 0, resolved: 0, adminOnly: 0 });
  assert.equal(reviews.length, 1);
  assert.equal(notifications.length, 1);
  assert.equal(JSON.stringify(reviews).includes('secret-operation'), false);

  const found = record({ status: 'confirmed', reasonCode: 'MATCH_CONFIRMED', candidateCount: 1, oneCCheckKey: 'check-found' });
  assert.deepEqual(await syncTerminalFiscalEmployeeReviews(db as PrismaClient, { output: { ...output, records: [found] }, mapping, oneCChecks: [check()] }), { opened: 0, resolved: 1, adminOnly: 0 });
  assert.equal(reviews[0].status, 'resolved');
  assert.equal(notifications[0].status, 'cancelled');
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
  assert.equal(notifications.length, 0);

  await addAdminTerminalFiscalReviewMessage({ prisma: db as PrismaClient, reviewId: 'review-1', adminId: 1, body: 'Проверьте журнал продаж.' });
  assert.equal(messages.length, 2);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].reviewId, 'review-1');
  assert.equal(notifications[0].kind, 'terminal_fiscal_review_reply');
});
