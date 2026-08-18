import { prisma } from '../lib/prisma';
import { terminalFiscalOwnerMessage } from '../lib/terminal-fiscal-owner-report';

function moscowDayBounds(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now).split('-').map(Number);
  const todayUtc = Date.UTC(parts[0], parts[1] - 1, parts[2], -3);
  return { from: new Date(todayUtc - 86_400_000), to: new Date(todayUtc) };
}

function dayLabel(value: Date) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric' }).format(value);
}

async function main() {
  const { from, to } = moscowDayBounds();
  const [open, resolved, runs] = await Promise.all([
    prisma.terminalFiscalEmployeeReview.findMany({
      where: { status: 'open', bankOperationAt: { lt: to } },
      select: { amountKopecks: true },
    }),
    prisma.terminalFiscalEmployeeReview.findMany({
      where: { resolvedAt: { gte: from, lt: to } },
      select: { amountKopecks: true },
    }),
    prisma.terminalFiscalMatchRun.findMany({
      where: { periodFrom: { gte: from }, periodTo: { lte: to } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, mappingId: true, tbankComplete: true, oneCComplete: true, ofdComplete: true },
    }),
  ]);
  const latest = new Map<string, (typeof runs)[number]>();
  for (const run of runs) if (!latest.has(run.mappingId)) latest.set(run.mappingId, run);
  const selected = [...latest.values()];
  const matches = selected.length ? await prisma.terminalFiscalMatch.findMany({
    where: { runId: { in: selected.map((run) => run.id) } },
    select: { status: true, reasonCode: true, oneCCashierRef: true },
  }) : [];
  const itemReasons = new Set(['OFD_ITEMS_MISMATCH', 'OFD_ITEM_PRESENTATION_DIFFERENCE', 'OFD_ITEM_VALUES_MISMATCH']);
  const input = {
    day: dayLabel(from),
    openCount: open.length,
    openAmountKopecks: open.reduce((sum, row) => sum + row.amountKopecks, 0),
    resolvedLateCount: resolved.length,
    resolvedLateAmountKopecks: resolved.reduce((sum, row) => sum + row.amountKopecks, 0),
    confirmed: matches.filter((row) => row.status === 'confirmed').length,
    coveredByDayTotal: matches.filter((row) => row.reasonCode === 'ONE_C_CANDIDATE_NOT_FOUND' && Boolean(row.oneCCashierRef)).length,
    itemReview: matches.filter((row) => itemReasons.has(row.reasonCode)).length,
    pending: matches.filter((row) => row.status === 'pending').length,
    unavailable: matches.filter((row) => row.status === 'unavailable').length,
    mismatches: matches.filter((row) => row.status === 'mismatch').length,
    total: matches.length,
    sourcesComplete: selected.length > 0 && selected.every((run) => run.tbankComplete && run.oneCComplete && run.ofdComplete),
  };
  process.stdout.write(`${JSON.stringify({ ok: true, input, text: terminalFiscalOwnerMessage(input) })}\n`);
}

main().catch(() => { process.stderr.write('TERMINAL_FISCAL_OWNER_REPORT_FAILED\n'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
