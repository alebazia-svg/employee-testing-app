import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import {
  creditRealizationIssueAction,
  creditRealizationIssueFingerprint,
  syncCreditRealizationWorkdayControl,
} from '../lib/credit-realization-workday-control';

test('only a post-cutover proven mismatch opens employee control', () => {
  const current = { status: 'mismatch', employeeActionCandidate: true, realizationAt: new Date('2026-08-18T08:00:00Z'), completeMismatchReads: 2 };
  assert.equal(creditRealizationIssueAction(current, new Date('2026-08-18T10:30:00Z')), 'remind');
  assert.equal(creditRealizationIssueAction(current, new Date('2026-08-18T21:14:00Z')), 'remind');
  assert.equal(creditRealizationIssueAction(current, new Date('2026-08-18T21:15:00Z')), 'open');
  assert.equal(creditRealizationIssueAction({ ...current, status: 'needs_review', employeeActionCandidate: false }), 'resolve');
  assert.equal(creditRealizationIssueAction({ ...current, realizationAt: new Date('2026-08-17T08:00:00Z') }), 'none');
  assert.doesNotMatch(creditRealizationIssueFingerprint('private-realization-ref'), /private-realization-ref/);
});

test('lifecycle creates one issue and notification, then resolves without duplicates', async () => {
  const cases = [{
    realizationRef: 'private-ref', documentNumber: 'R-1', realizationAt: new Date('2026-08-18T08:00:00Z'),
    managerRef: 'manager-1', status: 'mismatch', reasonCode: 'REQUIRED_FISCAL_RECEIPT_MISSING', employeeActionCandidate: true,
    completeMismatchReads: 2,
  }];
  const issues: Array<Record<string, any>> = [];
  const notifications: Array<Record<string, any>> = [];
  const db: any = {
    creditRealizationControlCase: { findMany: async () => cases },
    userOneCCashboxMapping: { findMany: async () => [{ userId: 4 }] },
    workdayControlIssue: {
      findUnique: async ({ where }: any) => issues.find((row) => row.fingerprint === where.fingerprint) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = issues.find((row) => row.fingerprint === where.fingerprint);
        if (existing) return Object.assign(existing, update);
        const row = { id: issues.length + 1, ...create };
        issues.push(row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const rows = issues.filter((row) => row.fingerprint === where.fingerprint && row.status === where.status);
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    workdayNotification: {
      create: async ({ data }: any) => notifications.push({ id: notifications.length + 1, status: 'pending', ...data }),
      findUnique: async ({ where }: any) => notifications.find((row) => row.fingerprint === where.fingerprint) ?? null,
      updateMany: async ({ where, data }: any) => {
        const issue = where.issue ? issues.find((row) => row.fingerprint === where.issue.fingerprint) : null;
        const rows = notifications.filter((row) => (
          (where.fingerprint ? row.fingerprint === where.fingerprint : row.issueId === issue?.id)
          && row.status === where.status
        ));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    $transaction: async (callback: any) => callback(db),
  };

  assert.deepEqual(await syncCreditRealizationWorkdayControl(db as PrismaClient, new Date('2026-08-18T10:30:00Z')), { reminded: 1, opened: 0, resolved: 0, unassigned: 0 });
  assert.deepEqual(await syncCreditRealizationWorkdayControl(db as PrismaClient, new Date('2026-08-18T10:33:00Z')), { reminded: 0, opened: 0, resolved: 0, unassigned: 0 });
  assert.equal(issues.length, 0);
  assert.equal(notifications.length, 1);

  assert.deepEqual(await syncCreditRealizationWorkdayControl(db as PrismaClient, new Date('2026-08-18T21:15:00Z')), { reminded: 0, opened: 1, resolved: 0, unassigned: 0 });
  assert.equal(issues.length, 1);
  assert.equal(notifications.length, 2);

  cases[0].status = 'confirmed';
  cases[0].employeeActionCandidate = false;
  assert.deepEqual(await syncCreditRealizationWorkdayControl(db as PrismaClient, new Date('2026-08-18T21:18:00Z')), { reminded: 0, opened: 0, resolved: 1, unassigned: 0 });
  assert.equal(issues[0].status, 'resolved');
  assert.equal(notifications[0].status, 'cancelled');
});

test('unmapped cases never create employee side effects', async () => {
  const db: any = {
    creditRealizationControlCase: { findMany: async () => [{
      realizationRef: 'ref', documentNumber: 'R', realizationAt: new Date('2026-08-18T08:00:00Z'),
      managerRef: 'unmapped', status: 'mismatch', reasonCode: 'REQUIRED_FISCAL_RECEIPT_MISSING', employeeActionCandidate: true,
      completeMismatchReads: 1,
    }] },
    userOneCCashboxMapping: { findMany: async () => [] },
    $transaction: async () => { throw new Error('must not write'); },
  };
  assert.deepEqual(await syncCreditRealizationWorkdayControl(db as PrismaClient, new Date('2026-08-18T10:30:00Z')), { reminded: 0, opened: 0, resolved: 0, unassigned: 1 });
});
