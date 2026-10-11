import 'server-only';

import { readOneCRuntimeEnv } from './one-c-env';
import { parseTBankOwnerTransferStatement, tbankTransferPeriod } from './tbank-owner-transfer-control';

/** Read-only tariff usage control from already received T-Bank statements. */
async function readStatement(asOf: string): Promise<unknown> {
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl || !env.user || !env.password) {
    return null;
  }
  const { periodFrom } = tbankTransferPeriod(asOf);
  const query = new URLSearchParams({
    account: 'Т-Банк КБР', date_from: periodFrom, date_to: asOf, limit: '500',
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(env.requestTimeoutMs) || 15_000);
  try {
    const authorization = `Basic ${Buffer.from(`${env.user}:${env.password}`, 'utf8').toString('base64')}`;
    const response = await fetch(`${env.baseUrl}/bank-exchange-statement-operations?${query}`, {
      headers: { Accept: 'application/json', Authorization: authorization },
      cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchTBankOwnerTransferControl(asOf: string) {
  return parseTBankOwnerTransferStatement(await readStatement(asOf), asOf);
}

/** Date comes from the statement, not from the last operation or fetch time. */
export function latestStatementDay(raw: unknown, asOf: string): string | null {
  const summaries = (raw as {statement_summaries?:unknown[]}|null)?.statement_summaries;
  if (!Array.isArray(summaries)) return null;
  const dates = summaries.flatMap(row => {
    const value = (row as {period_end?:unknown}|null)?.period_end;
    if (typeof value !== 'string') return [];
    const prefix=value.slice(0,10), date=/^\d{2}\.\d{2}\.\d{4}$/.test(prefix)?prefix.split('.').reverse().join('-'):prefix;
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date && date<=asOf ? [date] : [];
  });
  return dates.sort().at(-1) ?? null;
}

export async function fetchDatedTBankControl(asOf: string) {
  const raw=await readStatement(asOf);
  const current=parseTBankOwnerTransferStatement(raw,asOf);
  const date=current.status==='verified'?asOf:latestStatementDay(raw,asOf);
  const control=date && date!==asOf ? parseTBankOwnerTransferStatement(await readStatement(date),date) : current;
  const {nextTransferFeeMinor: _fee,...dated}=control;
  return {current, dated:{...dated,statementDate:date??asOf,current:date===asOf&&control.status==='verified'}};
}
