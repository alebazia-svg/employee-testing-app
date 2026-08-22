import assert from 'node:assert/strict';
import test from 'node:test';
import { retryCashOperationInOneC } from '@/lib/cash-operation-one-c-retry';

function operation(status: string) {
  return {
    id: 14,
    userId: 7,
    workDayEntryId: 48,
    date: '2026-08-21',
    department: 'retail',
    direction: 'deposit_safe',
    amount: 162000,
    photoPath: 'uploads/photo.jpg',
    comment: '',
    status,
    idempotencyKey: 'c3564726-5261-45ce-b080-4fe68782b1e2',
    oneCDocumentRef: null,
    oneCDocumentNumber: null,
    oneCReceiptDocumentRef: null,
    oneCReceiptDocumentNumber: null,
    oneCError: '1С недоступна',
    oneCCreatedAt: null,
    oneCPostedAt: null,
    createdAt: new Date('2026-08-21T15:26:34.094Z'),
    updatedAt: new Date('2026-08-21T15:26:34.094Z'),
    user: { id: 7, name: 'Ахобекова Залина' },
  };
}

function fakeDb(initialStatus: string) {
  let row = operation(initialStatus);
  return {
    cashOperation: {
      findUnique: async () => row,
      updateMany: async ({ where, data }: any) => {
        if (where.status !== row.status) return { count: 0 };
        row = { ...row, ...data, updatedAt: new Date() };
        return { count: 1 };
      },
      update: async ({ data }: any) => {
        row = { ...row, ...data, updatedAt: new Date() };
        return row;
      },
    },
    userOneCCashboxMapping: {
      findUnique: async () => ({ isActive: true, oneCCashboxRef: 'employee-cashbox' }),
    },
    row: () => row,
  };
}

test('manual takeover prevents automatic retry', async () => {
  const db = fakeDb('manual_in_progress');
  let createCalls = 0;
  const result = await retryCashOperationInOneC(db as any, 14, new Date(), {
    createPair: async () => {
      createCalls += 1;
      return {} as any;
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'manual_control');
  assert.equal(createCalls, 0);
  assert.equal(db.row().status, 'manual_in_progress');
});

test('retry reuses the original idempotency key and saves the complete pair', async () => {
  const db = fakeDb('one_c_error');
  let receivedKey = '';
  let resolved = false;
  const result = await retryCashOperationInOneC(db as any, 14, new Date('2026-08-22T09:00:00.000Z'), {
    getDimensions: async () => ({
      ok: true,
      organizations: [{ ref: 'organization', name: 'ОФФОНИКА' }],
      cashboxes: [{ ref: 'target-cashbox', name: 'Сейф депозитный' }],
    }) as any,
    createPair: async (input) => {
      receivedKey = input.idempotencyKey;
      return {
        ok: true,
        pairComplete: true,
        document: { ref: 'rko-ref', number: 'РКО-1' },
        receiptDocument: { ref: 'pko-ref', number: 'ПКО-1' },
      } as any;
    },
    resolveCarried: async () => {
      resolved = true;
      return { resolvedIds: [], requiredAmount: null, reason: 'no_candidates' as const };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(receivedKey, 'c3564726-5261-45ce-b080-4fe68782b1e2');
  assert.equal(db.row().status, 'posted_1c_pair');
  assert.equal(db.row().oneCDocumentRef, 'rko-ref');
  assert.equal(db.row().oneCReceiptDocumentRef, 'pko-ref');
  assert.equal(resolved, true);
});
