import { parseTerminalFiscalRunCli } from '../lib/terminal-fiscal-cli';
import { runTerminalFiscalHistoricalDryRun } from '../lib/terminal-fiscal-runner';

async function main() {
  const options = parseTerminalFiscalRunCli(process.argv.slice(2));
  const result = await runTerminalFiscalHistoricalDryRun({
    mappingId: options.mappingId,
    periodFrom: options.periodFrom,
    periodTo: options.periodTo,
    persist: options.persist,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'TERMINAL_FISCAL_RUN_FAILED'}\n`);
  process.exitCode = 1;
});
