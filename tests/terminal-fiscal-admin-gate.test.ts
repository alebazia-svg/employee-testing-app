import assert from 'node:assert/strict';
import test from 'node:test';
import { stageFiscalAdminReview, approveFiscalReview, fiscalApprovalKey, fiscalProposedRecipients } from '../lib/terminal-fiscal-admin-gate';
import type { MatchingAuditRecord } from '../lib/terminal-fiscal-matching';

function fixture() {
  const reviews: any[] = [], events: any[] = [], notifications: any[] = [], participants: any[] = [];
  const upsert = (rows: any[], key: string) => async ({ where, create, update }: any) => {
    const old = rows.find((r) => r[key] === where[key]);
    if (old) return Object.assign(old, update);
    const row = { id: `${key}-${rows.length}`, ...create }; rows.push(row); return row;
  };
  const db: any = {
    user: { findMany: async () => [{ id: 1 }], findFirst: async ({ where }: any) => where.id === 1 ? { id: 1 } : null },
    terminalFiscalEmployeeReview: {
      findUnique: async ({ where }: any) => reviews.find((r) => where.id ? r.id === where.id : r.reviewKey === where.reviewKey) ?? null,
      upsert: upsert(reviews, 'reviewKey'),
      update: async ({ where, data }: any) => Object.assign(reviews.find((r) => r.id === where.id), data),
      updateMany: async ({ where, data }: any) => { const rows = reviews.filter((r) => r.id === where.id && r.status === where.status); rows.forEach((r) => Object.assign(r, data)); return { count: rows.length }; },
    },
    adminInboxEvent: { upsert: upsert(events, 'eventKey'), findUnique: async ({ where }: any) => events.find((r) => r.eventKey === where.eventKey) ?? null },
    adminInboxReceipt: { createMany: async () => ({ count: 1 }) },
    workdayNotification: { upsert: upsert(notifications, 'fingerprint'), updateMany: async ({ where, data }: any) => { notifications.filter((r) => r.reviewId === where.reviewId && r.status === where.status).forEach((r) => Object.assign(r, data)); return { count: 0 }; } },
    terminalFiscalReviewParticipant: { deleteMany: async () => { participants.length = 0; }, createMany: async ({ data }: any) => participants.push(...data) },
    terminalFiscalMatch: { findUnique: async () => null },
    workDayEntry: { findMany: async () => [4,5].map((userId) => ({ userId, startedAt: new Date('2026-09-02T14:00Z'), endedAt: null, user: { name: `Сотрудник ${userId}` } })) },
    $transaction: async (fn: any) => fn(db),
  };
  const record = { matchingKey: 'sample', mappingId: 'map', status: 'needs_review', reasonCode: 'ONE_C_CANDIDATE_NOT_FOUND', operationType: 'sale',
    amountKopecks: 30000, evaluatedAt: '2026-09-03T18:00:00Z', evidence: { bankTransactionDate: '2026-09-02T13:02:09Z' } } as MatchingAuditRecord;
  return { db, record, reviews, events, notifications, participants };
}

test('missing and incomplete checks go to ADMIN only, without duplicate events', async () => {
  const f = fixture();
  await stageFiscalAdminReview(f.db, f.record);
  await stageFiscalAdminReview(f.db, { ...f.record, status: 'unavailable', reasonCode: 'SOURCE_OFD_INCOMPLETE' });
  assert.equal(f.reviews.length, 1); assert.equal(f.events.length, 1);
  assert.equal(f.reviews[0].status, 'admin_review'); assert.equal(f.reviews[0].employeeId, 1);
  assert.equal(f.notifications.length, 0); assert.equal(f.participants.length, 0);
});
test('no alert before fifteen minutes and no alert for confirmed payment', async () => {
  const f = fixture();
  await stageFiscalAdminReview(f.db, { ...f.record, evaluatedAt: '2026-09-02T13:10:00Z' });
  await stageFiscalAdminReview(f.db, { ...f.record, status: 'confirmed' });
  assert.equal(f.events.length, 0);
});
test('one explicit approval notifies the displayed day participants once', async () => {
  const f = fixture(); await stageFiscalAdminReview(f.db, f.record);
  const id = f.reviews[0].id;
  await approveFiscalReview(f.db, id, 1, [4,5], () => 'standard copy');
  await approveFiscalReview(f.db, id, 1, [4,5], () => 'standard copy');
  assert.equal(f.notifications.length, 2); assert.equal(f.participants.length, 2);
  assert.equal(f.reviews[0].status, 'open'); assert.equal(f.reviews[0].assignmentScope, 'retail_day');
  assert.equal(f.events.filter((e) => e.eventKey === fiscalApprovalKey(id)).length, 1);
  await stageFiscalAdminReview(f.db, f.record);
  assert.equal(f.reviews[0].status, 'open'); assert.equal(f.notifications.length, 2);
});
test('changed recipients, no shift and non-admin cannot forward', async () => {
  const f = fixture(); await stageFiscalAdminReview(f.db, f.record); const id = f.reviews[0].id;
  await assert.rejects(approveFiscalReview(f.db, id, 5, [4,5], () => ''), /FORBIDDEN/);
  await assert.rejects(approveFiscalReview(f.db, id, 1, [4], () => ''), /RECIPIENTS_CHANGED/);
  f.db.workDayEntry.findMany = async () => [];
  await assert.rejects(approveFiscalReview(f.db, id, 1, [], () => ''), /NO_RECIPIENTS/);
  assert.equal(f.notifications.length, 0);
});
test('receipt found before click prevents a duplicate-check request', async () => {
  const f = fixture(); await stageFiscalAdminReview(f.db, f.record);
  f.db.terminalFiscalMatch.findUnique = async () => ({ oneCSourceRef: 'found', status: 'unavailable' });
  await assert.rejects(approveFiscalReview(f.db, f.reviews[0].id, 1, [4,5], () => ''), /CHECK_ALREADY_EXISTS/);
  assert.equal(f.notifications.length, 0);
});
test('confirmed match resolves staged review without employee delivery', async () => {
  const f = fixture(); await stageFiscalAdminReview(f.db, f.record);
  await stageFiscalAdminReview(f.db, { ...f.record, status: 'confirmed' });
  assert.equal(f.reviews[0].status, 'resolved'); assert.equal(f.notifications.length, 0);
});

