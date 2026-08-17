import { prisma } from '../lib/prisma';
import { syncExpenseRequestAdminAudit } from '../lib/expense-request-admin-sync';
import { fetchExpenseRequestSnapshot } from '../lib/expense-request-source';
import type { ExpenseRequestSnapshot } from '../lib/expense-request-source';

const DAY_MS = 24 * 60 * 60 * 1000;

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

async function snapshotFromStdin(): Promise<ExpenseRequestSnapshot> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as ExpenseRequestSnapshot;
  if (!payload || !Array.isArray(payload.rows) || typeof payload.complete !== 'boolean' || typeof payload.checkedAt !== 'string') {
    throw new Error('EXPENSE_REQUEST_SNAPSHOT_INVALID');
  }
  return payload;
}

async function main() {
  const to = option('--to') ? new Date(option('--to')) : new Date();
  const from = option('--from') ? new Date(option('--from')) : new Date(to.getTime() - 7 * DAY_MS);
  const persist = process.argv.includes('--confirm-audit-write');
  const baseline = process.argv.includes('--baseline');
  const queueTelegramDelivery = process.argv.includes('--queue-telegram');
  const snapshot = process.argv.includes('--snapshot-stdin')
    ? await snapshotFromStdin()
    : await fetchExpenseRequestSnapshot({ from, to });
  if (!persist) {
    process.stdout.write(`${JSON.stringify({ ok: true, persisted: false, sourceComplete: snapshot.complete, sourceRows: snapshot.rows.length, pageCount: snapshot.pageCount, errors: snapshot.errors })}\n`);
    return;
  }
  const result = await syncExpenseRequestAdminAudit({ snapshot, from, to, baseline, queueTelegramDelivery });
  process.stdout.write(`${JSON.stringify({ ok: true, persisted: true, ...result })}\n`);
}

main().catch((error) => {
  const message = error instanceof Error && /^[A-Z0-9_]{1,100}$/.test(error.message) ? error.message : 'EXPENSE_REQUEST_ADMIN_SYNC_FAILED';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
