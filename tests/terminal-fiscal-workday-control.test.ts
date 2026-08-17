import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import type { TerminalFiscalMatchingOutput } from '../lib/terminal-fiscal-matching';
import {
  syncTerminalFiscalWorkdayControl,
  terminalFiscalIssueAction,
  terminalFiscalIssueFingerprint,
} from '../lib/terminal-fiscal-workday-control';

test('opens employee control only for a proven mismatch', () => {
  assert.equal(terminalFiscalIssueAction({ status: 'mismatch', reasonCode: 'OFD_ELECTRONIC_AMOUNT_MISMATCH' }), 'open');
  assert.equal(terminalFiscalIssueAction({ status: 'pending', reasonCode: 'OFD_RECEIPT_PENDING' }), 'none');
  assert.equal(terminalFiscalIssueAction({ status: 'unavailable', reasonCode: 'SOURCE_ONE_C_INCOMPLETE' }), 'none');
  assert.equal(terminalFiscalIssueAction({ status: 'needs_review', reasonCode: 'ONE_C_CANDIDATE_NOT_FOUND' }), 'none');
});

test('confirmed matching resolves an existing issue and fingerprint contains no raw identity', () => {
  assert.equal(terminalFiscalIssueAction({ status: 'confirmed', reasonCode: 'MATCH_CONFIRMED' }), 'resolve');
  const fingerprint = terminalFiscalIssueFingerprint({ matchingKey: 'terminal|raw-operation-reference' });
  assert.match(fingerprint, /^terminal-fiscal:[a-f0-9]{64}$/);
  assert.doesNotMatch(fingerprint, /raw-operation-reference/);
});

test('issue lifecycle is idempotent and resolves only after confirmed matching', async () => {
  const issues: Array<Record<string, any>> = [];
  const notifications: Array<Record<string, any>> = [];
  let nextIssueId = 1;
  const db: any = {
    terminalFiscalMapping: { findUnique: async () => ({ oneCCashRegisterRef: 'kkm-1' }) },
    workdayKkmAssignment: { findMany: async () => [] },
    userOneCCashboxMapping: { findMany: async () => [{ userId: 7, oneCCashierRef: 'cashier-zukhra' }] },
    workdayControlIssue: {
      findUnique: async ({ where }: any) => issues.find((row) => row.fingerprint === where.fingerprint) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = issues.find((row) => row.fingerprint === where.fingerprint);
        if (existing) return Object.assign(existing, update);
        const row = { id: nextIssueId++, ...create };
        issues.push(row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const rows = issues.filter((row) => row.fingerprint === where.fingerprint && row.status === where.status);
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
      update: async ({ where, data }: any) => Object.assign(issues.find((row) => row.id === where.id)!, data),
    },
    workdayNotification: {
      create: async ({ data }: any) => {
        notifications.push({ id: notifications.length + 1, status: 'pending', ...data });
        return notifications.at(-1);
      },
      upsert: async ({ where, create }: any) => {
        const existing = notifications.find((row) => row.fingerprint === where.fingerprint);
        if (existing) return existing;
        notifications.push({ id: notifications.length + 1, status: 'pending', ...create });
        return notifications.at(-1);
      },
      updateMany: async ({ where, data }: any) => {
        const issue = issues.find((row) => row.fingerprint === where.issue.fingerprint);
        const rows = notifications.filter((row) => row.issueId === issue?.id && row.status === where.status);
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    $transaction: async (callback: any) => callback(db),
  };
  const mismatchRecord: TerminalFiscalMatchingOutput['records'][number] = {
    matchingKey: 'operation-1', version: 'mvp-1', status: 'mismatch', reasonCode: 'OFD_ELECTRONIC_AMOUNT_MISMATCH',
    evaluatedAt: '2026-08-09T10:00:00.000Z', graceUntil: '2026-08-09T09:00:00.000Z', mappingId: 'mapping-1',
    bankOperationKey: 'private-bank-key', operationType: 'sale', amountKopecks: 100, candidateCount: 1,
    oneCCashierRef: 'cashier-zukhra', oneCCashierName: 'Абшаева Зухра',
    evidence: { bankTransactionDate: '2026-08-09T07:30:00.000Z' },
    sourceCheckedAt: { tbank: '2026-08-09T10:00:00.000Z', oneC: '2026-08-09T10:00:00.000Z', ofd: '2026-08-09T10:00:00.000Z' },
    sourceCompleteness: { tbank: true, oneC: true, ofd: true }, history: [],
  };
  const mismatchOutput = { version: 'mvp-1', evaluatedAt: mismatchRecord.evaluatedAt, records: [mismatchRecord] };
  assert.deepEqual(await syncTerminalFiscalWorkdayControl(db as PrismaClient, mismatchOutput), { opened: 1, resolved: 0, reminders: 0, unassigned: 0 });
  assert.deepEqual(await syncTerminalFiscalWorkdayControl(db as PrismaClient, mismatchOutput), { opened: 0, resolved: 0, reminders: 0, unassigned: 0 });
  assert.equal(issues.length, 1);
  assert.equal(notifications.length, 1);
  assert.equal(JSON.stringify(issues).includes('private-bank-key'), false);

  const confirmedOutput: TerminalFiscalMatchingOutput = {
    ...mismatchOutput,
    records: [{ ...mismatchRecord, status: 'confirmed', reasonCode: 'MATCH_CONFIRMED' }],
  };
  assert.deepEqual(await syncTerminalFiscalWorkdayControl(db as PrismaClient, confirmedOutput), { opened: 0, resolved: 1, reminders: 0, unassigned: 0 });
  assert.equal(issues[0].status, 'resolved');
  assert.equal(notifications[0].status, 'cancelled');
});

test('missing 1C check stays admin-only and creates no employee side effects', async () => {
  const record: TerminalFiscalMatchingOutput['records'][number] = {
    matchingKey: 'missing-check', version: 'mvp-1', status: 'needs_review', reasonCode: 'ONE_C_CANDIDATE_NOT_FOUND',
    evaluatedAt: '2026-08-09T10:00:00.000Z', graceUntil: '2026-08-09T09:00:00.000Z', mappingId: 'mapping-1',
    bankOperationKey: 'private', operationType: 'sale', amountKopecks: 100, candidateCount: 0,
    evidence: { bankTransactionDate: '2026-08-09T07:30:00.000Z' },
    sourceCheckedAt: { tbank: '2026-08-09T10:00:00.000Z', oneC: '2026-08-09T10:00:00.000Z', ofd: '2026-08-09T10:00:00.000Z' },
    sourceCompleteness: { tbank: true, oneC: true, ofd: true }, history: [],
  };
  const result = await syncTerminalFiscalWorkdayControl({} as PrismaClient, { version: 'mvp-1', evaluatedAt: record.evaluatedAt, records: [record] });
  assert.deepEqual(result, { opened: 0, resolved: 0, reminders: 0, unassigned: 0 });
});
