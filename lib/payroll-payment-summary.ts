import { employeeSalaryBalance, type PayrollBalanceRead } from './payroll-one-c-balances';
import { resolvePayrollSettlementIdentity, type PayrollCashRead } from './payroll-one-c-payments';
import { payrollPaymentMonth } from './payroll-settlement-month';
import { payrollPostedAccrual, type PayrollLedgerRead } from './payroll-one-c-ledger';
import { oldestPayrollDebt } from './payroll-oldest-debt';
export type Evidence = { periodKey: string; balance: PayrollBalanceRead; cash: PayrollCashRead; ledger?: PayrollLedgerRead };
export function paymentCardSummary(data: Evidence | null, employee: string, names: string[]) {
  if (!data) return null;
  const ref = resolvePayrollSettlementIdentity(employee, names, data.periodKey, data.cash, data.balance, data.ledger?.employees);
  const balance = employeeSalaryBalance(data.balance, ref);
  if (!ref || !balance) return null;
  const documents = data.cash.documents.filter(d => d.identityConfirmed && d.employeeRef.toLowerCase() === ref);
  const monthly = oldestPayrollDebt(employee, ref, data.periodKey, data.ledger, data.cash, balance.remainingMinor);
  const allocations = documents.map(document => ({document, parts: payrollPaymentMonth(employee, document)}));
  const advances = allocations.reduce((sum, {parts}) => sum + (parts?.period === data.periodKey ? Math.round(parts.advance * 100) : 0), 0) / 100;
  const periodPaid = allocations.reduce((sum, {document,parts}) => sum + (parts?.period === data.periodKey ? Math.round(document.amount * 100) : 0), 0) / 100;
  return { balance, documents, monthly, accruedInOneC: payrollPostedAccrual(data.ledger, ref, data.periodKey), advances: monthly?.advances ?? advances, periodPaid: monthly?.paid ?? periodPaid, unassigned: monthly ? 0 : allocations.filter(x=>!x.parts).length,
    paid: documents.reduce((s, d) => s + Math.round(d.amount * 100), 0) / 100 };
}
