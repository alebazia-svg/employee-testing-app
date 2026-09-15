export const TBANK_OWNER_TRANSFER_TERMS = {
  effectiveFrom: '2026-08-22',
  renewalDay: 22,
  debitFreeMinor: 80_000_000,
  packageMinor: 120_000_000,
  packageFeeMinor: 849_000,
  packageCount: 2,
  tierOneMinor: 80_000_000,
  tierOneRateBps: 100,
  tierFiveMinor: 120_000_000,
  tierFiveRateBps: 500,
  furtherRateBps: 1500,
  fixedFeeMinor: 5_900,
} as const;

type RecordValue = Record<string, unknown>;

export type TBankOwnerTransferControl = {
  status: 'verified' | 'review' | 'unavailable';
  asOf: string;
  periodFrom: string;
  renewsOn: string;
  transferredMinor: number | null;
  packagesPurchased: number | null;
  freeLimitMinor: number | null;
  freeRemainingMinor: number | null;
  tierOneUsedMinor: number | null;
  tierOneRemainingMinor: number | null;
  tierFiveUsedMinor: number | null;
  tierFiveRemainingMinor: number | null;
  currentRateBps: number | null;
  nextTransferFeeMinor: ((amountMinor: number) => number) | null;
  diagnostics: string[];
};

const record = (value: unknown): RecordValue | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;

function isoDay(value: unknown): string {
  if (typeof value !== 'string') return '';
  const raw = value.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) return raw.split('.').reverse().join('-');
  return '';
}

function amountMinor(value: unknown): number | null {
  const number = typeof value === 'number' ? value
    : typeof value === 'string' ? Number(value.replace(/\s/g, '').replace(',', '.')) : NaN;
  if (!Number.isFinite(number)) return null;
  const minor = Math.round(number * 100);
  return Number.isSafeInteger(minor) && Math.abs(number * 100 - minor) < 0.001 ? minor : null;
}

