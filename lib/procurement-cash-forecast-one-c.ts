import 'server-only';

import { readOneCRuntimeEnv } from './one-c-env';
import { parseOwnerMoneyStatements, type OwnerMoneySource } from './procurement-cash-forecast-source';

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
    return parseOwnerMoneyStatements(payloads, asOf);
  } finally {
    clearTimeout(timeout);
  }
}
