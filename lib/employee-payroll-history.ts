import { getPrivatePayrollBinding } from './payroll-current-read';
import type { PayrollDirectoryUser } from './payroll-calculation-engine';
import type { PersonalPayrollRun } from './employee-payroll-read';
import type { PayrollCashRead } from './payroll-one-c-payments';
import type { PayrollLedgerRead } from './payroll-one-c-ledger';
import { payrollPostedAccrual } from './payroll-one-c-ledger';
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

export type PersonalSettlement = { accrued: number; paid: number | null; remaining: number | null };
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
  return { accrued, paid: paidMinor / 100, remaining: (Math.round(accrued * 100) - paidMinor) / 100 };
}
