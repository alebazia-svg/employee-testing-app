import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import {
  appendCashRecountInputHistory,
  buildCashRecountComparison,
  cashRecountIssueFingerprint,
  decideCashRecountAction,
  syncCashRecountWorkdayControl,
} from '../lib/cash-recount-control';

test('cash input audit preserves initial and corrected values without duplicate saves', () => {
  const initial = appendCashRecountInputHistory(undefined, 1000.5, '2026-08-16T09:00:00.000Z');
  assert.deepEqual(initial, [{ value: 1000.5, enteredAt: '2026-08-16T09:00:00.000Z', kind: 'initial' }]);
  assert.deepEqual(appendCashRecountInputHistory(initial, 1000.5, '2026-08-16T09:01:00.000Z'), initial);
  assert.deepEqual(appendCashRecountInputHistory(initial, 1000, '2026-08-16T09:02:00.000Z'), [
    initial[0],
    { value: 1000, enteredAt: '2026-08-16T09:02:00.000Z', kind: 'corrected' },
  ]);
});

function comparison(actual: number, expected: number | null) {
  return buildCashRecountComparison({
    actual,
    expected,
    capturedAt: '2026-08-16T09:00:00.000Z',
    oneCCheckedAt: '2026-08-16T09:00:00.000Z',
    cashboxName: 'Касса Чеченова',
  });
}

test('only exact zero matches and comment threshold is strictly above 300 rubles', () => {
  assert.deepEqual(comparison(1000, 1000), { status: 'matched', actual: 1000, expected: 1000, difference: 0, discrepancyType: 'none', requiresComment: false, capturedAt: '2026-08-16T09:00:00.000Z', oneCCheckedAt: '2026-08-16T09:00:00.000Z', cashboxName: 'Касса Чеченова', sourceError: null });
  for (const difference of [0.5, 1, 2, 100, 300, -0.5, -300]) {
    assert.equal(comparison(1000 + difference, 1000).status, 'mismatch');
  }
  assert.equal(comparison(900, 1000).discrepancyType, 'shortage');
  assert.equal(comparison(1100, 1000).discrepancyType, 'surplus');
  assert.equal(comparison(1300, 1000).requiresComment, false);
  assert.equal(comparison(1300.01, 1000).requiresComment, true);
  assert.equal(comparison(1000, null).status, 'unavailable');
});

test('cash recount completes without exposing a comparison unless a comment is required', () => {
  const values = [0.5, 1, 2, 100, 300, 301];
  for (const difference of values) {
    const result = comparison(1000 + difference, 1000);
    assert.equal(
      decideCashRecountAction({ comparison: result, hasComment: false }),
      difference > 300 ? 'require_comment' : 'complete_mismatch',
    );
  }
  assert.equal(decideCashRecountAction({ comparison: comparison(1000, 1000), hasComment: false }), 'complete_matched');
  assert.equal(decideCashRecountAction({ comparison: comparison(1301, 1000), hasComment: true }), 'complete_mismatch');
  assert.equal(decideCashRecountAction({ comparison: comparison(1000, null), hasComment: false }), 'complete_unavailable');
});

test('fingerprint is stable and does not expose cashbox name', () => {
  const value = cashRecountIssueFingerprint(17, 'Касса Чеченова');
  assert.match(value, /^cash-recount:17:[a-f0-9]{24}$/);
  assert.doesNotMatch(value, /Чеченова/);
});

