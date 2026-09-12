import 'server-only';

import { readOneCRuntimeEnv } from '@/lib/one-c-env';
import { expenseRequestMoscowCalendarDate } from '@/lib/expense-request-source';

export type SupplierCurrencyPaymentRow = {
  ref: string;
  date: string;
  number: string;
  posted: boolean;
  deleted: boolean;
  documentAmount: number;
  documentCurrency: string;
  baseDocumentRef: string;
};

export type CurrencyConversionRow = {
  date: string;
  posted: boolean;
  deleted: boolean;
  currency: string;
  conversionCurrency: string;
  conversionRate: number;
  linkedCashbox: string;
};

type RawRow = Record<string, unknown>;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const amount = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

async function fetchOneCJson(endpoint: string, query: URLSearchParams, timeoutMs: number) {
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl || !env.user || !env.password) throw new Error('CURRENCY_PAYMENT_SOURCE_UNCONFIGURED');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${env.baseUrl}/${endpoint}?${query}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${env.user}:${env.password}`, 'utf8').toString('base64')}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json() as Record<string, unknown>;
    if (!response.ok || payload.ok === false) throw new Error(`CURRENCY_PAYMENT_SOURCE_HTTP_${response.status}`);
    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('CURRENCY_PAYMENT_SOURCE_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSupplierCurrencyPaymentSnapshot(input: { from: Date; to: Date; timeoutMs?: number }) {
  const common = {
    date_from: expenseRequestMoscowCalendarDate(input.from),
    date_to: expenseRequestMoscowCalendarDate(input.to),
    limit: '1000',
  };
  const [paymentPayload, conversionPayload] = await Promise.all([
    fetchOneCJson('supplier-currency-payment-diagnostics', new URLSearchParams(common), input.timeoutMs ?? 15_000),
    fetchOneCJson('currency-exchange-diagnostics', new URLSearchParams({ ...common, counterparty_search: 'Обменник' }), input.timeoutMs ?? 15_000),
  ]);
  if (!Array.isArray(paymentPayload.rows) || !Array.isArray(conversionPayload.cash_expense_orders)) {
    throw new Error('CURRENCY_PAYMENT_SOURCE_SHAPE_MISMATCH');
  }
  const rawPayments = Array.isArray(paymentPayload.rows) ? paymentPayload.rows as RawRow[] : [];
  const rawConversions = Array.isArray(conversionPayload.cash_expense_orders)
    ? conversionPayload.cash_expense_orders as RawRow[] : [];
  const payments: SupplierCurrencyPaymentRow[] = rawPayments.flatMap((row) => {
    const ref = text(row.ref);
    return ref ? [{
      ref,
      date: text(row.date),
      number: text(row.number),
      posted: row.posted === true,
      deleted: row.deleted === true,
      documentAmount: amount(row.document_amount),
      documentCurrency: text(row.document_currency).toUpperCase(),
      baseDocumentRef: text(row.base_document_ref).toLowerCase(),
    }] : [];
  });
  const conversions: CurrencyConversionRow[] = rawConversions.map((row) => ({
    date: text(row.date),
    posted: row.posted === true,
    deleted: row.deleted === true,
    currency: text(row.currency).toUpperCase(),
    conversionCurrency: text(row.conversion_currency).toUpperCase(),
    conversionRate: amount(row.conversion_rate),
    linkedCashbox: text(row.linked_cashbox),
  }));
  return {
    payments,
    conversions,
    checkedAt: new Date().toISOString(),
    complete: payments.length === rawPayments.length && rawPayments.length < 1000 && rawConversions.length < 1000,
  };
}
