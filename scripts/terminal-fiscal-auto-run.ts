import { prisma } from '../lib/prisma';
import { parseTerminalFiscalAutoRunCli, terminalFiscalAutomaticPeriod } from '../lib/terminal-fiscal-auto-run';
import { runTerminalFiscalHistoricalDryRun } from '../lib/terminal-fiscal-runner';

async function main() {
  const options = parseTerminalFiscalAutoRunCli(process.argv.slice(2));
  const period = terminalFiscalAutomaticPeriod(options.mode);
  if (!period) {
    process.stdout.write(`${JSON.stringify({ ok: true, skipped: true, reason: 'PERIOD_NOT_READY' })}\n`);
    return;
  }
  const mappings = await prisma.terminalFiscalMapping.findMany({
    where: {
      isActive: true,
      effectiveFrom: { lt: period.periodTo },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: period.periodFrom } }],
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  const results = [];
  for (const mapping of mappings) {
    const result = await runTerminalFiscalHistoricalDryRun({
      mappingId: mapping.id,
      periodFrom: period.periodFrom,
      periodTo: period.periodTo,
      persist: options.persist,
      syncWorkdayControl: options.persist && process.env.TERMINAL_FISCAL_WORKDAY_CONTROL_ENABLED === 'true',
    });
    results.push({
      acquired: result.acquired,
      persisted: result.acquired ? result.persisted : false,
      statuses: result.acquired ? result.summary.statuses : undefined,
    });
  }
  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode: options.mode,
    persisted: options.persist,
    periodFrom: period.periodFrom.toISOString(),
    periodTo: period.periodTo.toISOString(),
    mappingCount: mappings.length,
    results,
  })}\n`);
}

main().catch((error) => {
  const message = error instanceof Error && /^[A-Z0-9_]{1,100}$/.test(error.message)
    ? error.message
    : 'TERMINAL_FISCAL_AUTO_RUN_FAILED';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
