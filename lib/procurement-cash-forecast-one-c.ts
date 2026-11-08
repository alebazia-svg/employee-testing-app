import 'server-only';

import { readOneCRuntimeEnv } from './one-c-env';
import { parseOwnerMoneyStatements, VTB_OWNER_ACCOUNT, type OwnerMoneySource } from './procurement-cash-forecast-source';

/** Read-only 1C position source; no source rows are persisted or sent to an employee. */
export async function fetchOwnerMoneyForCashForecast(asOf: string): Promise<OwnerMoneySource> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('FORECAST_INVALID_DATE');
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl || !env.user || !env.password) throw new Error('FORECAST_ONE_C_UNCONFIGURED');
  const authorization = `Basic ${Buffer.from(`${env.user}:${env.password}`, 'utf8').toString('base64')}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(env.requestTimeoutMs) || 15_000);
  try {
    const payloads = await Promise.all(['bank', 'cash'].map(async (kind) => {
      const query = new URLSearchParams({ date_from: asOf, date_to: asOf, money_type: kind, limit: '3000' });
      const response = await fetch(`${env.baseUrl}/money-statement?${query}`, {
        method: 'GET', headers: { Accept: 'application/json', Authorization: authorization },
        cache: 'no-store', signal: controller.signal,
      });
      if (!response.ok) throw new Error(`FORECAST_ONE_C_HTTP_${response.status}`);
      return response.json() as Promise<unknown>;
    }));
    // Canonical VTB identity independently read back from its 1C statement.
    // An all-zero account is omitted by the general register report. Prove that
    // exact account empty before restoring its zero position; never guess zero.
    const vtbRef = VTB_OWNER_ACCOUNT.ref;
    const bank = payloads[0] as { accounts?: Array<{ account?: { name?: string } }> };
    if (Array.isArray(bank.accounts) && !bank.accounts.some(row => row.account?.name?.trim() === 'ВТБ КБР')) {
      const query = new URLSearchParams({ date_from: asOf, date_to: asOf, money_type: 'bank', account_ref: vtbRef, limit: '3000' });
      const response = await fetch(`${env.baseUrl}/money-statement?${query}`, {
        method: 'GET', headers: { Accept: 'application/json', Authorization: authorization },
        cache: 'no-store', signal: controller.signal,
      });
      if (!response.ok) throw new Error(`FORECAST_ONE_C_HTTP_${response.status}`);
      return parseOwnerMoneyStatements(payloads, asOf, [{ ...VTB_OWNER_ACCOUNT, payload: await response.json() }]);
    }
    return parseOwnerMoneyStatements(payloads, asOf);
  } finally {
    clearTimeout(timeout);
  }
}
