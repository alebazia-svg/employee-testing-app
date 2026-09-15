import type { ForecastPosition } from './procurement-cash-forecast';

/** Only the owner-controlled accounts explicitly identified in 1C. */
export const OWNER_MONEY_ACCOUNTS = [
  { name: 'ВТБ КБР', type: 'bank' },
  { name: 'Т-Банк КБР', type: 'bank' },
  { name: 'Банк Альфа КБР', type: 'cash' },
  { name: 'Банк ВТБ КБР', type: 'cash' },
  { name: 'Банк ТБанк КБР', type: 'cash' },
  { name: 'Сейф Депозитный', type: 'cash' },
] as const;

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const nameKey = (value: unknown): string => text(value).toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ');
const accountKey = (name: string, type: string): string => `${type}\u0000${nameKey(name)}`;

function moneyMinor(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const scaled = value * 100;
  if (!Number.isSafeInteger(Math.round(scaled)) || Math.abs(scaled - Math.round(scaled)) > 0.00001) return null;
  return Math.round(scaled);
}

export type OwnerMoneySource = {
  positions: ForecastPosition[];
  complete: boolean;
  warnings: string[];
  accountNames: string[];
  currencyAssumedRubles: true;
};

export function parseOwnerMoneyStatements(payloads: unknown[], asOf: string): OwnerMoneySource {
  const warnings: string[] = [];
  const expected = new Map(OWNER_MONEY_ACCOUNTS.map((account) => [accountKey(account.name, account.type), account]));
  const seen = new Set<string>();
  const refs = new Set<string>();
  const positions: ForecastPosition[] = [];
  const accountNames: string[] = [];
  for (const kind of ['bank', 'cash']) {
    const matches = payloads.map(record).filter((payload) => payload?.money_type === kind);
    if (matches.length !== 1) {
      warnings.push(`statement_${kind}_missing_or_duplicate`);
      continue;
    }
    const payload = matches[0]!;
    if (payload.ok !== true || payload.endpoint !== 'money-statement' ||
      payload.date_from !== asOf || payload.date_to !== asOf ||
      payload.complete !== true || payload.truncated !== false ||
      !Array.isArray(payload.accounts)) {
      warnings.push(`statement_${kind}_incomplete`);
      continue;
    }
    for (const item of payload.accounts) {
      const row = record(item);
      const account = record(row?.account);
      const name = text(account?.name);
      const ref = text(account?.ref);
      const key = accountKey(name, kind);
      if (!expected.has(key)) {
        if (nameKey(name).includes('кбр') || nameKey(name).includes('сейф')) {
          warnings.push('new_owner_account_needs_mapping');
        }
        continue;
      }
      if (seen.has(key) || !ref || refs.has(ref)) {
        warnings.push('owner_account_duplicate_or_missing_ref');
        continue;
      }
      seen.add(key);
      refs.add(ref);
      const opening = moneyMinor(row?.opening_balance);
      const incoming = moneyMinor(row?.incoming_total);
      const outgoing = moneyMinor(row?.outgoing_total);
      const closing = moneyMinor(row?.closing_balance);
      if (row?.type !== kind || row?.group !== kind || row?.reconciled !== true ||
        opening == null || incoming == null || outgoing == null || closing == null ||
        opening + incoming - outgoing !== closing) {
        warnings.push('owner_account_arithmetic_or_type_mismatch');
        continue;
      }
      positions.push({ bucketId: `onec:${ref}`, currency: 'RUB', balanceMinor: closing,
        observedOn: asOf, verified: true });
      accountNames.push(name);
    }
  }
  if (seen.size !== expected.size || positions.length !== expected.size) {
    warnings.push('owner_account_set_incomplete');
  }
  // /money-statement identifies an explicit USDT group but does not expose a
  // currency field for ordinary bank/cash rows. RUB is a scoped business
  // assumption, not a validated API fact; readiness therefore remains false.
  return { positions, complete: warnings.length === 0, warnings: [...new Set(warnings)],
    accountNames, currencyAssumedRubles: true };
}
