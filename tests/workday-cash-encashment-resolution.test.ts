import assert from 'node:assert/strict';
import test from 'node:test';
import { requiredCashEncashmentAmount, resolveCarriedCashEncashmentExceptions } from '@/lib/workday-cash-encashment-resolution';

test('required encashment leaves no more than fifty thousand in cashbox', () => {
  assert.equal(requiredCashEncashmentAmount(115_406), 65_406);
  assert.equal(requiredCashEncashmentAmount(50_000), 0);
});

test('a sufficient later encashment resolves all carried exceptions', async () => {
  const updates: Array<{ id: string; status: string; decisionComment: string }> = [];
  const db = {
    workdayCloseExceptionRequest: {
      findMany: async () => [
        { id: 'newer', decisionComment: 'Разрешено.', requestedAt: new Date('2026-08-20T18:00:00Z'), workDayEntry: { date: '2026-08-20', shiftControlRun: { tasks: [{ handoverData: { personalCash: { cashBalance: 115_406 } } }] } } },
        { id: 'older', decisionComment: '', requestedAt: new Date('2026-08-19T18:00:00Z'), workDayEntry: { date: '2026-08-19', shiftControlRun: { tasks: [{ handoverData: { personalCash: { cashBalance: 100_000 } } }] } } },
      ],
      update: async ({ where, data }: { where: { id: string }; data: { status: string; decisionComment: string } }) => {
        updates.push({ id: where.id, ...data });
      },
    },
  };

  const result = await resolveCarriedCashEncashmentExceptions(db as never, {
    employeeId: 7,
    operationId: 12,
    operationDate: '2026-08-21',
    operationAmount: 70_000,
    operationCreatedAt: new Date('2026-08-21T15:00:00Z'),
  });

  assert.deepEqual(result.resolvedIds, ['newer', 'older']);
  assert.equal(result.requiredAmount, 65_406);
  assert.equal(updates.length, 2);
  assert.equal(updates[0].status, 'resolved');
  assert.match(updates[0].decisionComment, /инкассацией 2026-08-21/);
});

test('a partial encashment keeps the exception active', async () => {
  let updated = false;
  const db = {
    workdayCloseExceptionRequest: {
      findMany: async () => [
        { id: 'request', decisionComment: '', requestedAt: new Date('2026-08-20T18:00:00Z'), workDayEntry: { date: '2026-08-20', shiftControlRun: { tasks: [{ handoverData: { personalCash: { cashBalance: 115_406 } } }] } } },
      ],
      update: async () => { updated = true; },
    },
  };

  const result = await resolveCarriedCashEncashmentExceptions(db as never, {
    employeeId: 7,
    operationId: 13,
    operationDate: '2026-08-21',
    operationAmount: 20_000,
    operationCreatedAt: new Date('2026-08-21T15:00:00Z'),
  });

  assert.equal(result.reason, 'insufficient_amount');
  assert.equal(result.requiredAmount, 65_406);
  assert.equal(updated, false);
});

test('completed legacy workdays are eligible even when consumedAt was not recorded', async () => {
  let capturedWhere: unknown = null;
  const db = {
    workdayCloseExceptionRequest: {
      findMany: async ({ where }: { where: unknown }) => {
        capturedWhere = where;
        return [];
      },
    },
  };

  await resolveCarriedCashEncashmentExceptions(db as never, {
    employeeId: 7,
    operationId: 14,
    operationDate: '2026-08-21',
    operationAmount: 162_000,
    operationCreatedAt: new Date('2026-08-21T15:26:34.094Z'),
  });

  assert.deepEqual((capturedWhere as { OR: unknown }).OR, [
    { consumedAt: { not: null } },
    { workDayEntry: { status: 'completed' } },
  ]);
});
