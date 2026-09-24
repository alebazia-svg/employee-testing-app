import 'server-only';

import { readOneCRuntimeEnv } from '@/lib/one-c-env';
import { normalizeManagerName } from '@/lib/procurement-payment-source';

export type SupplierSettlementRow = {
  supplierPartner: string;
  supplierCounterparty: string;
  currency: string;
  closingBalance: number;
  contract?: string;
  organization?: string;
};

export type SupplierBalance = {
  debt: number;
  advance: number;
  closingBalance: number;
  reviewRequired?: boolean;
  reviewReason?: string;
  debtByContract?: number;
  advanceByContract?: number;
};

type RawRow = Record<string, unknown>;

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
const isRub = (value: string) => ['руб', 'rub', '₽', 'российский рубль'].includes(normalizeManagerName(value));
const money = (value: number) => Math.round(value * 100) / 100;

export function normalizeSupplierSettlement(row: RawRow): SupplierSettlementRow | null {
  const supplierPartner = text(row.supplier_partner);
  const supplierCounterparty = text(row.supplier_counterparty);
  if ((!supplierPartner && !supplierCounterparty) || typeof row.closing_balance !== 'number' || !Number.isFinite(row.closing_balance)) return null;
  return {
    supplierPartner,
    supplierCounterparty,
    currency: text(row.currency),
    closingBalance: amount(row.closing_balance),
    contract: typeof row.contract === 'string' ? row.contract.trim() : undefined,
    organization: typeof row.organization === 'string' ? row.organization.trim() : undefined,
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
    // Keep each legal/contract/currency scope intact. Netting across scopes is
    // a reference total, never proof that an advance settled a different debt.
    const groups = new Map<string, number>();
    const legalGroups = new Map<string, number>();
    const namedContracts = new Set<string>();
    let ambiguous = false;
    for (const row of matching) {
      const key = JSON.stringify([row.organization, row.supplierPartner, row.supplierCounterparty, row.contract, row.currency]);
      if (groups.has(key)) ambiguous = true;
      groups.set(key, money((groups.get(key) || 0) + row.closingBalance));
      const legalKey = JSON.stringify([row.organization, row.supplierPartner, row.supplierCounterparty, row.currency]);
      legalGroups.set(legalKey, money((legalGroups.get(legalKey) || 0) + row.closingBalance));
      if (row.contract && Math.abs(row.closingBalance)>0.009) namedContracts.add(row.contract);
    }
    const debtByContract = money([...groups.values()].reduce((sum, value) => sum + Math.max(0, -value), 0));
    const advanceByContract = money([...groups.values()].reduce((sum, value) => sum + Math.max(0, value), 0));
    // Owner-approved: an omitted contract alone is not uncertainty. A matching
    // advance in the same legal/currency scope offsets the supplier position,
    // without claiming any individual acquisition was paid.
    const missingScope = matching.some(row => Math.abs(row.closingBalance) > 0.009 && (!row.organization || !row.supplierCounterparty));
    const mixedScopes = debtByContract > 0.009 && advanceByContract > 0.009
      && (legalGroups.size > 1 || namedContracts.size > 1);
    const reviewRequired = ambiguous || missingScope || mixedScopes || matching.some(row => !isRub(row.currency));
    const balance = {
      debt: Math.max(0, -closingBalance),
      advance: Math.max(0, closingBalance),
      closingBalance,
      reviewRequired,
      reviewReason: mixedScopes ? 'Долг и аванс на разных основаниях' : missingScope ? 'Не заполнены реквизиты расчётов' : reviewRequired ? 'Неоднозначные данные расчётов' : '',
      debtByContract,
      advanceByContract,
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
    if (!response.ok || payload.ok !== true || !Array.isArray(payload.rows) || typeof payload.totals?.is_limited !== 'boolean') throw new Error(`SUPPLIER_SETTLEMENT_SOURCE_HTTP_${response.status}`);
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
