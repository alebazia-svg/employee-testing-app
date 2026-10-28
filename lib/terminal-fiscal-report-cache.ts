import 'server-only';
import { TERMINAL_FISCAL_MATCHING_VERSION } from './terminal-fiscal-matching';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { loadDailyFiscalReport } from './terminal-fiscal-daily-report-loader';
import { readOneCRuntimeEnv } from './one-c-env';
export type SavedFiscalReport = Awaited<ReturnType<typeof loadDailyFiscalReport>>;
const schema = 'fiscal-daily-v2';
export function validFiscalDay(day: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0,10) === day;
}
function location(day: string) {
  if (!validFiscalDay(day)) throw new Error('INVALID_REPORT_DAY');
  const env = readOneCRuntimeEnv();
  const scope = createHash('sha256').update(`${env.baseUrl}\n${env.user}\n${process.env.DATABASE_URL || ''}`).digest('hex');
  return path.join(process.env.FISCAL_REPORT_CACHE_DIR || path.join(process.cwd(), '.cache', 'fiscal-reports'), scope, `${day}.json`);
}
export function completeFiscalReport(report: SavedFiscalReport) {
  return report.configurationComplete && report.complete.bank && report.complete.oneC && report.complete.ofd;
}
export async function readFiscalReport(day: string): Promise<SavedFiscalReport | null> {
  const target = location(day);
  try {
    const saved = JSON.parse(await readFile(target, 'utf8'));
    const report = saved.report as SavedFiscalReport;
    if (saved.schema !== schema || saved.algorithmVersion !== TERMINAL_FISCAL_MATCHING_VERSION || saved.day !== day || !report || !completeFiscalReport(report)
      || !Array.isArray(report.rows) || !Array.isArray(report.transactions) || !Array.isArray(report.movements)
      || !Number.isFinite(Date.parse(report.updatedAt)) || Date.parse(report.updatedAt) > Date.now()+60000) return null;
    return report;
  } catch { return null; }
}
export async function writeFiscalReport(day: string, report: SavedFiscalReport) {
  if (!completeFiscalReport(report)) return false;
  const previous = await readFiscalReport(day);
  if (previous?.settlement.complete && !report.settlement.complete) return false;
  const target = location(day);
  await mkdir(path.dirname(target), {recursive:true, mode:0o700});
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify({schema,algorithmVersion:TERMINAL_FISCAL_MATCHING_VERSION,day,report}), {mode:0o600,flag:'wx'});
    await rename(temporary,target);
  } finally { await unlink(temporary).catch(()=>{}); }
  return true;
}
