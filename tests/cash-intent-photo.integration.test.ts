import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { claimCashOperationSubmission } from '../lib/cash-operation-submission';
import { attachCashPhotoChunk, cashPhotoProgress } from '../lib/cash-operation-photo';
import { CASH_PHOTO_CHUNK_BYTES } from '../lib/cash-photo-protocol';
import { retryCashOperationInOneC } from '../lib/cash-operation-one-c-retry';

test('durable intents and original photo resume are independent and preserve request idempotence',
  { skip: process.env.CASH_PHOTO_INTEGRATION !== '1' }, async () => {
  assert.equal(process.env.DATABASE_URL, 'postgresql://preview:schedule-source-local-only@127.0.0.1:55481/cash_photo_test_20261104');
  const db = new PrismaClient(); const root = await mkdtemp(path.join(os.tmpdir(), 'cash-photo-test-'));
  const users: number[] = [];
  try {
    const user = await db.user.create({ data: { login: `photo-${randomUUID()}`, name: 'Изолированный тест', role: 'EMPLOYEE', department: 'wholesale', passwordHash: 'unused' } }); users.push(user.id);
    const day = await db.workDayEntry.create({ data: { userId: user.id, date: '2026-11-04', department: 'wholesale', shiftCode: '09_19', shiftLabel: '09:00–19:00' } });
    const bytes = Buffer.alloc(CASH_PHOTO_CHUNK_BYTES * 2 + 300, 7); bytes.set([0xff, 0xd8, 0xff]);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const input = { userId: user.id, workDayEntryId: day.id, date: day.date, department: 'wholesale', direction: 'deposit_safe', amount: 40000, comment: '', distinctFromOperationId: null,
      intent: { baselineId: null as number | null, photoSha256: hash, photoBytes: bytes.length } };
    const save = async () => '';
    const parallel = await Promise.all(Array.from({ length: 8 }, () => claimCashOperationSubmission(db, { ...input, idempotencyKey: randomUUID() }, save)));
    assert.equal(parallel.filter(r => r.kind === 'created').length, 1);
    assert.equal(parallel.filter(r => r.kind === 'duplicate').length, 7);
    const first = parallel.find(r => r.kind === 'created')!;
    assert.equal(first.kind, 'created'); if (first.kind !== 'created') throw Error('claim');
    const operation = first.operation;
    assert.equal(operation.photoPath, ''); assert.equal(operation.status, 'pending_1c');
    assert.ok(operation.oneCProcessingStartedAt);
    // A new actual transfer from the current screen is valid even at the same amount.
    const second = await claimCashOperationSubmission(db, { ...input, intent: { ...input.intent, baselineId: operation.id }, idempotencyKey: randomUUID() }, save);
    assert.equal(second.kind, 'created');
    for (const patch of [{ amount: 41000 }, { intent: { ...input.intent, photoSha256: 'a'.repeat(64) } }, { workDayEntryId: day.id + 1 }]) {
      assert.equal((await claimCashOperationSubmission(db, { ...input, ...patch, idempotencyKey: operation.idempotencyKey }, save)).kind, 'conflict');
    }
    assert.equal((await claimCashOperationSubmission(db, { ...input, idempotencyKey: operation.idempotencyKey }, save)).kind, 'replay');
    const part = (index: number, overrides = {}) => attachCashPhotoChunk(db, { userId: user.id, idempotencyKey: operation.idempotencyKey, hash, index,
      bytes: bytes.subarray(index * CASH_PHOTO_CHUNK_BYTES, (index + 1) * CASH_PHOTO_CHUNK_BYTES), ...overrides }, root);
    await assert.rejects(part(0, { userId: user.id + 1 }));
    await assert.rejects(part(0, { hash: 'b'.repeat(64) }));
    await assert.rejects(part(99));
    await part(0); await part(0); // Lost response / two tab replay.
    assert.deepEqual((await cashPhotoProgress(operation, root)).receivedChunks, [0]);
    await assert.rejects(part(0, { bytes: Buffer.alloc(CASH_PHOTO_CHUNK_BYTES, 9) }));
    assert.equal((await db.cashOperation.findUniqueOrThrow({ where: { id: operation.id } })).photoPath, '');
    // Photo arriving after the workday and 1C posting does not alter either state.
    await db.workDayEntry.update({ where: { id: day.id }, data: { status: 'completed', endedAt: new Date() } });
    await db.cashOperation.update({ where: { id: operation.id }, data: { status: 'posted_1c_pair', oneCDocumentRef: 'test-rko', oneCReceiptDocumentRef: 'test-pko' } });
    await part(2); const final = await part(1);
    assert.equal(final.complete, true); assert.ok(final.operation.photoReceivedAt);
    assert.deepEqual(await readFile(path.join(root, final.operation.photoPath)), bytes, 'original bytes must remain exact');
    assert.equal(final.operation.status, 'posted_1c_pair');
    assert.equal(final.operation.oneCProcessingStartedAt?.getTime(), operation.oneCProcessingStartedAt?.getTime());
    assert.equal((await part(1)).operation.photoPath, final.operation.photoPath);
    assert.equal(second.kind, 'created'); if (second.kind !== 'created') throw Error('second claim');
    const secondPart = (index: number, changed = false) => attachCashPhotoChunk(db, {
      userId: user.id, idempotencyKey: second.operation.idempotencyKey, hash, index,
      bytes: changed ? Buffer.alloc(CASH_PHOTO_CHUNK_BYTES, 8) : bytes.subarray(index * CASH_PHOTO_CHUNK_BYTES, (index + 1) * CASH_PHOTO_CHUNK_BYTES),
    }, root);
    await secondPart(0, true); await secondPart(1);
    await assert.rejects(secondPart(2), /ошибкой/);
    assert.deepEqual((await cashPhotoProgress(second.operation, root)).receivedChunks, []);
    await secondPart(0); await secondPart(1); await secondPart(2);
    // A photo update must not renew a stuck financial lease. Only an explicit
    // administrator retry can claim it, reusing the original financial key.
    await db.userOneCCashboxMapping.create({ data: { userId: user.id, isActive: true, oneCCashboxRef: 'source', oneCCashboxName: 'test' } });
    const lease = new Date(Date.now() - 660_000);
    await db.cashOperation.update({ where: { id: second.operation.id }, data: { oneCProcessingStartedAt: lease } });
    let writes = 0;
    const retry = await retryCashOperationInOneC(db, second.operation.id, new Date(), {
      getDimensions: async () => ({ ok: true, organizations: [{ ref: 'org', name: 'ОФФОНИКА' }], cashboxes: [{ ref: 'target', name: 'Сейф депозитный' }] }) as any,
      createPair: async request => {
        writes++; assert.equal(request.idempotencyKey, second.operation.idempotencyKey);
        return { ok: true, pairComplete: true, document: { ref: 'test-rko-2', number: '2' }, receiptDocument: { ref: 'test-pko-2', number: '2' } } as any;
      }, resolveCarried: async () => ({ resolvedIds: [], requiredAmount: null, reason: 'approval_is_final' as const }),
    });
    assert.equal(retry.ok, true); assert.equal(writes, 1);
    assert.ok(retry.operation?.photoPath);
    assert.equal(await db.cashOperation.count({ where: { userId: user.id } }), 2);
  } finally { await db.user.deleteMany({ where: { id: { in: users } } }); await db.$disconnect(); await rm(root, { recursive: true, force: true }); }
});
