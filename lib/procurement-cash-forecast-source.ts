import type { ForecastPosition } from './procurement-cash-forecast';

/** Only the owner-controlled accounts explicitly identified in 1C. */
export const OWNER_MONEY_ACCOUNTS = [
  { name: 'ВТБ КБР', type: 'bank' },
  { name: 'Т-Банк КБР', type: 'bank' },
  { name: 'АЛЬФА-БАНК', type: 'bank' },
  { name: 'Банк Альфа КБР', type: 'cash' },
  { name: 'Банк ВТБ КБР', type: 'cash' },
  { name: 'Банк ТБанк КБР', type: 'cash' },
  { name: 'Сейф Депозитный', type: 'cash' },
] as const;

export const VTB_OWNER_ACCOUNT = { name: 'ВТБ КБР', type: 'bank', ref: '92d97ba1-db2c-11f0-b07d-002590803daf' } as const;

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

export type EmptyOwnerAccountProof = { name: string; type: string; ref: string; payload: unknown };

export function parseOwnerMoneyStatements(payloads: unknown[], asOf: string, emptyProofs: EmptyOwnerAccountProof[] = []): OwnerMoneySource {
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
        // The expense safe is an existing operational cashbox outside the
        // agreed owner-funds scope, not a newly discovered owner account.
        const knownOperationalSafe = kind === 'cash' && nameKey(name) === 'сейф расходный';
        if (!knownOperationalSafe && (nameKey(name).includes('кбр') || nameKey(name).includes('сейф'))) {
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
  // 1C omits all-zero accounts from ОстаткиИОбороты. Only an independently
  // identified account's complete, explicitly scoped empty statement proves zero.
  // Missing rows in a general statement alone never supply a zero balance.
  for (const proof of emptyProofs) {
    const key = accountKey(proof.name, proof.type);
    const payload = record(proof.payload);
    if (proof.name !== VTB_OWNER_ACCOUNT.name || proof.type !== VTB_OWNER_ACCOUNT.type || proof.ref !== VTB_OWNER_ACCOUNT.ref
      || !expected.has(key) || seen.has(key) || refs.has(proof.ref)
      || payload?.ok !== true || payload.endpoint !== 'money-statement'
      || payload.date_from !== asOf || payload.date_to !== asOf || payload.money_type !== proof.type
      || payload.account_ref !== proof.ref || payload.complete !== true || payload.truncated !== false
      || !Array.isArray(payload.accounts) || payload.accounts.length !== 0
      || !Array.isArray(payload.movements) || payload.movements.length !== 0 || payload.movements_returned !== 0) continue;
    seen.add(key); refs.add(proof.ref);
    positions.push({ bucketId: `onec:${proof.ref}`, currency: 'RUB', balanceMinor: 0, observedOn: asOf, verified: true });
    accountNames.push(proof.name);
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