function routingDb(input: {
  target: string;
  workers: Array<{ id: number; name: string; home: string | null }>;
  assignedUserId?: number;
}) {
  const at = new Date('2026-09-10T10:00:00.000Z');
  return { at, db: {
    workDayEntry: { findMany: async () => input.workers.map((worker) => ({
      userId: worker.id, startedAt: new Date('2026-09-10T06:00:00.000Z'), endedAt: null, user: { name: worker.name },
    })) },
    terminalFiscalMapping: {
      findUnique: async () => ({ oneCCashRegisterRef: input.target }),
      findMany: async () => [{ oneCCashRegisterRef: 'kkm-zukhra' }, { oneCCashRegisterRef: 'kkm-milana' }],
    },
    workdayKkmAssignment: { findMany: async () => input.assignedUserId ? [{ userId: input.assignedUserId }] : [] },
    userOneCCashboxMapping: { findMany: async () => input.workers.map((worker) => ({ userId: worker.id, oneCCashRegisterRef: worker.home })) },
  } as any };
}

test('proposes the fixed employee when her home workstation is active', async () => {
  const f = routingDb({ target: 'kkm-zukhra', workers: [
    { id: 2, name: 'Зухра', home: 'kkm-zukhra' }, { id: 3, name: 'Магомед', home: null },
  ] });
  const result = await fiscalProposedRecipients(f.db, f.at, 'mapping-zukhra');
  assert.equal(result.confidence, 'high');
  assert.equal(result.reason, 'home_workstation');
  assert.equal(result.primary?.name, 'Зухра');
  assert.deepEqual(result.users.map((user) => user.name), ['Зухра', 'Магомед']);
});

test('proposes the floating employee for the absent fixed employee workstation', async () => {
  const f = routingDb({ target: 'kkm-zukhra', workers: [
    { id: 1, name: 'Милана', home: 'kkm-milana' }, { id: 3, name: 'Магомед', home: null },
  ] });
  const result = await fiscalProposedRecipients(f.db, f.at, 'mapping-zukhra');
  assert.equal(result.confidence, 'high');
  assert.equal(result.reason, 'floating_employee');
  assert.equal(result.primary?.name, 'Магомед');
  assert.deepEqual(result.users.map((user) => user.name), ['Магомед', 'Милана']);
});

test('manual KKM assignment wins and nonstandard staffing stays shared', async () => {
  const assigned = routingDb({ target: 'kkm-zukhra', assignedUserId: 3, workers: [
    { id: 2, name: 'Зухра', home: 'kkm-zukhra' }, { id: 3, name: 'Магомед', home: null },
  ] });
  assert.equal((await fiscalProposedRecipients(assigned.db, assigned.at, 'mapping-zukhra')).primary?.name, 'Магомед');
  const uncertain = routingDb({ target: 'kkm-zukhra', workers: [
    { id: 1, name: 'Милана', home: 'kkm-milana' }, { id: 2, name: 'Зухра', home: 'kkm-zukhra' }, { id: 3, name: 'Магомед', home: null },
  ] });
  const result = await fiscalProposedRecipients(uncertain.db, uncertain.at, 'mapping-zukhra');
  assert.equal(result.confidence, 'uncertain');
  assert.equal(result.primary, null);
});
