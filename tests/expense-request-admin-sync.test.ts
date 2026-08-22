import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { syncExpenseRequestAdminAudit } from '../lib/expense-request-admin-sync';
import { claimAdminInboxTelegramDelivery, markAdminInboxTelegramDeliverySent } from '../lib/admin-inbox-delivery';
import type { ExpenseRequestSnapshot, ExpenseRequestSourceRow } from '../lib/expense-request-source';

function sourceRow(statusKey = 'not_approved'): ExpenseRequestSourceRow {
  return {
    ref: 'request-1', number: 'REQ-1', date: '2026-08-17T10:00:00+03:00', amount: 1000,
    status: { key: statusKey, name: statusKey === 'not_approved' ? 'Не согласована' : 'К оплате' },
    requested_by: { ref: 'manager-1', name: 'Менеджер' }, comment: 'Доставка товара',
    completeness: { complete: true }, supporting_documents: { complete: true, rows: [] },
    attached_files: { complete: true, rows: [] }, execution: { complete: true, state: 'not_executed' },
  };
}

function snapshot(row: ExpenseRequestSourceRow, checkedAt = '2026-08-17T07:00:00Z'): ExpenseRequestSnapshot {
  return { rows: [row], complete: true, checkedAt, pageCount: 1, errors: [] };
}

function fakeDb() {
  const runs = new Map<string, Record<string, any>>();
  const cases = new Map<string, Record<string, any>>();
  const evaluations = new Map<string, Record<string, any>>();
  const inboxEvents = new Map<string, Record<string, any>>();
  const inboxReceipts = new Map<string, Record<string, any>>();
  const inboxDeliveries = new Map<string, Record<string, any>>();
  let runSequence = 0;
  let caseSequence = 0;
  let evaluationSequence = 0;
  let client: PrismaClient;
  client = {
    $transaction: async (callback: any) => callback(client),
    user: {
      findMany: async () => [{ id: 1 }],
    },
    adminInboxEvent: {
      upsert: async ({ where, create }: any) => {
        const prior = inboxEvents.get(where.eventKey);
        const value = prior ?? { id: `event-${inboxEvents.size + 1}`, ...create };
        inboxEvents.set(where.eventKey, value);
        return value;
      },
    },
    adminInboxReceipt: {
      createMany: async ({ data }: any) => {
        let count = 0;
        for (const row of data) {
          const key = `${row.eventId}:${row.userId}`;
          if (!inboxReceipts.has(key)) { inboxReceipts.set(key, { id: `receipt-${inboxReceipts.size + 1}`, ...row, readAt: null }); count += 1; }
        }
        return { count };
      },
    },
    adminInboxDelivery: {
      upsert: async ({ where, create }: any) => {
        const input = where.eventId_channel_recipientKey;
        const key = `${input.eventId}:${input.channel}:${input.recipientKey}`;
        const value = inboxDeliveries.get(key) ?? { id: `delivery-${inboxDeliveries.size + 1}`, status: 'pending', ...create };
        inboxDeliveries.set(key, value);
        return value;
      },
      findFirst: async ({ where }: any) => {
        const value = [...inboxDeliveries.values()].find((row) => row.channel === where.channel && row.recipientKey === where.recipientKey && row.status === where.status);
        if (!value) return null;
        const event = [...inboxEvents.values()].find((row) => row.id === value.eventId);
        return { ...value, event };
      },
      updateMany: async ({ where, data }: any) => {
        const entry = [...inboxDeliveries.entries()].find(([, value]) => value.id === where.id && (!where.status || value.status === where.status) && (!where.leaseToken || value.leaseToken === where.leaseToken));
        if (!entry) return { count: 0 };
        const next = { ...entry[1], ...data };
        if (data.attemptCount?.increment) next.attemptCount = Number(entry[1].attemptCount ?? 0) + data.attemptCount.increment;
        inboxDeliveries.set(entry[0], next);
        return { count: 1 };
      },
    },
    expenseRequestSyncRun: {
      findUnique: async ({ where }: any) => runs.get(where.runKey) ?? null,
      findUniqueOrThrow: async ({ where }: any) => { const value = runs.get(where.runKey); if (!value) throw new Error('missing'); return value; },
      create: async ({ data }: any) => { const value = { id: `run-${++runSequence}`, createdCaseCount: 0, updatedCaseCount: 0, evaluationCount: 0, newNotApprovedCount: 0, ...data }; runs.set(data.runKey, value); return value; },
      update: async ({ where, data }: any) => { const entry = [...runs.entries()].find(([, value]) => value.id === where.id); if (!entry) throw new Error('missing run'); const value = { ...entry[1], ...data }; runs.set(entry[0], value); return value; },
    },
    expenseRequestAdminCase: {
      findUnique: async ({ where }: any) => cases.get(where.oneCRequestRef) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const prior = cases.get(where.oneCRequestRef);
        const value = prior ? { ...prior, ...update } : { id: `case-${++caseSequence}`, ...create };
        cases.set(where.oneCRequestRef, value);
        return value;
      },
    },
    expenseRequestAdminEvaluation: {
      findUnique: async ({ where }: any) => { const key = where.caseId_notApprovedCycle_sourceHash_ruleVersion; return evaluations.get(`${key.caseId}:${key.notApprovedCycle}:${key.sourceHash}:${key.ruleVersion}`) ?? null; },
      upsert: async ({ where, create }: any) => {
        const input = where.caseId_notApprovedCycle_sourceHash_ruleVersion;
        const key = `${input.caseId}:${input.notApprovedCycle}:${input.sourceHash}:${input.ruleVersion}`;
        const value = evaluations.get(key) ?? { id: `evaluation-${++evaluationSequence}`, createdAt: new Date(), ...create };
        evaluations.set(key, value);
        return value;
      },
      findFirst: async ({ where }: any) => [...evaluations.values()].filter((value) => value.caseId === where.caseId).at(-1) ?? null,
    },
  } as unknown as PrismaClient;
  return {
    state: { runs, cases, evaluations, inboxEvents, inboxReceipts, inboxDeliveries },
    client,
  };
}

