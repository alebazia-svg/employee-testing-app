import 'server-only';

import { readOneCRuntimeEnv } from './one-c-env';

type SettlementRow = {
  supplier_partner?: unknown;
  supplier_counterparty?: unknown;
  currency?: unknown;
  closing_balance?: unknown;
};

export type ProcurementPriorityDebts = {
  asOf: string;
  ninetyFiveRu: number | null;
  tural: number | null;
  zelimChechnya: number | null;
  supplierDebts: Array<{ name: string; amountRub: number }>;
  sourceDraft: boolean;
  calculationReady: boolean;
};

/** Validate the report contract and monetary reconciliation, independently of its release label. */
export function settlementCalculationReady(payload: unknown): boolean {
  const p = payload as Record<string, any> | null;
  if (!p || p.ok !== true || p.endpoint !== 'supplier-settlements' || !Array.isArray(p.rows)
    || p.totals?.is_limited !== false || p.totals.rows_count !== p.rows.length
    || p.sign_convention !== 'Supplier debt is negative; overpayment or positive balance is positive. closing_balance = opening_balance - debt_increase + debt_decrease.') return false;
  const fields = ['opening_balance', 'debt_increase', 'debt_decrease', 'closing_balance'] as const;
  const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
    && Number.isSafeInteger(Math.round(n * 100)) && Math.abs(n * 100 - Math.round(n * 100)) < 0.00001;
  const cents = (n: number) => Math.round(n * 100);
  const totals = { opening_balance: 0, debt_increase: 0, debt_decrease: 0, closing_balance: 0 };
  for (const row of p.rows) {
    if (!row || row.currency !== 'руб' || !(row.supplier_partner || row.supplier_counterparty)
      || fields.some(key => !valid(row[key]))) return false;
    if (cents(row.opening_balance) - cents(row.debt_increase) + cents(row.debt_decrease) !== cents(row.closing_balance)) return false;
    for (const key of fields) totals[key] += cents(row[key]);
  }
  return fields.every(key => valid(p.totals[key]) && totals[key] === cents(p.totals[key]));
}

const normalized = (value: unknown) => typeof value === 'string'
  ? value.trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ')
  : '';

/** Supplier settlement balances are advisory until checked against the 1C report. */
export async function fetchProcurementPriorityDebts(asOf: string): Promise<ProcurementPriorityDebts> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('FORECAST_INVALID_DATE');
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl || !env.user || !env.password) throw new Error('FORECAST_ONE_C_UNCONFIGURED');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(env.requestTimeoutMs) || 15_000);
  try {
    const query = new URLSearchParams({ date_from: asOf, date_to: asOf, nonzero_only: 'true', limit: '5000' });
    const response = await fetch(`${env.baseUrl}/supplier-settlements?${query}`, {
      method: 'GET', cache: 'no-store', signal: controller.signal,
      headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${env.user}:${env.password}`, 'utf8').toString('base64')}` },
    });
    if (!response.ok) throw new Error(`FORECAST_SETTLEMENTS_HTTP_${response.status}`);
    const payload = await response.json() as {
      ok?: unknown; endpoint?: unknown; status?: unknown; date_from?: unknown; date_to?: unknown;
      rows?: unknown; totals?: { is_limited?: unknown; rows_count?: unknown };
    };
    if (payload.ok !== true || payload.endpoint !== 'supplier-settlements' ||
      payload.date_from !== asOf || payload.date_to !== asOf ||
      !Array.isArray(payload.rows) || payload.totals?.is_limited !== false ||
      payload.totals?.rows_count !== payload.rows.length) {
      throw new Error('FORECAST_SETTLEMENTS_INCOMPLETE');
    }
    const rows = payload.rows as SettlementRow[];
    function debtFor(name: string): number | null {
      const matches = rows.filter((row) =>
        normalized(row.supplier_partner) === name || normalized(row.supplier_counterparty) === name);
      if (!matches.length) return null;
      if (matches.some((row) => normalized(row.currency) !== 'руб' ||
        typeof row.closing_balance !== 'number' || !Number.isFinite(row.closing_balance))) {
        throw new Error('FORECAST_SETTLEMENTS_UNVERIFIED_ROW');
      }
      const sum = matches.reduce((total, row) => total + Number(row.closing_balance), 0);
      return Math.max(0, -sum);
    }
    const groupedDebts = new Map<string, { name: string; closing: number }>();
    for (const row of rows) {
      if (normalized(row.currency) !== 'руб') continue;
      if (typeof row.closing_balance !== 'number' || !Number.isFinite(row.closing_balance)) {
        throw new Error('FORECAST_SETTLEMENTS_UNVERIFIED_ROW');
      }
      const name = typeof row.supplier_partner === 'string' && row.supplier_partner.trim()
        ? row.supplier_partner.trim()
        : typeof row.supplier_counterparty === 'string' ? row.supplier_counterparty.trim() : '';
      const key = normalized(name);
      if (!key) continue;
      const current = groupedDebts.get(key) ?? { name, closing: 0 };
      current.closing += row.closing_balance;
      groupedDebts.set(key, current);
    }
    return {
      asOf,
      ninetyFiveRu: debtFor('95-ru'),
      tural: debtFor('tural'),
      zelimChechnya: debtFor('зелим чечня'),
      supplierDebts: [...groupedDebts.values()]
        .map((row) => ({ name: row.name, amountRub: Math.max(0, -row.closing) }))
        .filter((row) => row.amountRub > 0.009)
        .sort((left, right) => right.amountRub - left.amountRub || left.name.localeCompare(right.name, 'ru-RU')),
      sourceDraft: payload.status === 'draft',
      calculationReady: settlementCalculationReady(payload),
    };
  } finally {
    clearTimeout(timeout);
  }
}
