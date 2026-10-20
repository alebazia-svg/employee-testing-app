import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { refreshPendingExpenseStatuses, refreshOneExpenseStatus } from '../lib/expense-request-status-refresh';
import { syncExpenseRequestAdminAudit } from '../lib/expense-request-admin-sync';
import { loadAdminInbox } from '../lib/admin-inbox-data';
import type { NativeExpenseState } from '../lib/expense-request-command';

const enabled = process.env.EXPENSE_STATUS_INTEGRATION === '1';
test('targeted status reconciliation: real PostgreSQL concurrency, freshness and inbox lifecycle', { skip: !enabled }, async t => {
  assert.equal(new URL(process.env.DATABASE_URL!).hostname, '127.0.0.1');
  assert.equal(new URL(process.env.DATABASE_URL!).port, '55456');
  assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/expense_status_test');
  const db = new PrismaClient();
  const now = new Date('2026-10-20T12:00:00Z');
  const clock = () => now;
  const state = (ref: string, key = 'payable') => ({
    document: { ref, deletion_mark: false, status: { key, name: key } },
  }) as NativeExpenseState;
  async function seed() {
    await db.expenseRequestAdminEvaluation.deleteMany();
    await db.expenseRequestAdminCase.deleteMany();
    await db.expenseRequestSyncRun.deleteMany();
    return db.expenseRequestAdminCase.create({ data: {
      oneCRequestRef: randomUUID(), currentStatusKey: 'not_approved', isNotApproved: true,
      currentCycleOrigin: 'live', notApprovedCycle: 1, deletionMark: false, lastSeenAt: new Date(+now - 120_000),
    } });
  }
  try {
    await t.test('no pending work makes no 1C requests and creates no run rows', async () => {
      await seed();
      await db.expenseRequestAdminCase.deleteMany();
      const result = await refreshPendingExpenseStatuses({ db, clock, read: async () => { throw Error('must not read'); } });
      assert.deepEqual(result, { checked: 0, closed: 0 });
      assert.equal(await db.expenseRequestSyncRun.count(), 0);
    });
    await t.test('parallel callers across DB connections share one request and cooldown', async () => {
      const row = await seed();
      let entered!: () => void, release!: () => void;
      const enteredPromise = new Promise<void>(r => { entered = r; });
      const gate = new Promise<void>(r => { release = r; });
      let reads = 0;
      const read = async (ref: string) => { reads++; entered(); await gate; return state(ref, 'not_approved'); };
      const first = refreshPendingExpenseStatuses({ db, clock, read });
      await enteredPromise;
      const other = new PrismaClient();
      try { assert.deepEqual(await refreshPendingExpenseStatuses({ db: other, clock, read }), { checked: 0, closed: 0 }); }
      finally { release(); await other.$disconnect(); }
      assert.equal((await first).checked, 1);
      await refreshPendingExpenseStatuses({ db, clock, read: async ref => { reads++; return state(ref); } });
      assert.equal(reads, 1);
      assert.equal((await db.expenseRequestAdminCase.findUniqueOrThrow({ where: { id: row.id } })).isNotApproved, true);
      assert.equal(await db.expenseRequestSyncRun.count({ where: { sourceComplete: true } }), 0);
    });
    await t.test('unchanged pending status does not starve richer full-sync updates', async () => {
      const row = await seed();
      await refreshPendingExpenseStatuses({ db, clock, read: async ref => state(ref, 'not_approved') });
      const after = await db.expenseRequestAdminCase.findUniqueOrThrow({ where: { id: row.id } });
      assert.equal(+after.lastSeenAt, +row.lastSeenAt);
      assert.equal(+after.updatedAt, +row.updatedAt);
    });
    await t.test('failed read, unknown status and wrong identity never close the task', async () => {
      for (const read of [
        async () => { throw Error('offline'); },
        async (ref: string) => state(ref, 'unknown'),
        async () => state(randomUUID()),
      ]) {
        const row = await seed();
        await refreshPendingExpenseStatuses({ db, clock, read });
        assert.equal((await db.expenseRequestAdminCase.findUniqueOrThrow({ where: { id: row.id } })).isNotApproved, true);
      }
    });
    await t.test('confirmed status disappears from attention/bell but remains in history; stale bulk cannot restore it', async () => {
      const row = await seed();
      const admin = await db.user.create({ data: { login: randomUUID(), name: 'Status test', passwordHash: 'test-unused', role: 'ADMIN' } });
      const event = await db.adminInboxEvent.create({ data: {
        eventKey: `expense_request:not_approved:${row.oneCRequestRef}:1`, type: 'expense_request.created',
        sourceType: 'expense_request', sourceId: row.oneCRequestRef, title: 'Test', body: 'Test',
        href: '/admin/expense-requests', occurredAt: now, receipts: { create: { userId: admin.id } },
      } });
      assert.equal((await loadAdminInbox({ userId: admin.id, limit: 8, view: 'attention', now })).attentionCount, 1);
      assert.equal((await refreshPendingExpenseStatuses({ db, clock, read: async ref => state(ref) })).closed, 1);
      assert.equal((await loadAdminInbox({ userId: admin.id, limit: 8, view: 'attention', now })).attentionCount, 0);
      assert.ok((await loadAdminInbox({ userId: admin.id, limit: 200, view: 'history', now })).items.some(i => i.eventId === event.id));
      const source = { ref: row.oneCRequestRef, status: { key: 'not_approved', name: 'Не согласовано' }, deletion_mark: false };
      await syncExpenseRequestAdminAudit({ db, now, from: new Date(+now - 86400000), to: now, snapshot: {
        startedAt: new Date(+now - 30_000).toISOString(), checkedAt: new Date(+now + 1_000).toISOString(),
        complete: true, rows: [source], pageCount: 1, errors: [],
      } });
      assert.equal((await db.expenseRequestAdminCase.findUniqueOrThrow({ where: { id: row.id } })).currentStatusKey, 'payable');
      const later = new Date(+now + 60_000);
      await syncExpenseRequestAdminAudit({ db, now: later, from: now, to: later, snapshot: {
        startedAt: later.toISOString(), checkedAt: later.toISOString(), complete: true, rows: [source], pageCount: 1, errors: [],
      } });
      assert.equal((await db.expenseRequestAdminCase.findUniqueOrThrow({ where: { id: row.id } })).notApprovedCycle, 2);
      assert.equal((await loadAdminInbox({ userId: admin.id, limit: 8, view: 'attention', now: later })).attentionCount, 1);
      await db.user.delete({ where: { id: admin.id } });
    });
    await t.test('a newer update while 1C is being read wins over the targeted result', async () => {
      const row = await seed();
      await refreshOneExpenseStatus(row.oneCRequestRef, { db, clock, read: async ref => {
        await db.expenseRequestAdminCase.update({ where: { id: row.id }, data: {
          lastSeenAt: new Date(+now + 1_000), notApprovedCycle: 2, currentStatusKey: 'not_approved',
        } });
        return state(ref);
      } });
      assert.equal((await db.expenseRequestAdminCase.findUniqueOrThrow({ where: { id: row.id } })).isNotApproved, true);
    });
    await t.test('explicit command reconciliation bypasses the background cooldown', async () => {
      const row = await seed();
      await refreshPendingExpenseStatuses({ db, clock, read: async ref => state(ref, 'not_approved') });
      assert.equal(await refreshOneExpenseStatus(row.oneCRequestRef, { db, clock, read: async ref => state(ref) }), 1);
    });
    await t.test('large queue is bounded and rotates instead of retrying the same failures', async () => {
      await seed();
      for (let i = 0; i < 25; i++) await db.expenseRequestAdminCase.create({ data: {
        oneCRequestRef: randomUUID(), isNotApproved: true, deletionMark: false, currentCycleOrigin: 'live', lastSeenAt: new Date(0),
      } });
      const seen = new Set<string>();
      for (let minute = 0; minute < 26; minute++) {
        let reads = 0;
        await refreshPendingExpenseStatuses({ db, clock: () => new Date(+now + minute * 60_000), read: async ref => {
          reads++; seen.add(ref); throw Error('offline');
        } });
        assert.ok(reads <= 10);
      }
      assert.equal(seen.size, 26);
    });
  } finally { await db.$disconnect(); }
});