test('sync is idempotent and reopens one unread cycle after returning to not_approved', async () => {
  const db = fakeDb();
  const firstPeriod = { from: new Date('2026-08-17T00:00:00Z'), to: new Date('2026-08-17T08:00:00Z') };
  const first = await syncExpenseRequestAdminAudit({ ...firstPeriod, snapshot: snapshot(sourceRow()), now: new Date('2026-08-17T07:00:00Z'), db: db.client });
  assert.equal(first.createdCases, 1);
  assert.equal(first.newNotApproved, 1);
  assert.equal(db.state.cases.size, 1);
  assert.equal(db.state.evaluations.size, 1);
  assert.equal(db.state.inboxEvents.size, 1);
  assert.equal(db.state.inboxReceipts.size, 1);

  const replay = await syncExpenseRequestAdminAudit({ ...firstPeriod, snapshot: snapshot(sourceRow()), now: new Date('2026-08-17T07:01:00Z'), db: db.client });
  assert.equal(replay.idempotentReplay, true);
  assert.equal(db.state.cases.size, 1);
  assert.equal(db.state.evaluations.size, 1);
  assert.equal(db.state.inboxEvents.size, 1);

  const caseRow = db.state.cases.get('request-1')!;
  caseRow.seenAt = new Date('2026-08-17T07:02:00Z'); caseRow.seenById = 1;
  caseRow.reviewedAt = new Date('2026-08-17T07:03:00Z'); caseRow.reviewedById = 1;
  const payable = await syncExpenseRequestAdminAudit({
    ...firstPeriod, snapshot: snapshot(sourceRow('payable'), '2026-08-17T08:10:00Z'),
    now: new Date('2026-08-17T08:10:00Z'), db: db.client,
  });
  assert.equal(payable.newNotApproved, 0);
  assert.equal(db.state.cases.get('request-1')?.isNotApproved, false);

  const returned = await syncExpenseRequestAdminAudit({
    ...firstPeriod, snapshot: snapshot(sourceRow('not_approved'), '2026-08-17T09:10:00Z'),
    now: new Date('2026-08-17T09:10:00Z'), db: db.client,
  });
  assert.equal(returned.newNotApproved, 1);
  assert.equal(db.state.cases.get('request-1')?.notApprovedCycle, 2);
  assert.equal(db.state.cases.get('request-1')?.currentCycleOrigin, 'live');
  assert.equal(db.state.cases.get('request-1')?.seenAt, null);
  assert.equal(db.state.cases.get('request-1')?.reviewedAt, null);
  assert.equal(db.state.cases.size, 1);
  assert.equal(db.state.evaluations.size, 3);
  assert.equal(db.state.inboxEvents.size, 2);
  assert.equal(db.state.inboxReceipts.size, 2);
});

test('baseline creates cases and evaluations without inbox events', async () => {
  const db = fakeDb();
  const result = await syncExpenseRequestAdminAudit({
    from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-01-31T00:00:00Z'),
    snapshot: snapshot(sourceRow(), '2026-08-17T10:00:00Z'), baseline: true,
    now: new Date('2026-08-17T10:00:00Z'), db: db.client,
  });
  assert.equal(result.createdCases, 1);
  assert.equal(result.newNotApproved, 0);
  assert.equal(db.state.cases.size, 1);
  assert.equal(db.state.evaluations.size, 1);
  assert.equal(db.state.inboxEvents.size, 0);
  assert.ok(db.state.cases.get('request-1')?.seenAt);
  assert.equal(db.state.cases.get('request-1')?.currentCycleOrigin, 'baseline');
});

