import 'server-only';

import { readOneCRuntimeEnv } from '@/lib/one-c-env';
import { normalizeManagerName } from '@/lib/procurement-payment-source';

export type SupplierSettlementRow = {
  supplierPartner: string;
  supplierCounterparty: string;
  currency: string;
  closingBalance: number;
};

export type SupplierBalance = {
  debt: number;
  advance: number;
  closingBalance: number;
};

type RawRow = Record<string, unknown>;

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
const isRub = (value: string) => ['руб', 'rub', '₽', 'российский рубль'].includes(normalizeManagerName(value));
const money = (value: number) => Math.round(value * 100) / 100;

export function normalizeSupplierSettlement(row: RawRow): SupplierSettlementRow | null {
  const supplierPartner = text(row.supplier_partner);
  const supplierCounterparty = text(row.supplier_counterparty);
  if (!supplierPartner && !supplierCounterparty) return null;
  return {
    supplierPartner,
    supplierCounterparty,
    currency: text(row.currency),
    closingBalance: amount(row.closing_balance),
  };
}

export function summarizeSupplierSettlements(rows: SupplierSettlementRow[], supplierNames: string[]) {
  const uniqueSuppliers = new Map<string, string>();
  supplierNames.filter(Boolean).forEach((name) => uniqueSuppliers.set(normalizeManagerName(name), name.trim()));
  const bySupplier: Record<string, SupplierBalance> = {};
  let debtTotal = 0;
  let advanceTotal = 0;
  let unsupportedCurrencyRows = 0;

  uniqueSuppliers.forEach((displayName, normalizedName) => {
    const matching = rows.filter((row) =>
      [row.supplierPartner, row.supplierCounterparty].some((name) => normalizeManagerName(name) === normalizedName),
    );
    unsupportedCurrencyRows += matching.filter((row) => !isRub(row.currency)).length;
    const closingBalance = money(matching
      .filter((row) => isRub(row.currency))
      .reduce((sum, row) => sum + row.closingBalance, 0));
    const balance = {
      debt: Math.max(0, -closingBalance),
      advance: Math.max(0, closingBalance),
      closingBalance,
    };
    bySupplier[displayName] = balance;
    debtTotal = money(debtTotal + balance.debt);
    advanceTotal = money(advanceTotal + balance.advance);
  });

  return { bySupplier, debtTotal, advanceTotal, unsupportedCurrencyRows };
}

export async function fetchSupplierSettlements() {
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl || !env.user || !env.password) throw new Error('SUPPLIER_SETTLEMENT_SOURCE_UNCONFIGURED');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(env.requestTimeoutMs) || 15_000);
  try {
    const response = await fetch(`${env.baseUrl}/supplier-settlements?nonzero_only=true&limit=5000`, {
      headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${env.user}:${env.password}`, 'utf8').toString('base64')}` },
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json() as { ok?: boolean; rows?: RawRow[]; totals?: { is_limited?: boolean } };
    if (!response.ok || payload.ok === false) throw new Error(`SUPPLIER_SETTLEMENT_SOURCE_HTTP_${response.status}`);
    const rawRows = Array.isArray(payload.rows) ? payload.rows : [];
    const rows = rawRows.map(normalizeSupplierSettlement).filter((row): row is SupplierSettlementRow => Boolean(row));
    const errors = rows.length === rawRows.length ? [] : ['SETTLEMENT_SUPPLIER_MISSING'];
    if (payload.totals?.is_limited === true) errors.push('SETTLEMENT_SOURCE_LIMITED');
    return { rows, checkedAt: new Date().toISOString(), complete: errors.length === 0, errors };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('SUPPLIER_SETTLEMENT_SOURCE_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
