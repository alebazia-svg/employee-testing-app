import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import {
  TERMINAL_FISCAL_DAY_SETTLEMENT_RESOLVED,
  resolveTerminalFiscalReviewsForDay,
  terminalFiscalDayClosureDecision,
  terminalFiscalReviewHasFinalResolution,
} from '../lib/terminal-fiscal-day-closure';
import { compareFiscalSettlement } from '../lib/terminal-fiscal-settlement';

function settlement(amountKopecks = 1_580_000) {
  return compareFiscalSettlement({
    ok: true,
    endpoint: 'bank-exchange-statement-operations',
    control_period: { date_from: '2026-09-09', date_to: '2026-09-10' },
    operations_found: 1,
    operations_returned: 1,
    warnings: [],
    statement_summaries: [{ period_start: '2026-09-09', period_end: '2026-09-10', statement_balance_valid: true }],
    operations: [{
      operation_date: '2026-09-10',
      document_date: '2026-09-10',
      document_number: '524300',
      direction: 'incoming',
      amount: amountKopecks / 100,
      purpose: 'Зачисление средств по терминалам эквайринга',
    }],
  }, { from: '2026-09-09', to: '2026-09-10', fiscalKopecks: amountKopecks, fiscalComplete: true });
}

test('complete statement, 1C and OFD equality closes an otherwise unresolved day', () => {
  assert.deepEqual(terminalFiscalDayClosureDecision({
    configurationComplete: true,
    nativeFiscalComplete: true,
    nativeFiscalKopecks: 1_580_000,
    ofdComplete: true,
    ofdKopecks: 1_580_000,
    settlement: settlement(),
  }), { close: true, reason: TERMINAL_FISCAL_DAY_SETTLEMENT_RESOLVED });
});

test('incomplete statement or a fiscal total difference never closes the day', () => {
  const complete = settlement();
  assert.equal(terminalFiscalDayClosureDecision({
    configurationComplete: true,
    nativeFiscalComplete: true,
    nativeFiscalKopecks: 1_580_000,
    ofdComplete: true,
    ofdKopecks: 1_580_000,
    settlement: { ...complete, complete: false, status: 'incomplete' },
  }).close, false);
  assert.equal(terminalFiscalDayClosureDecision({
    configurationComplete: true,
    nativeFiscalComplete: true,
    nativeFiscalKopecks: 1_580_000,
    ofdComplete: true,
    ofdKopecks: 1_579_900,
    settlement: complete,
  }).close, false);
});

test('day resolution closes active reviews and cancels only pending deliveries', async () => {
  const reviews = [
    { id: 'one', status: 'admin_review', reasonCode: 'SOURCE_INCOMPLETE' },
    { id: 'two', status: 'open', reasonCode: 'ONE_C_CANDIDATE_NOT_FOUND' },
    { id: 'chain', status: 'admin_review', reasonCode: 'ONE_C_EXCHANGE_REVIEW' },
  ];
  const notifications = [
    { reviewId: 'one', status: 'pending', pushStatus: 'pending', nextPushAttemptAt: new Date() },
    { reviewId: 'two', status: 'sent', pushStatus: 'delivered', nextPushAttemptAt: null },
  ];
  const db: any = {
    terminalFiscalEmployeeReview: {
      findMany: async () => reviews.filter((review) => ['open', 'admin_review', 'shadow_candidate'].includes(review.status)
        && (review.reasonCode.startsWith('SOURCE_') || ['ONE_C_CANDIDATE_PENDING', 'ONE_C_CANDIDATE_NOT_FOUND'].includes(review.reasonCode))).map(({ id }) => ({ id })),
      updateMany: async ({ where, data }: any) => {
        const rows = reviews.filter((review) => where.id.in.includes(review.id) && where.status.in.includes(review.status));
        rows.forEach((review) => Object.assign(review, data));
        return { count: rows.length };
      },
    },
    workdayNotification: {
      updateMany: async ({ where, data }: any) => {
        const rows = notifications.filter((notification) => where.reviewId.in.includes(notification.reviewId) && notification.status === where.status);
        rows.forEach((notification) => Object.assign(notification, data));
        return { count: rows.length };
      },
    },
    $transaction: async (callback: any) => callback(db),
  };
  assert.deepEqual(await resolveTerminalFiscalReviewsForDay(db as PrismaClient, {
    from: new Date('2026-09-08T21:00:00Z'),
    to: new Date('2026-09-09T21:00:00Z'),
    resolvedAt: new Date('2026-10-22T12:00:00Z'),
  }), { resolved: 2, notificationsCancelled: 1 });
  assert.ok(reviews.slice(0, 2).every((review) => terminalFiscalReviewHasFinalResolution(review)));
  assert.equal(reviews[2].status, 'admin_review');
  assert.equal(notifications[0].status, 'cancelled');
  assert.equal(notifications[1].status, 'sent');
});
