import { employeeSalaryBalance, type PayrollBalanceRead } from './payroll-one-c-balances';
import { resolvePayrollSettlementIdentities, type PayrollCashRead } from './payroll-one-c-payments';
import { payrollPaymentMonth } from './payroll-settlement-month';
import { payrollPostedAccrual, type PayrollLedgerRead } from './payroll-one-c-ledger';
import { oldestPayrollDebt } from './payroll-oldest-debt';
export type Evidence = { periodKey: string; balance: PayrollBalanceRead; cash: PayrollCashRead; ledger?: PayrollLedgerRead };
export function paymentCardSummary(data: Evidence | null, employee: string, names: string[]) {
  if (!data) return null;
  const refs = resolvePayrollSettlementIdentities(employee, names, data.periodKey, data.cash, data.balance, data.ledger?.employees);
  // Single-recipient employees keep the original helper path unchanged.
  const identity = refs?.length === 1 ? refs[0] : refs;
  const balance = employeeSalaryBalance(data.balance, identity);
  if (!refs || !identity || !balance) return null;
  const documents = data.cash.documents.filter(d => d.identityConfirmed && refs.includes(d.employeeRef.toLowerCase()));
  const monthly = refs.length === 1 ? oldestPayrollDebt(employee, refs[0], data.periodKey, data.ledger, data.cash, balance.remainingMinor) : null;
  const allocations = documents.map(document => ({document, parts: payrollPaymentMonth(employee, document)}));
  const advances = allocations.reduce((sum, {parts}) => sum + (parts?.period === data.periodKey ? Math.round(parts.advance * 100) : 0), 0) / 100;
  const periodPaid = allocations.reduce((sum, {document,parts}) => sum + (parts?.period === data.periodKey ? Math.round(document.amount * 100) : 0), 0) / 100;
  return { balance, documents, monthly, accruedInOneC: payrollPostedAccrual(data.ledger, identity, data.periodKey), advances: monthly?.advances ?? advances, periodPaid: monthly?.paid ?? periodPaid, unassigned: monthly ? 0 : allocations.filter(x=>!x.parts).length,
    paid: documents.reduce((s, d) => s + Math.round(d.amount * 100), 0) / 100 };
}
