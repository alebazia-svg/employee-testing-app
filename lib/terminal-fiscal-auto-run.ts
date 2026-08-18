export type TerminalFiscalAutoRunMode = 'current' | 'previous';

export type TerminalFiscalAutoRunCliOptions = {
  mode: TerminalFiscalAutoRunMode;
  persist: boolean;
};

const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
const BUCKET_MS = 5 * 60 * 1000;
const SOURCE_DELAY_MS = 10 * 60 * 1000;

export function parseTerminalFiscalAutoRunCli(argv: string[]): TerminalFiscalAutoRunCliOptions {
  const modeAt = argv.indexOf('--mode');
  const mode = modeAt >= 0 ? argv[modeAt + 1] : '';
  if (mode !== 'current' && mode !== 'previous') {
    throw new Error('Usage: matching:auto-run --mode <current|previous> [--confirm-audit-write]');
  }
  return { mode, persist: argv.includes('--confirm-audit-write') };
}

function moscowMidnightUtc(now: Date) {
  const shifted = new Date(now.getTime() + MOSCOW_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - MOSCOW_OFFSET_MS);
}

export function terminalFiscalAutomaticPeriod(mode: TerminalFiscalAutoRunMode, now = new Date()) {
  const todayFrom = moscowMidnightUtc(now);
  if (mode === 'previous') {
    return {
      periodFrom: new Date(todayFrom.getTime() - 24 * 60 * 60 * 1000),
      periodTo: todayFrom,
    };
  }
  const safeNow = now.getTime() - SOURCE_DELAY_MS;
  const periodTo = new Date(Math.floor(safeNow / BUCKET_MS) * BUCKET_MS);
  return periodTo > todayFrom ? { periodFrom: todayFrom, periodTo } : null;
}
