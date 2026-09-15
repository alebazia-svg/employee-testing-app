import { prisma } from '../lib/prisma';
import { runProcurementForecastSnapshot } from '../lib/procurement-forecast-snapshot-runner';

async function main() {
  const persist = process.argv.includes('--confirm-snapshot-write');
  const result = await runProcurementForecastSnapshot({ persist });
  process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
}

main().catch((error) => {
  const message = error instanceof Error && /^[A-Z0-9_]{1,100}$/.test(error.message)
    ? error.message
    : 'PROCUREMENT_FORECAST_SNAPSHOT_FAILED';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