test('baseline cycle stays historical until status leaves and returns during live sync', async () => {
  const db = fakeDb();
  const period = { from: new Date('2026-02-01T00:00:00Z'), to: new Date('2026-03-01T00:00:00Z') };
  await syncExpenseRequestAdminAudit({ ...period, snapshot: snapshot(sourceRow(), '2026-08-17T10:00:00Z'), baseline: true, now: new Date('2026-08-17T10:00:00Z'), db: db.client });
  await syncExpenseRequestAdminAudit({ ...period, snapshot: snapshot(sourceRow(), '2026-08-17T10:01:00Z'), now: new Date('2026-08-17T10:01:00Z'), db: db.client });
  assert.equal(db.state.cases.get('request-1')?.currentCycleOrigin, 'baseline');
  assert.equal(db.state.inboxEvents.size, 0);
  await syncExpenseRequestAdminAudit({ ...period, snapshot: snapshot(sourceRow('payable'), '2026-08-17T10:02:00Z'), now: new Date('2026-08-17T10:02:00Z'), db: db.client });
  await syncExpenseRequestAdminAudit({ ...period, snapshot: snapshot(sourceRow(), '2026-08-17T10:03:00Z'), now: new Date('2026-08-17T10:03:00Z'), db: db.client });
  assert.equal(db.state.cases.get('request-1')?.currentCycleOrigin, 'live');
  assert.equal(db.state.cases.get('request-1')?.notApprovedCycle, 2);
  assert.equal(db.state.inboxEvents.size, 1);
});

test('telegram delivery is queued once only for a new live cycle when explicitly enabled', async () => {
  const db = fakeDb();
  const period = { from: new Date('2026-08-17T00:00:00Z'), to: new Date('2026-08-18T00:00:00Z') };
  await syncExpenseRequestAdminAudit({ ...period, snapshot: snapshot(sourceRow()), queueTelegramDelivery: true, now: new Date('2026-08-17T10:00:00Z'), db: db.client });
  await syncExpenseRequestAdminAudit({ ...period, snapshot: snapshot(sourceRow(), '2026-08-17T10:01:00Z'), queueTelegramDelivery: true, now: new Date('2026-08-17T10:01:00Z'), db: db.client });
  assert.equal(db.state.inboxEvents.size, 1);
  assert.equal(db.state.inboxDeliveries.size, 1);
});

test('incomplete source records the run but never creates, closes or notifies cases', async () => {
  const db = fakeDb();
  const period = { from: new Date('2026-08-17T00:00:00Z'), to: new Date('2026-08-18T00:00:00Z') };
  const incomplete = { ...snapshot(sourceRow()), complete: false, errors: ['SOURCE_UNAVAILABLE'] };
  const result = await syncExpenseRequestAdminAudit({ ...period, snapshot: incomplete, queueTelegramDelivery: true, now: new Date('2026-08-17T10:00:00Z'), db: db.client });
  assert.equal(result.sourceComplete, false);
  assert.equal(result.createdCases, 0);
  assert.equal(result.updatedCases, 0);
  assert.equal(result.newNotApproved, 0);
  assert.equal(db.state.cases.size, 0);
  assert.equal(db.state.inboxEvents.size, 0);
  assert.equal(db.state.inboxDeliveries.size, 0);
  assert.equal([...db.state.runs.values()][0]?.status, 'incomplete');
});

test('telegram claim is leased once and sent state is independent from inbox read state', async () => {
  const db = fakeDb();
  const period = { from: new Date('2026-08-17T00:00:00Z'), to: new Date('2026-08-18T00:00:00Z') };
  await syncExpenseRequestAdminAudit({ ...period, snapshot: snapshot(sourceRow()), queueTelegramDelivery: true, now: new Date('2026-08-17T10:00:00Z'), db: db.client });
  const claim = await claimAdminInboxTelegramDelivery(db.client, new Date('2026-08-17T10:01:00Z'));
  assert.ok(claim);
  assert.match(claim.text, /Новая заявка на расход\nЗаявитель: Менеджер\nСумма: 1 000 ₽/);
  assert.match(claim.text, /Комментарий: Доставка товара/);
  assert.match(claim.href, /^\/admin\/inbox\/open\//);
  assert.equal(await claimAdminInboxTelegramDelivery(db.client, new Date('2026-08-17T10:02:00Z')), null);
  await markAdminInboxTelegramDeliverySent({ db: db.client, deliveryId: claim.deliveryId, leaseToken: claim.leaseToken, externalMessageId: '123' });
  assert.equal([...db.state.inboxDeliveries.values()][0]?.status, 'sent');
  assert.equal([...db.state.inboxReceipts.values()][0]?.readAt, null);
});
