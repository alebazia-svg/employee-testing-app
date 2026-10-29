import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Operation-level comparison with the tax office export, written by the AUSN
// runner next to each full report (ausn-fns-gaps-<stamp>.json). Read-only.
export type FnsGapOperation = { date: string; amount: number; kind?: string; payer?: string; account?: string; purpose?: string; operation?: string };
export type FnsCashDay = { date: string; ours: number; fns: number };
export type FnsMonthGaps = { missingInFns: FnsGapOperation[]; missingInOurs: FnsGapOperation[]; cashDays: FnsCashDay[]; missingInFnsTotal: number; missingInOursTotal: number; cashDifference: number };
export type FnsGaps = { sourceFile: string; lkFrom?: string; lkTo?: string; months: Record<string, FnsMonthGaps> };

const maxBytes = 2 * 1024 * 1024;
const text = (value: unknown, limit = 200) => typeof value === 'string' ? value.slice(0, limit) : undefined;
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const list = (value: unknown) => Array.isArray(value) ? value.slice(0, 500) : [];
const operation = (value: unknown): FnsGapOperation | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const date = text(item.date, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { date, amount: number(item.amount), kind: text(item.kind, 40), payer: text(item.payer, 120), account: text(item.account, 60), purpose: text(item.purpose), operation: text(item.operation) };
};

export function parseFnsGaps(raw: string, sourceFile: string): FnsGaps | undefined {
  try {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    if (!payload || typeof payload.months !== 'object' || !payload.months) return undefined;
    const months: Record<string, FnsMonthGaps> = {};
    for (const [key, value] of Object.entries(payload.months as Record<string, unknown>)) {
      if (!/^20\d{2}-\d{2}$/.test(key) || !value || typeof value !== 'object') continue;
      const month = value as Record<string, unknown>;
      months[key] = {
        missingInFns: list(month.missing_in_fns).map(operation).filter((item): item is FnsGapOperation => item !== null),
        missingInOurs: list(month.missing_in_ours).map(operation).filter((item): item is FnsGapOperation => item !== null),
        cashDays: list(month.cash_days).map((item) => { const day = item as Record<string, unknown>; const date = text(day?.date, 10); return date ? { date, ours: number(day.ours), fns: number(day.fns) } : null; }).filter((item): item is FnsCashDay => item !== null),
        missingInFnsTotal: number(month.missing_in_fns_total),
        missingInOursTotal: number(month.missing_in_ours_total),
        cashDifference: number(month.cash_difference),
      };
    }
    return { sourceFile, lkFrom: text(payload.lk_from, 10), lkTo: text(payload.lk_to, 10), months };
  } catch { return undefined; }
}

const stamp = (name: string) => /(\d{8}T\d{6})\.(?:md|json)$/.exec(name)?.[1] || '';

// Only the comparison written by the same run as the given full report is used,
// so an old list never sits next to fresh figures.
export async function loadFnsGaps(fullReportFile: string | undefined, directory = process.env.AUSN_REPORT_CACHE_DIR || '/app/runtime/ausn-reports'): Promise<FnsGaps | undefined> {
  if (!fullReportFile) return undefined;
  const name = `ausn-fns-gaps-${stamp(fullReportFile)}.json`;
  if (!stamp(fullReportFile)) return undefined;
  try {
    const file = path.join(directory, name);
    const metadata = await lstat(file);
    if (!metadata.isFile() || metadata.size > maxBytes) return undefined;
    return parseFnsGaps(await readFile(file, 'utf8'), name);
  } catch { return undefined; }
}

