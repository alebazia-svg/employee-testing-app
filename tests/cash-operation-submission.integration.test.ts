import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { claimCashOperationSubmission } from '../lib/cash-operation-submission';

test('independent UUIDs, concurrent tabs and lost responses cannot create another transfer without confirmation',
  { skip: process.env.CASH_DUPLICATE_INTEGRATION !== '1' }, async () => {
  assert.equal(process.env.DATABASE_URL, 'postgresql://preview:schedule-source-local-only@127.0.0.1:55481/cash_duplicate_test_20261030');
  const db = new PrismaClient();
  const ids: number[] = [];
  let photoWrites = 0;
  try {
    const user = await db.user.create({ data: { login: `cash-duplicate-${randomUUID()}`, name: 'Тест инкассации', role: 'EMPLOYEE', department: 'wholesale', passwordHash: 'unused' } });
    ids.push(user.id);
    const day = await db.workDayEntry.create({ data: { userId: user.id, date: '2026-10-30', department: 'wholesale', shiftCode: '09_19', shiftLabel: '09:00–19:00' } });
    const base = { userId: user.id, workDayEntryId: day.id, date: day.date, department: 'wholesale', direction: 'deposit_safe', amount: 310000, comment: '', distinctFromOperationId: null };
    const savePhoto = async () => { photoWrites++; return 'uploads/isolated-test-only.jpg'; };
    const keys = Array.from({ length: 8 }, () => randomUUID());
    const parallel = await Promise.all(keys.map(idempotencyKey => claimCashOperationSubmission(db, { ...base, idempotencyKey }, savePhoto)));
    assert.equal(parallel.filter(r => r.kind === 'created').length, 1);
    assert.equal(parallel.filter(r => r.kind === 'duplicate').length, 7);
    assert.equal(photoWrites, 1, 'rejected duplicate must not even write its second photo');
    const original = parallel.find(r => r.kind === 'created')!;
    assert.ok(original.kind === 'created');
    const operation = original.operation;
    // The same key is only an acknowledgement, including concurrent requests.
    const replay = await Promise.all(Array.from({ length: 4 }, () => claimCashOperationSubmission(db, { ...base, idempotencyKey: operation.idempotencyKey }, savePhoto)));
    assert.ok(replay.every(r => r.kind === 'replay'));
    assert.equal(photoWrites, 1);
    // A queued second draft remains rejected even after a day / a later retry.
    const rejectedKey = keys.find(key => key !== operation.idempotencyKey)!;
    assert.equal((await claimCashOperationSubmission(db, { ...base, idempotencyKey: rejectedKey }, savePhoto)).kind, 'duplicate');
    // Another real physical transfer is possible, but only one confirmation wins.
    const confirmed = await Promise.all(Array.from({ length: 4 }, () => claimCashOperationSubmission(db, { ...base, distinctFromOperationId: operation.id, idempotencyKey: randomUUID() }, savePhoto)));
    assert.equal(confirmed.filter(r => r.kind === 'created').length, 1);
    assert.equal(confirmed.filter(r => r.kind === 'duplicate').length, 3);
    const second = confirmed.find(r => r.kind === 'created')!;
    assert.ok(second.kind === 'created');
    assert.match(second.operation.comment, new RegExp(`№ ${operation.id}`));
    assert.equal((await claimCashOperationSubmission(db, { ...base, amount: 94000, idempotencyKey: randomUUID() }, savePhoto)).kind, 'created');
    assert.equal((await claimCashOperationSubmission(db, { ...base, direction: 'phone_reserve', idempotencyKey: randomUUID() }, savePhoto)).kind, 'created');
    assert.equal((await claimCashOperationSubmission(db, { ...base, amount: 123, distinctFromOperationId: operation.id, idempotencyKey: randomUUID() }, savePhoto)).kind, 'conflict');
    assert.equal((await claimCashOperationSubmission(db, { ...base, amount: 123, idempotencyKey: operation.idempotencyKey }, savePhoto)).kind, 'conflict');
    // Failed local persistence does not leave a durable claim blocking recovery.
    await assert.rejects(claimCashOperationSubmission(db, { ...base, amount: 200, idempotencyKey: randomUUID() }, async () => { throw new Error('photo write failed'); }));
    assert.equal(await db.cashOperation.count({ where: { userId: user.id, amount: 200 } }), 0);
    assert.equal(await db.cashOperation.count({ where: { userId: user.id, amount: 310000, direction: 'deposit_safe' } }), 2);
  } finally { await db.user.deleteMany({ where: { id: { in: ids } } }); await db.$disconnect(); }
});
