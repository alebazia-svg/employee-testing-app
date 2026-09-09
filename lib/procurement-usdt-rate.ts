import 'server-only';

import { readOneCRuntimeEnv } from '@/lib/one-c-env';

type RawEvent = Record<string, unknown>;

export type ProcurementUsdtRateReference = {
  rate: number | null;
  checkedAt: string;
  sourceLabel: string;
  conversionAt: string;
  documentNumber: string;
  currencyAmount: number | null;
  rubValue: number | null;
  error: string;
};

const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export function latestUsdtRateFromPayload(payload: unknown, checkedAt = new Date().toISOString()): ProcurementUsdtRateReference {
  const root = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const events = Array.isArray(root.events) ? root.events.filter((item): item is RawEvent => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
  const purchases = events
    .filter((event) => text(event.event_type) === 'buy')
    .map((event) => {
      const currencyAmount = number(event.currency_amount);
      const rubValue = number(event.rub_value);
      const documentRate = number(event.document_rate);
      return {
        event,
        rate: documentRate || (currencyAmount && rubValue ? rubValue / currencyAmount : null),
        currencyAmount,
        rubValue,
        conversionAt: text(event.date),
      };
    })
    .filter((item) => item.rate)
    .sort((a, b) => a.conversionAt.localeCompare(b.conversionAt));
  const latest = purchases.at(-1);
  if (!latest) return { rate: null, checkedAt, sourceLabel: 'Последняя конвертация в 1С', conversionAt: '', documentNumber: '', currencyAmount: null, rubValue: null, error: 'USDT_CONVERSION_NOT_FOUND' };
  return {
    rate: latest.rate,
    checkedAt,
    sourceLabel: 'Последняя конвертация в 1С',
    conversionAt: latest.conversionAt,
    documentNumber: text(latest.event.number),
    currencyAmount: latest.currencyAmount,
    rubValue: latest.rubValue,
    error: '',
  };
}

export async function getLatestProcurementUsdtRate(todayKey: string): Promise<ProcurementUsdtRateReference> {
  const checkedAt = new Date().toISOString();
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl || !env.user || !env.password) return { rate: null, checkedAt, sourceLabel: 'Последняя конвертация в 1С', conversionAt: '', documentNumber: '', currencyAmount: null, rubValue: null, error: 'USDT_RATE_SOURCE_UNCONFIGURED' };
  const from = new Date(`${todayKey}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 120);
  const query = new URLSearchParams({
    date_from: from.toISOString().slice(0, 10),
    date_to: todayKey,
    currency: 'USDT',
    cashbox_search: 'Касса USDT',
    limit: '2000',
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(env.requestTimeoutMs) || 15_000);
  try {
    const response = await fetch(`${env.baseUrl}/currency-cash-costing-plan?${query}`, {
      headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${env.user}:${env.password}`, 'utf8').toString('base64')}` },
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok || (payload && typeof payload === 'object' && 'ok' in payload && payload.ok === false)) {
      return { rate: null, checkedAt, sourceLabel: 'Последняя конвертация в 1С', conversionAt: '', documentNumber: '', currencyAmount: null, rubValue: null, error: `USDT_RATE_SOURCE_HTTP_${response.status}` };
    }
    return latestUsdtRateFromPayload(payload, checkedAt);
  } catch (error) {
    return { rate: null, checkedAt, sourceLabel: 'Последняя конвертация в 1С', conversionAt: '', documentNumber: '', currencyAmount: null, rubValue: null, error: error instanceof DOMException && error.name === 'AbortError' ? 'USDT_RATE_SOURCE_TIMEOUT' : 'USDT_RATE_SOURCE_FAILED' };
  } finally {
    clearTimeout(timeout);
  }
}
