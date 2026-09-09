import { createHash } from 'node:crypto';

export const PAYROLL_ONE_C_AGGREGATE_VERSION = 1;

export type PayrollOneCAggregateSourceKind = 'DAILY' | 'FINAL';

type SupplierRuleFingerprintValue = {
  normalizedName: string;
  isActive: boolean;
  updatedAt: Date | string;
};

type SourceSnapshotFingerprintValue = {
  kind: string;
  dateFrom: string;
  dateTo: string;
  contentHash: string;
  revision: number;
};

export type PayrollOneCControlAggregateEnvelope<T = unknown> = {
  version: typeof PAYROLL_ONE_C_AGGREGATE_VERSION;
  periodKey: string;
  sourceKind: PayrollOneCAggregateSourceKind;
  sourceFingerprint: string;
  supplierRulesFingerprint: string;
  response: T;
};

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function dateFingerprint(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function getPayrollOneCAggregateKind(sourceKind: PayrollOneCAggregateSourceKind) {
  return `AGGREGATE_${sourceKind}` as const;
}

export function getPayrollOneCSupplierRulesFingerprint(rules: SupplierRuleFingerprintValue[]) {
  return hash(rules
    .map((rule) => ({
      normalizedName: rule.normalizedName,
      isActive: rule.isActive,
      updatedAt: dateFingerprint(rule.updatedAt),
    }))
    .sort((left, right) => left.normalizedName.localeCompare(right.normalizedName, 'ru')));
}

export function getPayrollOneCSourceFingerprint(rows: SourceSnapshotFingerprintValue[]) {
  return hash(rows
    .map((row) => ({
      kind: row.kind,
      dateFrom: row.dateFrom,
      dateTo: row.dateTo,
      contentHash: row.contentHash,
      revision: row.revision,
    }))
    .sort((left, right) => left.dateFrom.localeCompare(right.dateFrom)
      || left.dateTo.localeCompare(right.dateTo)
      || left.kind.localeCompare(right.kind)));
}

export function createPayrollOneCControlAggregate<T>(input: {
  periodKey: string;
  sourceKind: PayrollOneCAggregateSourceKind;
  sourceFingerprint: string;
  supplierRulesFingerprint: string;
  response: T;
}): PayrollOneCControlAggregateEnvelope<T> {
  return {
    version: PAYROLL_ONE_C_AGGREGATE_VERSION,
    ...input,
  };
}

export function readPayrollOneCControlAggregate<T>(
  value: unknown,
  expected: {
    periodKey: string;
    sourceKind: PayrollOneCAggregateSourceKind;
    supplierRulesFingerprint: string;
  },
  isResponse: (response: unknown) => response is T,
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const envelope = value as Partial<PayrollOneCControlAggregateEnvelope>;
  if (envelope.version !== PAYROLL_ONE_C_AGGREGATE_VERSION
    || envelope.periodKey !== expected.periodKey
    || envelope.sourceKind !== expected.sourceKind
    || envelope.supplierRulesFingerprint !== expected.supplierRulesFingerprint
    || typeof envelope.sourceFingerprint !== 'string'
    || !isResponse(envelope.response)) return null;
  return envelope as PayrollOneCControlAggregateEnvelope<T>;
}
