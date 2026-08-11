export type TerminalFiscalRunCliOptions = {
  mappingId: string;
  periodFrom: Date;
  periodTo: Date;
  persist: boolean;
};

export function parseTerminalFiscalRunCli(argv: string[]): TerminalFiscalRunCliOptions {
  const value = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1]?.trim() ?? '' : '';
  };
  const mappingId = value('--mapping-id');
  const periodFrom = new Date(value('--from'));
  const periodTo = new Date(value('--to'));
  if (!mappingId || Number.isNaN(periodFrom.getTime()) || Number.isNaN(periodTo.getTime()) || periodTo <= periodFrom) {
    throw new Error('Usage: matching:run --mapping-id <id> --from <ISO> --to <ISO> [--confirm-audit-write]');
  }
  if (periodTo.getTime() - periodFrom.getTime() > 7 * 24 * 60 * 60 * 1000) throw new Error('TERMINAL_FISCAL_PERIOD_OUT_OF_RANGE');
  return { mappingId, periodFrom, periodTo, persist: argv.includes('--confirm-audit-write') };
}
