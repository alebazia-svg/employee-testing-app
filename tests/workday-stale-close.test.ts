import assert from 'node:assert/strict';
import test from 'node:test';
import {
  carriedIssueAdminTitle,
  carriedIssueAgeDays,
  notifyAdminsAboutCarriedWorkdayIssues,
  readStaleWorkdayCloseReason,
  staleWorkdayCloseAuditComment,
  validateStaleWorkdayClose,
} from '../lib/workday-stale-close';

test('stale workday uses stable reason codes and only other needs a comment', () => {
  assert.deepEqual(readStaleWorkdayCloseReason('forgot_close'), {
    code: 'forgot_close', label: 'Забыл закрыть смену', legacy: false,
  });
  assert.equal(validateStaleWorkdayClose({ reason: 'forgot_close', comment: '' }).ok, true);
  assert.deepEqual(validateStaleWorkdayClose({ reason: 'other', comment: '' }), {
    ok: false, error: 'Коротко опишите причину',
  });
  assert.equal(validateStaleWorkdayClose({ reason: 'other', comment: '  Семейная причина  ' }).ok, true);
});

test('cached legacy clients remain compatible but removed reasons are not shown as new choices', () => {
  assert.deepEqual(readStaleWorkdayCloseReason('Забыл закрыть рабочий день'), {
    code: 'forgot_close', label: 'Забыл закрыть смену', legacy: true,
  });
  assert.equal(validateStaleWorkdayClose({ reason: 'Техническая проблема', comment: 'Не загрузилась страница' }).ok, true);
});

test('stale close audit is factual and does not classify the employee', () => {
  assert.equal(staleWorkdayCloseAuditComment({ reasonLabel: 'Не было интернета' }), [
    'Предыдущий рабочий день закрыт позже. Обязательные шаги пропущены.',
    'Причина: Не было интернета.',
  ].join('\n'));
  assert.doesNotMatch(staleWorkdayCloseAuditComment({ reasonLabel: 'Ушёл раньше' }), /НАРУШЕНИЕ/);
});

test('carried issue age is explicit for the admin', () => {
  assert.equal(carriedIssueAgeDays('2026-09-02', '2026-09-03'), 2);
  assert.equal(carriedIssueAgeDays('2026-09-01', '2026-09-03'), 3);
  assert.equal(carriedIssueAdminTitle(2), 'Ошибка открыта второй день');
  assert.equal(carriedIssueAdminTitle(3), 'Ошибка открыта третий день');
});

test('carried issues create idempotent actionable admin inbox events', async () => {
  const events: any[] = [];
  const receipts: any[] = [];
  const db: any = {
    user: {
      findUnique: async () => ({ name: 'Абшаева Зухра' }),
      findMany: async () => [{ id: 1 }, { id: 2 }],
    },
    adminInboxEvent: {
      upsert: async (args: Record<string, any>) => {
        events.push(args);
        return { id: `event-${events.length}` };
      },
    },
    adminInboxReceipt: {
      createMany: async (args: Record<string, unknown>) => { receipts.push(args); },
    },
    adminInboxDelivery: { upsert: async () => undefined },
  };

  await notifyAdminsAboutCarriedWorkdayIssues({
    db,
    employeeId: 7,
    currentDate: '2026-09-03',
    issues: [{ id: 42, originDate: '2026-09-02', title: 'Кредитный чек' }],
    occurredAt: new Date('2026-09-03T07:00:00Z'),
  });

  assert.equal(events[0].where.eventKey, 'workday_issue:carried:42:2026-09-03');
  assert.equal(events[0].create.title, 'Ошибка открыта второй день');
  assert.equal(events[0].create.body, 'Абшаева Зухра · ошибка от 2 сентября · Кредитный чек');
  assert.equal(events[0].create.href, '/admin/workday/issues/42');
  assert.equal((receipts[0].data as unknown[]).length, 2);
});
