/** Full 1C salary balances, not a reconstruction from portal accruals. */
export type PayrollBalanceRead = {
  version: 1;
  asOf: string;
  checkedAt: string;
  rows: { organizationRef: string; employeeRef: string; employeeName: string; signedMinor: number }[];
};

const record = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
const zeroRef = '00000000-0000-0000-0000-000000000000';
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function minor(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isSafeInteger(Math.round(v * 100))
    || Math.abs(v * 100 - Math.round(v * 100)) > 0.00001) throw new Error('PAYROLL_BALANCE_INVALID_AMOUNT');
  return Math.round(v * 100);
}

export function parsePayrollBalanceResponse(payload: unknown, asOf: string, checkedAt: string): PayrollBalanceRead {
  const p = record(payload), totals = record(p?.totals);
  if (!/^20\d{2}-(0[1-9]|1[0-2])-([012]\d|3[01])$/.test(asOf)
    || !Number.isFinite(Date.parse(asOf)) || new Date(asOf).toISOString().slice(0, 10) !== asOf
    || !Number.isFinite(Date.parse(checkedAt))
    || !p || p.ok !== true || p.endpoint !== 'payroll-balance' || p.contract_version !== 'payroll-balance-v1'
    || p.mode !== 'read-only' || p.write_operations !== false || p.complete !== true
    || p.as_of !== asOf || p.organization_filter !== '' || p.article !== 'Заработная плата'
    || p.source !== 'РегистрНакопления.ПрочиеАктивыПассивы.Остатки'
    || p.totals_scope !== 'returned_rows' || p.balance_sign_interpretation !== 'not_validated_against_report'
    || !Array.isArray(p.rows) || !totals || totals.rows !== p.rows.length) {
    throw new Error('PAYROLL_BALANCE_INCOMPLETE');
  }
  const seen = new Set<string>();
  let sum = 0, unassigned = 0;
  const rows = p.rows.map(value => {
    const row = record(value);
    const organizationRef = String(row?.organization_ref ?? '').toLowerCase();
    const employeeRef = String(row?.employee_ref ?? '').toLowerCase();
    const employeeName = typeof row?.employee_name === 'string' ? row.employee_name.trim() : '';
    const key = `${organizationRef}:${employeeRef}`;
    if (!guid.test(organizationRef) || organizationRef === zeroRef || !guid.test(employeeRef)
      || (employeeRef !== zeroRef && !employeeName) || seen.has(key)) throw new Error('PAYROLL_BALANCE_INVALID_IDENTITY');
    seen.add(key);
    const signedMinor = minor(row?.closing_balance_signed);
    sum += signedMinor;
    if (!Number.isSafeInteger(sum)) throw new Error('PAYROLL_BALANCE_INVALID_AMOUNT');
    if (employeeRef === zeroRef) unassigned++;
    return { organizationRef, employeeRef, employeeName, signedMinor };
  });
  if (minor(totals.closing_balance_signed) !== sum || totals.rows_without_employee !== unassigned) {
    throw new Error('PAYROLL_BALANCE_TOTAL_MISMATCH');
  }
  return { version: 1, asOf, checkedAt, rows };
}

/** Caller must supply a confirmed 1C identity, never a guessed name match.
 * The complete balance register omits zero rows. An unknown identity stays unknown.
 * Debts in different organizations are not offset against each other's credits.
 */
export function employeeSalaryBalance(read: PayrollBalanceRead | null, confirmedEmployeeRef: string | null) {
  if (!read || !confirmedEmployeeRef || !guid.test(confirmedEmployeeRef) || confirmedEmployeeRef === zeroRef) return null;
  const rows = read.rows.filter(row => row.employeeRef === confirmedEmployeeRef.toLowerCase());
  return {
    remainingMinor: rows.reduce((sum, row) => sum + Math.max(0, -row.signedMinor), 0),
    creditMinor: rows.reduce((sum, row) => sum + Math.max(0, row.signedMinor), 0),
    asOf: read.asOf,
  };
}
