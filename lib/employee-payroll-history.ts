import { getPrivatePayrollBinding } from './payroll-current-read';
import type { PayrollDirectoryUser } from './payroll-calculation-engine';
import type { PersonalPayrollRun } from './employee-payroll-read';
import type { PayrollCashRead } from './payroll-one-c-payments';
import type { PayrollLedgerRead } from './payroll-one-c-ledger';
import { payrollPostedAccrual, payrollLedgerAccrualPeriod } from './payroll-one-c-ledger';
import { payrollPaymentMonth } from './payroll-settlement-month';

// Legacy FINAL rows lack userId. An explicit, unique ADMIN payrollName owns a
// named person's history; shared/reused trainee labels never grant access.
// This is a read projection only: immutable saved rows are not rebound in DB.
export function bindPersonalPayrollHistory(run: PersonalPayrollRun, users: PayrollDirectoryUser[], userId: number) {
  const name = getPrivatePayrollBinding(users, userId);
  const user = users.find(row => row.id === userId);
  const period = run.period.periodKey;
  if (!name || !user || /стаж[её]р|тест|администратор/iu.test(name)
    || (user.payrollRuleFrom && period < user.payrollRuleFrom)
    || (user.payrollRuleThrough && period > user.payrollRuleThrough)) return null;
  const rows = run.employeeResults.filter(row => row.userId === userId || row.employeeName === name);
  if (rows.length !== 1 || rows[0].employeeName !== name
    || (rows[0].userId !== null && rows[0].userId !== userId)) return null;
  return { name, run: { ...run, employeeResults: [{ ...rows[0], userId }] } };
}

// Never net money between organizations, infer an earning month from ledger
// dates, or use an unmatched cash movement to manufacture a prior credit.
function earlierPayrollCreditMinor(period: string, name: string, ref: string, cash: PayrollCashRead, ledger: PayrollLedgerRead) {
  const evidence = ledger.allocationEvidence;
  if (!evidence || ledger.dateFrom !== cash.dateFrom) return null;
  const opening = evidence.opening.filter(row => row.employeeRef === ref);
  const movements = evidence.movements.filter(row => row.employeeRef === ref);
  if (new Set([...opening, ...movements].map(row => row.organizationRef)).size !== 1) return null;
  // 1C document-table row numbers and accounting-register line numbers are
  // different domains. Bind the unique document/person/date/amount, not line N.
  const recorder = (key: string) => key.includes(':') ? key.slice(0, key.lastIndexOf(':')) : key;
  const matchesCash = (document: PayrollCashRead['documents'][number], row: typeof movements[number]) =>
    document.employeeRef.toLowerCase() === ref && document.identityConfirmed
    && row.sign === 1 && row.kind === 'cash_expense'
    && recorder(document.key) === recorder(row.key) && document.documentDate === row.date
    && Math.round(document.amount * 100) === row.amountMinor;
  if (cash.documents.filter(document => document.employeeRef.toLowerCase() === ref).some(document =>
    movements.filter(row => matchesCash(document, row)).length !== 1)) return null;
  let credit = opening.reduce((sum, row) => sum + row.signedMinor, 0);
  const seen = new Set<string>();
  for (const row of movements) {
    if (seen.has(row.key) || !Number.isSafeInteger(row.amountMinor) || row.amountMinor < 0) return null;
    seen.add(row.key);
    if (row.sign === -1 && row.kind === 'asset_liability_movement') {
      const assigned = payrollLedgerAccrualPeriod(row);
      if (!assigned) return null;
      if (assigned < period) credit -= row.amountMinor;
    } else if (row.sign === 1 && row.kind === 'cash_expense') {
      const documents = cash.documents.filter(document => matchesCash(document, row));
      if (documents.length !== 1) return null;
      const assigned = payrollPaymentMonth(name, documents[0]);
      if (!assigned) return null;
      if (assigned.period < period) credit += row.amountMinor;
    } else return null;
    if (!Number.isSafeInteger(credit)) return null;
  }
  return Math.max(0, credit);
}

export type PersonalSettlement = { accrued: number; paid: number | null; remaining: number | null; creditedFromEarlier?: number };
export function projectPersonalSettlement(period: string, name: string, cash: PayrollCashRead, ledger: PayrollLedgerRead): PersonalSettlement | null {
  if (cash.dateFrom > `${period}-01` || ledger.dateFrom > `${period}-01` || cash.dateTo !== ledger.dateTo) return null;
  // Strict personal identity, not the ADMIN's broader reviewed alias resolver.
  const normalize = (value: string) => value.trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
  const samePerson = (value: string) => {
    const source = normalize(value), target = normalize(name);
    // 1C may include one patronymic after the exact surname and given name.
    // Never accept initials, misspellings, reordered names or trainee aliases.
    return source === target || (target.split(' ').length === 2 && source.startsWith(`${target} `)
      && source.split(' ').length === 3);
  };
  const matches = [...ledger.employees, ...cash.documents].filter(row => samePerson(row.employeeName));
  const refs = new Set(matches.map(row => row.employeeRef.toLowerCase()));
  if (refs.size !== 1) return null;
  const ref = [...refs][0];
  if ([...ledger.employees, ...cash.documents].some(row => row.employeeRef.toLowerCase() === ref && !samePerson(row.employeeName))) return null;
  const accrued = payrollPostedAccrual(ledger, ref, period);
  if (accrued === null || !Number.isFinite(accrued) || accrued < 0) return null;
  let paidMinor = 0;
  const seen = new Set<string>();
  for (const document of cash.documents.filter(row => row.employeeRef.toLowerCase() === ref)) {
    const allocation = payrollPaymentMonth(name, document);
    if (!allocation || seen.has(document.key) || !Number.isFinite(document.amount) || document.amount <= 0) return { accrued, paid: null, remaining: null };
    seen.add(document.key);
    if (allocation.period === period) paidMinor += Math.round(document.amount * 100);
  }
  if (!Number.isSafeInteger(paidMinor) || paidMinor > Math.round(accrued * 100)) return { accrued, paid: null, remaining: null };
  const difference = Math.round(accrued * 100) - paidMinor;
  const earlierCredit = difference > 0 ? earlierPayrollCreditMinor(period, name, ref, cash, ledger) : 0;
  if (earlierCredit === null) return { accrued, paid: null, remaining: null };
  const credit = Math.min(difference, earlierCredit);
  return { accrued, paid: paidMinor / 100, remaining: (difference - credit) / 100,
    ...(credit > 0 ? { creditedFromEarlier: credit / 100 } : {}) };
}
