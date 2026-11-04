import 'server-only';
import type { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, writeFile, rename, readdir, unlink, rmdir } from 'fs/promises';
import path from 'path';
import { cashPhotoChunkLength, CASH_PHOTO_CHUNK_BYTES } from './cash-photo-protocol';
import { validateEmployeeImage } from './image-upload';

type PhotoOperation = { id: number; photoPath: string; photoExpectedBytes: number | null; photoExpectedSha256: string | null };
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const directoryFor = (root: string, id: number) => path.join(root, 'uploads', '.cash-photo-parts', String(id));

export async function cashPhotoProgress(operation: PhotoOperation, root = process.cwd()) {
  if (operation.photoPath || !operation.photoExpectedBytes) return { receivedChunks: [] as number[], complete: Boolean(operation.photoPath) };
  const names = await readdir(directoryFor(root, operation.id)).catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'ENOENT') return []; throw e;
  });
  return { complete: false, receivedChunks: names.filter(n => /^\d+\.part$/.test(n))
    .map(n => Number(n.split('.')[0])).filter(i => cashPhotoChunkLength(operation.photoExpectedBytes!, i) !== null) };
}

/** All retries target the same owned operation. This handler never calls 1C.
 * The DB lock covers chunk replacement/finalization across workers and tabs.
 */
export async function attachCashPhotoChunk(db: PrismaClient, input: {
  userId: number; idempotencyKey: string; hash: string; index: number; bytes: Uint8Array;
}, root = process.cwd()) {
  const result = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106261, ${input.userId}::integer)`;
    const operation = await tx.cashOperation.findFirst({ where: { userId: input.userId, idempotencyKey: input.idempotencyKey } });
    if (!operation || !operation.photoExpectedBytes || operation.photoExpectedSha256 !== input.hash) throw new Error('Фото не относится к этой инкассации.');
    const expectedLength = cashPhotoChunkLength(operation.photoExpectedBytes, input.index);
    if (expectedLength === null || input.bytes.byteLength !== expectedLength) throw new Error('Повреждён фрагмент фото.');
    if (operation.photoPath) return { operation, receivedChunks: [], complete: true };
    const directory = directoryFor(root, operation.id);
    await mkdir(directory, { recursive: true });
    const part = path.join(directory, `${input.index}.part`);
    // A lost HTTP response can resend a part, but cannot replace its bytes.
    const existing = await readFile(part).catch((e: NodeJS.ErrnoException) => { if (e.code === 'ENOENT') return null; throw e; });
    if (existing) {
      if (sha256(existing) !== sha256(input.bytes)) throw new Error('Фрагмент фото изменился. Сохранённое фото не заменено.');
    } else {
      const stagedPart = path.join(directory, `${input.index}-${randomUUID()}.incoming`);
      await writeFile(stagedPart, input.bytes);
      await rename(stagedPart, part);
    }
    const progress = await cashPhotoProgress(operation, root);
    const count = Math.ceil(operation.photoExpectedBytes / CASH_PHOTO_CHUNK_BYTES);
    if (progress.receivedChunks.length < count) return { operation, ...progress };
    const parts = await Promise.all(Array.from({ length: count }, (_, i) => readFile(path.join(directory, `${i}.part`))));
    const bytes = Buffer.concat(parts);
    if (bytes.length !== operation.photoExpectedBytes || sha256(bytes) !== operation.photoExpectedSha256) {
      // Only this operation's temporary parts are removed. Original/local evidence remains.
      await Promise.all(parts.map((_, i) => unlink(path.join(directory, `${i}.part`))));
      throw new Error('Фото загрузилось с ошибкой. Оно сохранено на телефоне и будет отправлено ещё раз.');
    }
    const mime = bytes[0] === 0xff ? 'image/jpeg' : bytes[0] === 0x89 ? 'image/png' : 'image/webp';
    const format = await validateEmployeeImage(new File([bytes], 'cash-photo', { type: mime }));
    const targetDirectory = path.join(root, 'uploads', 'cash-operations', String(operation.workDayEntryId));
    await mkdir(targetDirectory, { recursive: true });
    const target = path.join(targetDirectory, `${operation.direction}-${operation.idempotencyKey}.${format.extension}`);
    const staged = path.join(directory, 'complete');
    await writeFile(staged, bytes);
    await rename(staged, target);
    const saved = await tx.cashOperation.update({ where: { id: operation.id }, data: {
      photoPath: path.relative(root, target).replace(/\\/g, '/'), photoReceivedAt: new Date(),
    } });
    // Keep acknowledged chunks until the DB transaction commits. A rollback or
    // worker crash is recoverable by repeating the final chunk with the same key.
    return { operation: saved, receivedChunks: progress.receivedChunks, complete: true };
  }, { maxWait: 10_000, timeout: 15_000 });
  if (result.complete && result.operation.photoPath) {
    // Clean only this upload's temporary fragments, after the durable commit.
    const directory = directoryFor(root, result.operation.id);
    const names = await readdir(directory).catch(() => [] as string[]);
    await Promise.all(names.filter(name => /^\d+\.part$/.test(name) || /^\d+-[a-f0-9-]+\.incoming$/.test(name)).map(name => unlink(path.join(directory, name)).catch(() => {})));
    await rmdir(directory).catch(() => {});
  }
  return result;
}
