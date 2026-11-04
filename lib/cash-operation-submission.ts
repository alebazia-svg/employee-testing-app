import 'server-only';
import type { PrismaClient } from '@prisma/client';

type Submission = {
  userId: number; workDayEntryId: number; date: string; department: string;
  direction: string; amount: number; comment: string; idempotencyKey: string;
  distinctFromOperationId: number | null;
  // Only the new durable-intent protocol uses a last-seen operation baseline.
  intent?: { baselineId: number | null; photoSha256: string; photoBytes: number };
};

/** Serialize both original requests and independent drafts before any 1C write.
 * A duplicate is not silently merged: the employee must identify another actual
 * transfer. Reject it on every replay, including after reconnecting tomorrow.
 */
export async function claimCashOperationSubmission(
  db: PrismaClient, input: Submission, savePhoto: () => Promise<string>,
) {
  return db.$transaction(async tx => {
    // One lock per employee also covers requests with different UUIDs/tabs.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106261, ${input.userId}::integer)`;
    const replay = await tx.cashOperation.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (replay) {
      if (replay.userId !== input.userId || replay.amount !== input.amount || replay.direction !== input.direction
        || input.intent && (replay.workDayEntryId !== input.workDayEntryId || replay.date !== input.date
          || replay.photoExpectedSha256 !== input.intent.photoSha256 || replay.photoExpectedBytes !== input.intent.photoBytes)) {
        return { kind: 'conflict' as const };
      }
      return { kind: 'replay' as const, operation: replay };
    }
    const previous = await tx.cashOperation.findFirst({
      where: { userId: input.userId, workDayEntryId: input.workDayEntryId,
        direction: input.direction, ...(!input.intent ? { amount: input.amount } : {}), status: { not: 'cancelled' } },
      orderBy: input.intent ? [{ id: 'desc' }] : [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (previous && (input.distinctFromOperationId !== null ? input.distinctFromOperationId !== previous.id : input.intent ? input.intent.baselineId !== previous.id : true)) {
      return { kind: 'duplicate' as const, operation: previous };
    }
    // A stale or invented confirmation cannot override the current comparison.
    if (!previous && (input.distinctFromOperationId !== null || input.intent && input.intent.baselineId !== null)) return { kind: 'conflict' as const };
    const photoPath = await savePhoto();
    const operation = await tx.cashOperation.create({ data: {
      userId: input.userId, workDayEntryId: input.workDayEntryId, date: input.date,
      department: input.department, direction: input.direction, amount: input.amount,
      comment: [input.comment, previous ? `В приложении подтверждена ещё одна передача денег после инкассации № ${previous.id}.` : ''].filter(Boolean).join('\n'), idempotencyKey: input.idempotencyKey, photoPath, status: 'pending_1c',
      ...(input.intent ? { photoExpectedSha256: input.intent.photoSha256, photoExpectedBytes: input.intent.photoBytes, ...(photoPath ? { photoReceivedAt: new Date() } : {}), oneCProcessingStartedAt: new Date() } : {}),
    } });
    return { kind: 'created' as const, operation };
  }, { maxWait: 10_000, timeout: 10_000 });
}
