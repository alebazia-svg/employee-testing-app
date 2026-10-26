import assert from 'node:assert/strict';
import test from 'node:test';
import { scheduleNoticeRef, scheduleQuestionKind, scheduleQuestionIsActive, datedScheduleNotices, reconcileScheduleQuestions } from '../lib/work-schedule-notifications';
import { notificationTargetKey } from '../lib/workday-notifications';

const date = '2099-10-26';
test('ask missing colleagues; ask known days off only on an explicit loss of coverage', () => {
  const base = { onVacation: false, shortage: true, requestKnownOff: false };
  assert.equal(scheduleQuestionKind(base), 'schedule_fill_request');
  assert.equal(scheduleQuestionKind({ ...base, status: 'off' }), null);
  assert.equal(scheduleQuestionKind({ ...base, status: 'off', requestKnownOff: true }), 'schedule_replacement_request');
  assert.equal(scheduleQuestionKind({ ...base, status: 'working', requestKnownOff: true }), null);
  assert.equal(scheduleQuestionKind({ ...base, onVacation: true }), null);
  assert.equal(scheduleQuestionKind({ ...base, shortage: false }), 'schedule_fill_request');
});
test('filling remains actionable until own answer; replacement retires when coverage is restored', () => {
  const base = { kind: 'schedule_fill_request', onVacation: false, shortage: false, date, today: '2099-10-01' };
  assert.equal(scheduleQuestionIsActive(base), true);
  for (const status of ['working', 'off']) assert.equal(scheduleQuestionIsActive({ ...base, status }), false);
  assert.equal(scheduleQuestionIsActive({ ...base, kind: 'schedule_replacement_request', status: 'off' }), false);
  assert.equal(scheduleQuestionIsActive({ ...base, kind: 'schedule_replacement_request', status: 'off', shortage: true }), true);
  assert.equal(scheduleQuestionIsActive({ ...base, onVacation: true }), false);
  assert.equal(scheduleQuestionIsActive({ ...base, today: '2099-10-27' }), false);
});
test('each date has its own reminder target, future delivery is deferred', () => {
  const row = { id: 1, taskId: null, issueId: null, reviewId: null, kind: 'schedule_fill_request', fingerprint: 'schedule-coverage:retail:2099-10-26:2' };
  assert.deepEqual(scheduleNoticeRef(row.fingerprint), { department: 'retail', date, userId: 2 });
  assert.notEqual(notificationTargetKey(row), notificationTargetKey({ ...row, id: 2, fingerprint: 'schedule-coverage:retail:2099-10-27:2' }));
  assert.notEqual(notificationTargetKey(row), notificationTargetKey({ ...row, fingerprint: 'schedule-coverage:retail:2099-11-01:2' }));
});
test('monthly legacy notice uses audited unchanged reductions and respects date-specific answers', async () => {
  const timestamp = new Date('2099-10-01T08:00:00Z');
  const db = {
    workdayNotification: { findMany: async () => [{ fingerprint: 'schedule-coverage:retail:2099-10-27:2' }] },
    workScheduleEntry: { findMany: async ({ where }: any) => { assert.equal(where.status, 'off'); assert.equal(where.updatedAt.lte, timestamp); return [{ date }, { date: '2099-10-27' }]; } },
    workScheduleChange: {
      findMany: async ({ where }: any) => { assert.equal(where.createdAt.lte, timestamp); return [{ date }, { date: '2099-10-27' }]; },
    },
  };
  const notice = { id: 1, kind: 'schedule_replacement_digest', fingerprint: 'schedule-coverage-digest:retail:2099-10:3:2', title: 'Old digest', readAt: null, scheduledAt: timestamp };
  assert.deepEqual((await datedScheduleNotices(db as never, { id: 2, department: 'retail' }, [notice], '2099-10-01')).map(row => row.date), [date]);
  assert.deepEqual(await datedScheduleNotices(db as never, { id: 4, department: 'retail' }, [notice], '2099-10-01'), []);
});
test('saving does not reset read or declined questions, skips vacation, working and actor; only auto-resolved questions can reopen', async () => {
  const created: any[] = []; const updated: any[] = [];
  const users = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `Пример Сотрудник${i + 1}` }));
  const db = {
    user: { findMany: async () => users },
    workScheduleEntry: { findMany: async () => [{ userId: 1, status: 'off' }, { userId: 2, status: 'working' }, { userId: 3, status: 'off' }, { userId: 8, status: 'off' }] },
    employeeVacation: { findMany: async () => [{ userId: 4 }] },
    workdayNotification: {
      findMany: async () => [
        { id: 50, userId: 5, kind: 'schedule_fill_request', title: 'Old', body: '', status: 'sent', readAt: new Date() },
        { id: 60, userId: 6, kind: 'schedule_fill_request', title: 'Old', body: '', status: 'answered' },
        { id: 80, userId: 8, kind: 'schedule_replacement_request', title: 'Old', body: '', status: 'resolved' },
      ],
      upsert: async ({ create }: any) => { created.push(create); },
      update: async ({ data }: any) => { updated.push(data); },
      updateMany: async () => {},
    },
  };
  await reconcileScheduleQuestions(db as never, { actorId: 1, department: 'retail', date, requestKnownOff: true });
  assert.deepEqual(created.map(row => [row.userId, row.kind]), [[3, 'schedule_replacement_request'], [7, 'schedule_fill_request']]);
  assert.equal(updated.length, 2);
  assert.equal(updated[1].status, 'pending');
  assert.equal(updated[1].readAt, null);
  assert.equal(updated[0].status, undefined);
  assert.equal(updated[0].readAt, undefined);
});
