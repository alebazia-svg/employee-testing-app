import { prisma } from '../lib/prisma';
import {
  automaticCreditShadowPeriod,
  loadCreditRealizationShadowSnapshot,
  persistCreditRealizationShadowSnapshot,
} from '../lib/credit-realization-shadow-runner';

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function parseDate(value: string, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('CREDIT_SHADOW_PERIOD_INVALID');
  return parsed;
}

async function main() {
  const automatic = automaticCreditShadowPeriod();
  const periodFrom = parseDate(option('--from'), automatic.periodFrom);
  const periodTo = parseDate(option('--to'), automatic.periodTo);
  if (periodFrom >= periodTo) throw new Error('CREDIT_SHADOW_PERIOD_INVALID');

  const snapshot = await loadCreditRealizationShadowSnapshot({ periodFrom, periodTo });
  const summary = {
    sourceComplete: snapshot.complete,
    oneCComplete: snapshot.oneCComplete,
    ofdComplete: snapshot.ofdComplete,
    errorCode: snapshot.errorCode,
    sourceDocuments: snapshot.rows.length,
    counts: snapshot.rows.reduce((counts, row) => {
      counts[row.result.status] += 1;
      return counts;
    }, { confirmed: 0, mismatch: 0, needs_review: 0, pending: 0, unavailable: 0 }),
    reasons: snapshot.rows.reduce<Record<string, number>>((counts, row) => {
      const reason = row.result.reasonCodes[0];
      counts[reason] = (counts[reason] ?? 0) + 1;
      return counts;
    }, {}),
  };

  if (!process.argv.includes('--confirm-audit-write')) {
    process.stdout.write(`${JSON.stringify({ ok: snapshot.complete, persisted: false, ...summary })}\n`);
    if (!snapshot.complete) process.exitCode = 1;
    return;
  }

  const result = await persistCreditRealizationShadowSnapshot(prisma, snapshot);
  process.stdout.write(`${JSON.stringify({ ok: snapshot.complete, ...summary, ...result })}\n`);
  if (!snapshot.complete) process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error && /^[A-Z0-9_]{1,100}$/.test(error.message)
    ? error.message
    : 'CREDIT_REALIZATION_SHADOW_RUN_FAILED';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
