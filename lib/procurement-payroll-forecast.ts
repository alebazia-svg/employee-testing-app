/** Read-only interpretation of the 1C salary liability, never an RKO or a payment instruction. */
const KNOWN_OLD_BALANCES = new Map([
  ['f393105e-c21e-11f0-a343-002590803daf', 100],
  ['28f0fcba-4636-11f0-a789-002590803daf', 20],
  ['8ba11a1f-21b3-11e7-b061-0025901e48ee', 150],
  ['f8065f93-1a33-11f0-b3d7-002590803daf', 16000],
]);
const REVIEWED_CURRENT_REFS = new Set([
  '0ae3c1ac-6d4e-11f1-81d1-002590803daf',
  '850a1f47-0cad-11ec-8be7-0025901e48ee',
  '55161477-dada-11ea-971d-0025901e48ee',
  '5620e13a-889c-11f0-a244-002590803daf',
  '0fae75a8-b8d2-11ed-a2b7-0025901e48ee',
  '13300392-e2e6-11e1-a47e-0025901e48ef',
  '420e990c-201d-11ef-ac00-002590803daf',
  'b46dff11-4e74-11eb-ad6f-0025901e48ee',
  'b1f3de63-a3cd-11e9-b160-0025901e48ee',
]);

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | null => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;

function minor(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const scaled = Math.round(value * 100);
  return Number.isSafeInteger(scaled) && Math.abs(value * 100 - scaled) < 0.00001 ? scaled : null;
}

export type PayrollForecastEvidence = {
  payableMinor: number | null;
  grossNegativeMinor: number | null;
  knownOldMinor: number;
  unassignedPositiveMinor: number;
  unreviewedMinor: number;
  sourceComplete: boolean;
  warnings: string[];
};

export function parsePayrollForecastEvidence(payload: unknown, asOf: string): PayrollForecastEvidence {
  const root = record(payload);
  const warnings: string[] = [];
  let unreviewedMinor = 0;
  const fallback = (): PayrollForecastEvidence => ({
    payableMinor: null, grossNegativeMinor: null, knownOldMinor: 1627000,
    unassignedPositiveMinor: 0, unreviewedMinor, sourceComplete: false, warnings,
  });
  if (!root || root.ok !== true || root.endpoint !== 'payroll-balance' ||
    root.as_of !== asOf || root.complete !== true || root.totals_scope !== 'returned_rows' ||
    !Array.isArray(root.rows)) {
    warnings.push('payroll_source_incomplete');
    return fallback();
  }
  const totals = record(root.totals);
  if (!totals || totals.rows !== root.rows.length || root.balance_sign_interpretation !== 'not_validated_against_report') {
    warnings.push('payroll_contract_changed');
    return fallback();
  }
  const seen = new Set<string>();
  const excluded = new Set<string>();
  let signedTotal = 0;
  let grossNegativeMinor = 0;
  let oldMinor = 0;
  let unassignedPositiveMinor = 0;
  for (const value of root.rows) {
    const row = record(value);
    const ref = typeof row?.employee_ref === 'string' ? row.employee_ref : '';
    const amount = minor(row?.closing_balance_signed);
    if (!ref || amount == null || seen.has(ref)) {
      warnings.push('payroll_row_invalid_or_duplicate');
      return fallback();
    }
    seen.add(ref);
    signedTotal += amount;
    if (amount < 0) grossNegativeMinor += -amount;
    if (KNOWN_OLD_BALANCES.has(ref)) {
      excluded.add(ref);
      const expected = KNOWN_OLD_BALANCES.get(ref)! * 100;
      if (amount !== -expected) warnings.push('known_old_balance_changed');
      oldMinor += -amount;
    }
    if (ref === '00000000-0000-0000-0000-000000000000') {
      if (amount < 0) warnings.push('unassigned_salary_debt');
      else unassignedPositiveMinor += amount;
    } else if (!KNOWN_OLD_BALANCES.has(ref) && !REVIEWED_CURRENT_REFS.has(ref) && amount !== 0) {
      unreviewedMinor += Math.abs(amount);
      warnings.push('new_salary_person_needs_review');
    }
  }
  if (excluded.size !== KNOWN_OLD_BALANCES.size) warnings.push('known_old_balance_missing');
  if (minor(totals.closing_balance_signed) !== signedTotal) warnings.push('payroll_total_mismatch');
  if (warnings.length) return fallback();
  return {
    payableMinor: grossNegativeMinor - oldMinor,
    grossNegativeMinor, knownOldMinor: oldMinor, unassignedPositiveMinor, unreviewedMinor,
    sourceComplete: true, warnings,
  };
}
