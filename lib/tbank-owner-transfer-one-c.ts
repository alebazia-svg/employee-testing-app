import 'server-only';

import { readOneCRuntimeEnv } from './one-c-env';
import { parseTBankOwnerTransferStatement, tbankTransferPeriod } from './tbank-owner-transfer-control';

/** Read-only tariff usage control from already received T-Bank statements. */
export async function fetchTBankOwnerTransferControl(asOf: string) {
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl || !env.user || !env.password) {
    return parseTBankOwnerTransferStatement(null, asOf);
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
    if (!response.ok) return parseTBankOwnerTransferStatement(null, asOf);
    return parseTBankOwnerTransferStatement(await response.json(), asOf);
  } catch {
    return parseTBankOwnerTransferStatement(null, asOf);
  } finally {
    clearTimeout(timeout);
  }
}