function addMonth(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export function tbankTransferPeriod(asOf: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('TBANK_TRANSFER_INVALID_DATE');
  const [year, month, day] = asOf.split('-').map(Number);
  const currentRenewal = `${year}-${String(month).padStart(2, '0')}-${TBANK_OWNER_TRANSFER_TERMS.renewalDay}`;
  const periodFrom = day >= TBANK_OWNER_TRANSFER_TERMS.renewalDay
    ? currentRenewal
    : (() => {
        const previous = new Date(Date.UTC(year, month - 2, TBANK_OWNER_TRANSFER_TERMS.renewalDay, 12));
        return previous.toISOString().slice(0, 10);
      })();
  return { periodFrom, renewsOn: addMonth(periodFrom) };
}

function purpose(row: RecordValue): string {
  return typeof row.purpose === 'string' ? row.purpose.trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е') : '';
}

function operationKey(row: RecordValue): string | null {
  const direction = typeof row.direction === 'string' ? row.direction : '';
  const number = typeof row.document_number === 'string' ? row.document_number.trim() : '';
  const date = isoDay(row.document_date);
  const minor = amountMinor(row.amount);
  return direction && number && date && minor !== null ? `${direction}\u0000${number}\u0000${date}\u0000${minor}` : null;
}

function empty(asOf: string, diagnostics: string[]): TBankOwnerTransferControl {
  const period = tbankTransferPeriod(asOf);
  return {
    status: 'unavailable', asOf, ...period, transferredMinor: null, packagesPurchased: null,
    freeLimitMinor: null, freeRemainingMinor: null, tierOneUsedMinor: null,
    tierOneRemainingMinor: null, tierFiveUsedMinor: null, tierFiveRemainingMinor: null,
    currentRateBps: null, nextTransferFeeMinor: null, diagnostics,
  };
}

/**
 * Turns overlapping DirectBank statement packets into one conservative limit
 * position. It never treats raw rows as unique operations.
 */
export function parseTBankOwnerTransferStatement(payload: unknown, asOf: string): TBankOwnerTransferControl {
  const period = tbankTransferPeriod(asOf);
  const root = record(payload);
  const controlPeriod = record(root?.control_period);
  if (!root || root.ok !== true || root.endpoint !== 'bank-exchange-statement-operations'
    || controlPeriod?.date_from !== period.periodFrom || controlPeriod?.date_to !== asOf
    || !Array.isArray(root.operations) || !Array.isArray(root.statement_summaries)) {
    return empty(asOf, ['statement_unavailable_or_wrong_period']);
  }
  const found = Number(root.operations_found);
  const returned = Number(root.operations_returned);
  if (!Number.isSafeInteger(found) || !Number.isSafeInteger(returned) || found !== returned || returned > 500) {
    return empty(asOf, ['statement_truncated']);
  }

  const relevantStatements = root.statement_summaries
    .map(record)
    .filter((row): row is RecordValue => Boolean(row) && isoDay(row?.period_end) >= period.periodFrom);
  const latestStatementDay = relevantStatements.reduce(
    (latest, row) => isoDay(row.period_end) > latest ? isoDay(row.period_end) : latest,
    '',
  );
  if (latestStatementDay < asOf) return empty(asOf, ['statement_not_current']);

  const diagnostics: string[] = [];
  const latestStatements = relevantStatements.filter((row) => isoDay(row.period_end) === latestStatementDay);
  if (latestStatements.length === 0 || latestStatements.some((row) => row.statement_balance_valid !== true)) {
    diagnostics.push('statement_balance_not_verified');
  }
  if (Array.isArray(root.warnings) && root.warnings.length > 0) diagnostics.push('statement_has_warnings');
  const unique = new Map<string, RecordValue>();
  for (const value of root.operations) {
    const row = record(value);
    const key = row && operationKey(row);
    if (!row || !key) {
      diagnostics.push('statement_operation_invalid');
      continue;
    }
    unique.set(key, row);
  }
  if (diagnostics.includes('statement_operation_invalid')) return empty(asOf, diagnostics);

  const outgoing = [...unique.values()].filter((row) => row.direction === 'outgoing');
  const transfers = outgoing.filter((row) => purpose(row).startsWith('перевод собственных средств'));
  const transferredMinor = transfers.reduce((sum, row) => sum + (amountMinor(row.amount) ?? 0), 0);
  const packageCharges = outgoing.filter((row) => {
    const label = purpose(row);
    return amountMinor(row.amount) === TBANK_OWNER_TRANSFER_TERMS.packageFeeMinor
      && (label.includes('пакет') || label.includes('комисс'));
  });
  const packageKeys = new Set(packageCharges.map(operationKey).filter(Boolean));
  const packagesPurchased = Math.min(packageKeys.size, TBANK_OWNER_TRANSFER_TERMS.packageCount);
  if (packageKeys.size > TBANK_OWNER_TRANSFER_TERMS.packageCount) diagnostics.push('package_charge_count_unexpected');

  const freeLimitMinor = TBANK_OWNER_TRANSFER_TERMS.debitFreeMinor
    + packagesPurchased * TBANK_OWNER_TRANSFER_TERMS.packageMinor;
  const freeRemainingMinor = Math.max(0, freeLimitMinor - transferredMinor);
  const afterFree = Math.max(0, transferredMinor - freeLimitMinor);
  const tierOneUsedMinor = Math.min(afterFree, TBANK_OWNER_TRANSFER_TERMS.tierOneMinor);
  const tierOneRemainingMinor = TBANK_OWNER_TRANSFER_TERMS.tierOneMinor - tierOneUsedMinor;
  const tierFiveUsedMinor = Math.min(
    Math.max(0, afterFree - TBANK_OWNER_TRANSFER_TERMS.tierOneMinor),
    TBANK_OWNER_TRANSFER_TERMS.tierFiveMinor,
  );
  const tierFiveRemainingMinor = TBANK_OWNER_TRANSFER_TERMS.tierFiveMinor - tierFiveUsedMinor;
  const currentRateBps = freeRemainingMinor > 0 ? 0
    : tierOneRemainingMinor > 0 ? TBANK_OWNER_TRANSFER_TERMS.tierOneRateBps
      : tierFiveRemainingMinor > 0 ? TBANK_OWNER_TRANSFER_TERMS.tierFiveRateBps
        : TBANK_OWNER_TRANSFER_TERMS.furtherRateBps;

  // A paid-tier transfer must have bank commission evidence. Absence does not
  // invent a zero fee: it downgrades the result to review.
  if (afterFree > 0) {
    const fees = outgoing.filter((row) => purpose(row).includes('комиссия за вывод средств на физ'));
    if (fees.length === 0) diagnostics.push('paid_tier_fee_not_found');
  }

  return {
    status: diagnostics.length ? 'review' : 'verified', asOf, ...period, transferredMinor,
    packagesPurchased, freeLimitMinor, freeRemainingMinor, tierOneUsedMinor,
    tierOneRemainingMinor, tierFiveUsedMinor, tierFiveRemainingMinor, currentRateBps,
    nextTransferFeeMinor: (value) => {
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error('TBANK_TRANSFER_INVALID_AMOUNT');
      return currentRateBps === 0 ? 0
        : Math.ceil(value * currentRateBps / 10_000) + TBANK_OWNER_TRANSFER_TERMS.fixedFeeMinor;
    },
    diagnostics,
  };
}
