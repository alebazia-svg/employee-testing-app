/** Complete, reconciled ledger evidence. Dates do not silently assign salary months. */
export type PayrollLedgerRead = { dateFrom: string; dateTo: string; checkedAt: string;
  employees: { employeeRef: string; employeeName: string }[]; movementCount: number;
  allocationEvidence?: {
    opening: { employeeRef: string; organizationRef: string; signedMinor: number }[];
    movements: { employeeRef: string; organizationRef: string; key: string; date: string; sign: number; amountMinor: number; kind: string; comment: string }[];
  } };
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('PAYROLL_LEDGER_SHAPE');
  return v as Record<string, unknown>;
};

/** Posted accruals explicitly labelled with a salary month, not a claim that
 * the month is finalized. Never reconstruct an accrual from cash or a balance. */
export function payrollPostedAccrual(ledger: PayrollLedgerRead | undefined, ref: string, period: string) {
  if (!ledger?.allocationEvidence || ledger.dateFrom > `${period}-01`) return null;
  const rows = ledger.allocationEvidence.movements.filter(r => r.employeeRef === ref && r.sign === -1);
  let total = 0, found = false;
  const stems = ['янв','фев','мар','апр','ма','июн','июл','авг','сент','окт','ноя','дек'];
  for (const row of rows) {
    // Owner confirmed these exact bonus lines as August premiums on 2026-10-18.
    // Match source identity and unchanged facts, never the generic word "bonus".
    const augustPremiums = [
      { key: 'd8eb7f2e-a5f9-11f1-b4fd-002590803daf:2', ref: '55161477-dada-11ea-971d-0025901e48ee', amount: 1000000 },
      { key: 'd8eb7f2e-a5f9-11f1-b4fd-002590803daf:3', ref: '0fae75a8-b8d2-11ed-a2b7-0025901e48ee', amount: 4250000 },
      { key: 'd8eb7f2e-a5f9-11f1-b4fd-002590803daf:4', ref: 'b46dff11-4e74-11eb-ad6f-0025901e48ee', amount: 1000000 },
    ];
    const premium = augustPremiums.some(p => p.key === row.key && p.ref === ref && p.amount === row.amountMinor)
      && row.organizationRef === '1c2d6c5c-251f-11ec-ac9f-0025901e48ee'
      && row.date === '2026-09-01' && row.kind === 'asset_liability_movement'
      && row.comment.trim() === 'Бонусы к продажам';
    if (premium) {
      if (period === '2026-08') { total += row.amountMinor; found = true; }
      continue;
    }
    const match = /^\s*(?:проценты|выходы?|фикс|зарплата|заработная плата)\s+(?:за\s+)?([а-яё]+)(?:\s+(20\d{2}))?\s*$/iu.exec(row.comment);
    const month = match ? stems.findIndex(s => match[1].toLowerCase().startsWith(s)) + 1 : 0;
    if (row.kind !== 'asset_liability_movement' || !month || row.amountMinor < 0) return null;
    const year = match![2] ? Number(match![2]) : Number(row.date.slice(0,4)) - (month > Number(row.date.slice(5,7)) ? 1 : 0);
    if (`${year}-${String(month).padStart(2,'0')}` === period) { total += row.amountMinor; found = true; }
  }
  return found ? total / 100 : null;
}
const amount = (v: unknown) => {
  if (typeof v !== 'number' || !Number.isSafeInteger(Math.round(v * 100)) || Math.abs(v * 100 - Math.round(v * 100)) > 0.00001) throw new Error('PAYROLL_LEDGER_AMOUNT');
  return Math.round(v * 100);
};
function timestamp(v: unknown) {
  if (typeof v !== 'string') throw new Error('PAYROLL_LEDGER_DATE');
  const russian = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/.exec(v);
  const iso = russian ? `${russian[3]}-${russian[2]}-${russian[1]}T${russian[4].padStart(2, '0')}:${russian[5]}:${russian[6]}` : v.replace(' ', 'T');
  const n = Date.parse(`${iso.length === 10 ? iso + 'T00:00:00' : iso}Z`);
  if (!Number.isFinite(n)) throw new Error('PAYROLL_LEDGER_DATE');
  return n;
}
export function parsePayrollLedgerResponse(value: unknown, dateFrom: string, dateTo: string, checkedAt: string): PayrollLedgerRead {
  const p = object(value);
  if (p.ok !== true || p.complete !== true || p.mode !== 'read-only' || p.write_operations !== false
    || p.contract_version !== 'payroll-ledger-v1' || p.article !== 'Заработная плата'
    || p.source !== 'РегистрНакопления.ПрочиеАктивыПассивы' || p.payroll_month_assignment !== 'not_inferred'
    || p.date_from !== dateFrom || p.date_to !== dateTo) throw new Error('PAYROLL_LEDGER_INCOMPLETE');
  const start = timestamp(dateFrom), end = timestamp(p.end_exclusive);
  if (end <= start || end < timestamp(dateTo) || end > timestamp(dateTo) + 86400000) throw new Error('PAYROLL_LEDGER_WINDOW');
  const totals = new Map<string, number>(), employees = new Map<string, string>();
  const identity = (r: Record<string, unknown>) => {
    const org = r.organization_ref, person = r.employee_ref;
    if (typeof org !== 'string' || typeof person !== 'string' || !org || typeof r.employee_name !== 'string') throw new Error('PAYROLL_LEDGER_IDENTITY');
    if (person && person !== '00000000-0000-0000-0000-000000000000') {
      if (employees.has(person) && employees.get(person) !== r.employee_name) throw new Error('PAYROLL_LEDGER_IDENTITY');
      employees.set(person, r.employee_name);
    }
    return `${org}:${person}`;
  };
  const add = (key: string, value: number) => {
    const sum = (totals.get(key) ?? 0) + value;
    if (!Number.isSafeInteger(sum)) throw new Error('PAYROLL_LEDGER_AMOUNT');
    totals.set(key, sum);
  };
  for (const [section, sign] of [['opening', 1], ['closing', -1]] as const) {
    const rows = p[section]; if (!Array.isArray(rows)) throw new Error('PAYROLL_LEDGER_SHAPE');
    const seen = new Set<string>();
    for (const raw of rows) {
      const r = object(raw), key = identity(r);
      if (seen.has(key)) throw new Error('PAYROLL_LEDGER_DUPLICATE'); seen.add(key);
      add(key, sign * amount(r.balance_signed));
    }
  }
  if (!Array.isArray(p.movements)) throw new Error('PAYROLL_LEDGER_SHAPE');
  const seen = new Set<string>();
  for (const raw of p.movements) {
    const r = object(raw), key = identity(r), date = timestamp(r.period);
    if (typeof r.document_ref !== 'string' || !r.document_ref || typeof r.line_number !== 'number' || !Number.isInteger(r.line_number) || r.line_number < 1
      || (r.sign !== 1 && r.sign !== -1) || date < start || date >= end) throw new Error('PAYROLL_LEDGER_MOVEMENT');
    const id = `${r.document_ref}:${r.line_number}`;
    if (seen.has(id)) throw new Error('PAYROLL_LEDGER_DUPLICATE'); seen.add(id);
    add(key, r.sign * amount(r.amount));
  }
  if ([...totals.values()].some(v => v !== 0)) throw new Error('PAYROLL_LEDGER_RECONCILIATION');
  return { dateFrom, dateTo, checkedAt, movementCount: seen.size,
    allocationEvidence: {
      opening: (p.opening as Record<string, unknown>[]).map(r => ({employeeRef: String(r.employee_ref).toLowerCase(), organizationRef: String(r.organization_ref), signedMinor: amount(r.balance_signed)})),
      movements: (p.movements as Record<string, unknown>[]).map(r => ({employeeRef: String(r.employee_ref).toLowerCase(), organizationRef: String(r.organization_ref), key: `${r.document_ref}:${r.line_number}`, date: new Date(timestamp(r.period)).toISOString().slice(0,10), sign: Number(r.sign), amountMinor: amount(r.amount), kind: String(r.document_kind ?? ''), comment: String(r.accrual_document_comment ?? '')})),
    },
    employees: [...employees].map(([employeeRef, employeeName]) => ({ employeeRef, employeeName })) };
}
