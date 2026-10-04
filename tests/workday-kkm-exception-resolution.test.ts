import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveObsoleteKkmRequests } from '../lib/workday-kkm-exception-resolution';
import { simulateKkmShiftClose, syncKkmShiftCloseIssue } from '../lib/kkm-shift-close-control';

function fixture(statuses: string[], requestStatus = 'pending') {
  const request = { id: 'r1', issueIds: [10, 11], status: requestStatus };
  const db: any = {
    workdayCloseExceptionRequest: {
      findMany: async ({ where }: any) => {
        assert.equal(where.employeeId, 1);
        assert.equal(where.status, 'pending');
        assert.equal(where.NOT.reasonCode.startsWith, 'cash_encashment_');
        return request.status === 'pending' ? [request] : [];
      },
      updateMany: async ({ where, data }: any) => {
        assert.equal(where.status, 'pending');
        if (request.status !== where.status) return { count: 0 };
        request.status = data.status;
        return { count: 1 };
      },
    },
    workdayControlIssue: { findMany: async ({ where }: any) => {
      assert.equal(where.userId, 1);
      return statuses.map((status, index) => ({ id: 10 + index, status }));
    } },
  };
  return { db, request };
}

test('resolves only when every referenced issue is confirmed resolved, idempotently', async () => {
  const { db, request } = fixture(['resolved', 'resolved']);
  assert.equal(await resolveObsoleteKkmRequests(db, 1, 10), 1);
  assert.equal(request.status, 'resolved');
  assert.equal(await resolveObsoleteKkmRequests(db, 1, 10), 0);
});
for (const statuses of [['resolved', 'open'], ['resolved'], ['resolved', 'dismissed']]) {
  test(`keeps request when evidence is incomplete: ${statuses}`, async () => {
    const { db, request } = fixture(statuses);
    assert.equal(await resolveObsoleteKkmRequests(db, 1, 10), 0);
    assert.equal(request.status, 'pending');
  });
}
for (const status of ['approved', 'rejected']) {
  test(`preserves administrator decision ${status}`, async () => {
    const { db, request } = fixture(['resolved', 'resolved'], status);
    assert.equal(await resolveObsoleteKkmRequests(db, 1, 10), 0);
    assert.equal(request.status, status);
  });
}
test('does not resolve an unrelated request', async () => {
  const { db } = fixture(['resolved', 'resolved']);
  assert.equal(await resolveObsoleteKkmRequests(db, 1, 20), 0);
});
test('does not overwrite an administrator decision made during reconciliation', async () => {
  const { db, request } = fixture(['resolved', 'resolved']);
  const find = db.workdayControlIssue.findMany;
  db.workdayControlIssue.findMany = async (args: any) => {
    request.status = 'approved';
    return find(args);
  };
  assert.equal(await resolveObsoleteKkmRequests(db, 1, 10), 0);
  assert.equal(request.status, 'approved');
});

test('real KKM recovery resolves its pending request without closing the workday', async () => {
  const { db, request } = fixture(['resolved', 'resolved']);
  const now = new Date('2026-10-04T17:20:00Z');
  let issueStatus = 'open';
  db.workdayControlIssue.findUnique = async () => ({ id: 10, status: issueStatus });
  db.workdayControlIssue.update = async ({ data }: any) => { issueStatus = data.status; };
  db.workdayNotification = { updateMany: async () => ({ count: 1 }) };
  // Deliberately no workDayEntry writer: recovery must not finish the shift.
  await syncKkmShiftCloseIssue(db, {
    userId: 1, taskId: 1, workDayEntryId: 1, date: '2026-10-04', now,
    evidence: simulateKkmShiftClose({ scenario: 'confirmed', activatedAt: now.toISOString() }, now),
  });
  assert.equal(issueStatus, 'resolved');
  assert.equal(request.status, 'resolved');
});