test('mismatch lifecycle is idempotent and next matched recount resolves it', async () => {
  const issues: Array<Record<string, any>> = [];
  const notifications: Array<Record<string, any>> = [];
  let nextId = 1;
  const db: any = {
    workdayControlIssue: {
      findUnique: async ({ where }: any) => issues.find((row) => row.fingerprint === where.fingerprint) ?? null,
      findMany: async ({ where }: any) => issues.filter((row) => row.userId === where.userId && row.ruleKey === where.ruleKey && row.status === where.status).map(({ id }) => ({ id })),
      upsert: async ({ where, create, update }: any) => {
        const current = issues.find((row) => row.fingerprint === where.fingerprint);
        if (current) return Object.assign(current, update);
        const row = { id: nextId++, ...create }; issues.push(row); return row;
      },
      updateMany: async ({ where, data }: any) => {
        const ids = where.id.in as number[];
        const rows = issues.filter((row) => ids.includes(row.id) && row.status === where.status);
        rows.forEach((row) => Object.assign(row, data)); return { count: rows.length };
      },
    },
    workdayNotification: {
      upsert: async ({ where, create }: any) => {
        const current = notifications.find((row) => row.fingerprint === where.fingerprint);
        if (current) return current;
        const row = { id: notifications.length + 1, status: 'pending', ...create }; notifications.push(row); return row;
      },
      updateMany: async ({ where, data }: any) => {
        const ids = where.issueId.in as number[];
        const rows = notifications.filter((row) => ids.includes(row.issueId) && row.status === where.status);
        rows.forEach((row) => Object.assign(row, data)); return { count: rows.length };
      },
    },
  };
  const input = { userId: 3, taskId: 10, runId: 7, date: '2026-08-16', comment: '', comparison: comparison(900, 1000), now: new Date('2026-08-16T09:00:00.000Z') };
  assert.deepEqual(await syncCashRecountWorkdayControl(db as PrismaClient, input), { opened: 1, resolved: 0, notifications: 1 });
  assert.deepEqual(await syncCashRecountWorkdayControl(db as PrismaClient, input), { opened: 0, resolved: 0, notifications: 0 });
  assert.equal(issues.length, 1);
  assert.equal(notifications.length, 1);

  assert.deepEqual(await syncCashRecountWorkdayControl(db as PrismaClient, { ...input, taskId: 11, comparison: comparison(1000, 1000), now: new Date('2026-08-16T15:30:00.000Z') }), { opened: 0, resolved: 1, notifications: 0 });
  assert.equal(issues[0].status, 'resolved');
  assert.equal(notifications.every((row) => row.status === 'cancelled'), true);
});

test('mismatch above 300 rubles is elevated and receives a reminder', async () => {
  const issues: Array<Record<string, any>> = [];
  const notifications: Array<Record<string, any>> = [];
  const db: any = {
    workdayControlIssue: {
      findUnique: async ({ where }: any) => issues.find((row) => row.fingerprint === where.fingerprint) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const current = issues.find((row) => row.fingerprint === where.fingerprint);
        if (current) return Object.assign(current, update);
        const row = { id: 1, ...create }; issues.push(row); return row;
      },
    },
    workdayNotification: {
      upsert: async ({ where, create }: any) => {
        const current = notifications.find((row) => row.fingerprint === where.fingerprint);
        if (current) return current;
        const row = { id: notifications.length + 1, status: 'pending', ...create }; notifications.push(row); return row;
      },
    },
  };
  const result = await syncCashRecountWorkdayControl(db as PrismaClient, {
    userId: 3,
    taskId: 12,
    runId: 7,
    date: '2026-08-16',
    comment: 'Проверено повторно',
    comparison: comparison(1301, 1000),
    now: new Date('2026-08-16T09:00:00.000Z'),
  });
  assert.deepEqual(result, { opened: 1, resolved: 0, notifications: 2 });
  assert.equal(issues[0].severity, 'error');
  assert.equal(notifications.length, 2);
  for (const notification of notifications) {
    assert.equal(notification.title, 'Контроль наличных');
    assert.doesNotMatch(notification.body, /300|301|1000|1301|излиш|недост|расхожд/i);
  }
});

test('unavailable source creates and resolves nothing', async () => {
  let touched = false;
  const db: any = { workdayControlIssue: { findMany: async () => { touched = true; return []; } } };
  const result = await syncCashRecountWorkdayControl(db as PrismaClient, { userId: 3, taskId: 1, runId: 1, date: '2026-08-16', comment: '', comparison: comparison(1000, null), now: new Date() });
  assert.deepEqual(result, { opened: 0, resolved: 0, notifications: 0 });
  assert.equal(touched, false);
});
