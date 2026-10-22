import assert from 'node:assert/strict';
import test from 'node:test';
import { stageFiscalAdminReview, approveFiscalReview, archiveFiscalReviewUnresolved, dismissFiscalReviewAsReconciledDay, fiscalApprovalKey, fiscalArchivedUnresolvedKey, fiscalDayTotalResolutionKey, fiscalProposedRecipients } from '../lib/terminal-fiscal-admin-gate';
import { TERMINAL_FISCAL_OWNER_ARCHIVED_UNRESOLVED, TERMINAL_FISCAL_OWNER_DAY_TOTAL_RESOLVED } from '../lib/terminal-fiscal-day-closure';
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

test('owner-confirmed day total closes the card permanently and records the decision once', async () => {
  const f = fixture();
  await stageFiscalAdminReview(f.db, f.record);
  const id = f.reviews[0].id;
  const first = await dismissFiscalReviewAsReconciledDay(f.db, id, 1);
  assert.equal(first.alreadyResolved, false);
  assert.equal(f.reviews[0].status, 'resolved');
  assert.equal(f.reviews[0].reasonCode, TERMINAL_FISCAL_OWNER_DAY_TOTAL_RESOLVED);
  assert.equal(f.events.filter((event) => event.eventKey === fiscalDayTotalResolutionKey(id)).length, 1);
  await stageFiscalAdminReview(f.db, { ...f.record, evaluatedAt: '2026-09-04T18:00:00Z' });
  assert.equal(f.reviews[0].status, 'resolved');
  assert.equal(f.reviews[0].reasonCode, TERMINAL_FISCAL_OWNER_DAY_TOTAL_RESOLVED);
  assert.equal(f.events.filter((event) => event.eventKey === fiscalDayTotalResolutionKey(id)).length, 1);
  const second = await dismissFiscalReviewAsReconciledDay(f.db, id, 1);
  assert.equal(second.alreadyResolved, true);
});

test('owner can archive an old unresolved review without marking it reconciled or allowing it to reopen', async () => {
  const f = fixture();
  await stageFiscalAdminReview(f.db, f.record);
  const id = f.reviews[0].id;
  f.notifications.push({ reviewId: id, status: 'pending', pushStatus: 'pending', nextPushAttemptAt: new Date() });
  const first = await archiveFiscalReviewUnresolved(f.db, id, 1);
  assert.equal(first.alreadyResolved, false);
  assert.equal(f.reviews[0].status, 'resolved');
  assert.equal(f.reviews[0].reasonCode, TERMINAL_FISCAL_OWNER_ARCHIVED_UNRESOLVED);
  assert.equal(f.notifications[0].status, 'cancelled');
  assert.equal(f.notifications[0].pushStatus, 'cancelled');
  assert.equal(f.notifications[0].nextPushAttemptAt, null);
  assert.equal(f.events.filter((event) => event.eventKey === fiscalArchivedUnresolvedKey(id)).length, 1);
  await stageFiscalAdminReview(f.db, { ...f.record, evaluatedAt: '2026-10-23T18:00:00Z' });
  assert.equal(f.reviews[0].status, 'resolved');
  assert.equal(f.reviews[0].reasonCode, TERMINAL_FISCAL_OWNER_ARCHIVED_UNRESOLVED);
  assert.equal((await archiveFiscalReviewUnresolved(f.db, id, 1)).alreadyResolved, true);
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

test('possible split withdraws an earlier missing-check request and stays ADMIN-only', async () => {
  const f=fixture(); await stageFiscalAdminReview(f.db,f.record);
  const id=f.reviews[0].id;
  await approveFiscalReview(f.db,id,1,[4,5],()=> 'Проверьте чек');
  assert.equal(f.reviews[0].status,'open');
  await stageFiscalAdminReview(f.db,{...f.record,reasonCode:'ONE_C_POSSIBLE_SPLIT_SALE'});
  assert.equal(f.reviews[0].status,'admin_review');
  assert.ok(f.notifications.every(n=>n.status!=='pending'));
  const event=f.events.find(e=>e.eventKey.endsWith(':admin-first'));
  assert.equal(event.title,'Возможное разделение продажи');
  assert.match(event.body,/товары/);
  await assert.rejects(approveFiscalReview(f.db,id,1,[4,5],()=> 'Пробейте чек'),/REVIEW_NOT_AVAILABLE/);
});

test('grouped payments, split receipts and exchanges never forward a generic missing-check task', async () => {
  for (const reasonCode of ['ONE_C_SPLIT_RECEIPTS_REVIEW','ONE_C_COMBINED_PAYMENTS_REVIEW','ONE_C_EXCHANGE_REVIEW'] as const) {
    const f=fixture(); await stageFiscalAdminReview(f.db,f.record);
    const id=f.reviews[0].id;
    await approveFiscalReview(f.db,id,1,[4,5],()=> 'Проверьте чек');
    await stageFiscalAdminReview(f.db,{...f.record,reasonCode});
    assert.equal(f.reviews[0].status,'admin_review');
    assert.ok(f.notifications.every(n=>n.status!=='pending'));
    await assert.rejects(approveFiscalReview(f.db,id,1,[4,5],()=> 'Пробейте чек'),/REVIEW_NOT_AVAILABLE/);
  }
});

test('amount coverage retires an approved employee review and pending reminders without reopening it', async()=>{
 const f=fixture();await stageFiscalAdminReview(f.db,f.record);const id=f.reviews[0].id;
 await approveFiscalReview(f.db,id,1,[4,5],()=> 'existing message');
 f.notifications.forEach(n=>n.status='pending');
 const covered={...f.record,status:'confirmed' as const,reasonCode:'MATCH_AMOUNT_COVERED' as const,oneCCheckKey:undefined,ofdReceiptKey:undefined};
 await stageFiscalAdminReview(f.db,covered);
 assert.equal(f.reviews[0].status,'resolved');assert.ok(f.notifications.every(n=>n.status==='cancelled'));
 const ended=f.reviews[0].resolvedAt;const events=f.events.length;
 await stageFiscalAdminReview(f.db,{...covered,evaluatedAt:'2026-09-03T19:00:00Z'});
 assert.equal(f.reviews[0].resolvedAt,ended);assert.equal(f.events.length,events);assert.equal(f.notifications.length,2);
 f.db.terminalFiscalMatch.findUnique=async()=>({status:'confirmed',reasonCode:'MATCH_AMOUNT_COVERED'});
 await assert.rejects(approveFiscalReview(f.db,id,1,[4,5],()=>''),/REVIEW_NOT_AVAILABLE/);
});
