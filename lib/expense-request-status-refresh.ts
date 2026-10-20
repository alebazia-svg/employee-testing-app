import 'server-only';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from './prisma';
import { expenseNativeTransport } from './expense-request-admin-client';
import { readNativeExpenseCard, type NativeExpenseState } from './expense-request-command';
import { expenseRequestCurrentWhere } from './expense-request-admin-lifecycle';

const INTERVAL_MS = 60_000;
const BATCH_SIZE = 10;
const BUDGET_MS = 6_000;
const READ_TIMEOUT_MS = 2_000;
const RUN_STATUS = 'status_refresh';
type StatusDb = Pick<PrismaClient, '$transaction'>;
type Reader = (ref: string, timeoutMs: number) => Promise<NativeExpenseState>;

const readState: Reader = async (ref, timeoutMs) => readNativeExpenseCard(
  await expenseNativeTransport({ method: 'GET', query: new URLSearchParams({ ref }), timeoutMs }), ref,
).state;

/** Unknown/error responses never retire a task. No financial writes or new events. */
export function expenseStatusPatch(state: NativeExpenseState, ref: string, observedAt: Date) {
  const doc = state.document;
  if (doc.ref.toLowerCase() !== ref.toLowerCase()
    || typeof doc.deletion_mark !== 'boolean'
    || !['not_approved', 'approved', 'payable', 'rejected'].includes(doc.status.key)) return null;
  return {
    isNotApproved: doc.status.key === 'not_approved' && !doc.deletion_mark,
    currentStatusKey: doc.status.key,
    currentStatusName: doc.status.name,
    deletionMark: doc.deletion_mark,
    lastSeenAt: observedAt,
  };
}

async function refreshCase(tx: Prisma.TransactionClient, row: {
  id: string; oneCRequestRef: string; updatedAt: Date; notApprovedCycle: number;
}, read: Reader, clock: () => Date, timeoutMs: number) {
  const observedAt = clock();
  const state = await read(row.oneCRequestRef, timeoutMs);
  const patch = expenseStatusPatch(state, row.oneCRequestRef, observedAt);
  // Pending reads do not advance the full snapshot's freshness or rewrite the
  // case. Otherwise minute polls could indefinitely starve richer batch updates.
  if (!patch || patch.isNotApproved) return 0;
  // CAS protects a newer full sync, a reopened cycle, and concurrent approvals.
  const result = await tx.expenseRequestAdminCase.updateMany({
    where: { id: row.id, updatedAt: row.updatedAt, notApprovedCycle: row.notApprovedCycle, isNotApproved: true, lastSeenAt: { lte: observedAt } },
    data: patch,
  });
  return !patch.isNotApproved ? result.count : 0;
}

/** Shared across processes/devices via PostgreSQL, with a persisted cooldown.
 * This run is deliberately NOT a successful full-source sync or freshness signal.
 */
export async function refreshPendingExpenseStatuses(input: {
  db?: StatusDb; read?: Reader; clock?: () => Date;
} = {}) {
  const db = input.db ?? prisma, read = input.read ?? readState, clock = input.clock ?? (() => new Date());
  return db.$transaction(async tx => {
    const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`SELECT pg_try_advisory_xact_lock(172039, 1) AS acquired`;
    if (!lock?.acquired) return { checked: 0, closed: 0 };
    const now = clock();
    const last = await tx.expenseRequestSyncRun.findFirst({
      where: { status: RUN_STATUS }, orderBy: { startedAt: 'desc' }, select: { startedAt: true },
    });
    if (last && +now - +last.startedAt < INTERVAL_MS) return { checked: 0, closed: 0 };
    const count = await tx.expenseRequestAdminCase.count({ where: expenseRequestCurrentWhere });
    if (!count) return { checked: 0, closed: 0 };
    // Rotate a stable ID-ordered queue; failed reads cannot monopolize the batch.
    const offset = count <= BATCH_SIZE ? 0 : Math.floor(+now / INTERVAL_MS) % count;
    const rows = await tx.expenseRequestAdminCase.findMany({
      where: expenseRequestCurrentWhere, orderBy: { id: 'asc' }, skip: offset, take: BATCH_SIZE,
      select: { id: true, oneCRequestRef: true, updatedAt: true, notApprovedCycle: true },
    });
    const rotation = Math.floor(+now / INTERVAL_MS) % rows.length;
    const queue = [...rows.slice(rotation), ...rows.slice(0, rotation)];
    const started = performance.now();
    let checked = 0, closed = 0;
    for (const row of queue) {
      const remaining = BUDGET_MS - (performance.now() - started);
      if (remaining < 100) break;
      checked++;
      try { closed += await refreshCase(tx, row, read, clock, Math.min(READ_TIMEOUT_MS, remaining)); }
      catch { /* Keep the task; normal full sync remains authoritative fallback. */ }
    }
    await tx.expenseRequestSyncRun.create({ data: {
      runKey: `status-refresh:${randomUUID()}`, status: RUN_STATUS,
      periodFrom: now, periodTo: now, startedAt: now, completedAt: clock(),
      sourceComplete: false, sourceRowCount: checked, updatedCaseCount: closed,
    } });
    return { checked, closed };
  }, { timeout: 10_000, maxWait: 1_000 });
}

/** After a user command/read, reconcile this exact case without waiting for the
 * shared minute tick. Independently read 1C, never infer success from a click.
 */
export async function refreshOneExpenseStatus(ref: string, input: {
  db?: StatusDb; read?: Reader; clock?: () => Date;
} = {}) {
  const db = input.db ?? prisma;
  return db.$transaction(async tx => {
    const row = await tx.expenseRequestAdminCase.findUnique({
      where: { oneCRequestRef: ref }, select: { id: true, oneCRequestRef: true, updatedAt: true, notApprovedCycle: true, isNotApproved: true },
    });
    if (!row?.isNotApproved) return 0;
    return refreshCase(tx, row, input.read ?? readState, input.clock ?? (() => new Date()), READ_TIMEOUT_MS);
  }, { timeout: 5_000, maxWait: 1_000 });
}
