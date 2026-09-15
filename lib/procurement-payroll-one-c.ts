import 'server-only';

import { readOneCRuntimeEnv } from './one-c-env';
import { parsePayrollForecastEvidence } from './procurement-payroll-forecast';

export async function fetchPayrollForecastEvidence(asOf: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('FORECAST_INVALID_DATE');
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl || !env.user || !env.password) throw new Error('FORECAST_ONE_C_UNCONFIGURED');
  const authorization = `Basic ${Buffer.from(`${env.user}:${env.password}`, 'utf8').toString('base64')}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(env.requestTimeoutMs) || 15_000);
  try {
    const query = new URLSearchParams({ as_of: asOf, limit: '5000' });
    const response = await fetch(`${env.baseUrl}/payroll-balance?${query}`, {
      method: 'GET', headers: { Accept: 'application/json', Authorization: authorization },
      cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) throw new Error(`FORECAST_PAYROLL_HTTP_${response.status}`);
    return parsePayrollForecastEvidence(await response.json(), asOf);
  } finally {
    clearTimeout(timeout);
  }
}
