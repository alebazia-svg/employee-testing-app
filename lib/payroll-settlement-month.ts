import type { PayrollCashRead } from './payroll-one-c-payments';
import { confirmedPayrollPaymentBreakdown, confirmedProcurementAdvance } from './payroll-payment-breakdown';

type Payment = PayrollCashRead['documents'][number];
export function payrollPaymentDateColumn(period: string, issuedOn: string): 'first' | 'second' | 'other' {
  const [year, month] = period.split('-').map(Number);
  const next = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
  return issuedOn === `${next}-01` ? 'first' : issuedOn === `${next}-16` ? 'second' : 'other';
}
export type PaymentMonth = { period: string; advance: number; days: number; basis: 'document' | 'owner' | 'schedule' | 'reconciled' };
// Historical reconciliation of the complete July–October 2026 ledger, reviewed
// with the owner on Oct 18. These are bounded allocations, not a date heuristic.
// Bela's Sep 2 issuance deliberately remains unallocated across older debt.
const reconciledPayments = [
  { employee: 'Тохов Астемир', key: 'f2401c90-a79a-11f1-8f0e-002590803daf:1',
    employeeRef: '0fae75a8-b8d2-11ed-a2b7-0025901e48ee', documentNumber: '00OF-001619',
    documentDate: '2026-09-03', amount: 30000, period: '2026-08' },
  { employee: 'Ахобекова Залина', key: 'dedd8243-af70-11f1-8f0f-002590803daf:1',
    employeeRef: '55161477-dada-11ea-971d-0025901e48ee', documentNumber: '00OF-001681',
    documentDate: '2026-09-13', amount: 3000, period: '2026-08' },
  { employee: 'Улубиев Марат', key: '17ec3a31-c622-11f1-8f13-002590803daf:1',
    employeeRef: '830a355a-aeab-11df-8fe6-00241d5a8bc3', documentNumber: '00OF-001879',
    documentDate: '2026-10-07', amount: 10000, period: '2026-09' },
];
// The owner's existing salary calendar: 1st and 16th pay the previous month.
// Restrict it to the established employees; new people require their own rule.
const scheduledEmployees = new Set([
  'Тохов Астемир', 'Ахобекова Залина', 'Хурзокова Лиана', 'Кумахова Диана',
  'Чеченова Милана', 'Костеренко Магомед', 'Абшаева Зухра', 'Кештова Бэла',
  'Атабиева Марианна', 'Жамбекова Саида', 'Даудова Татьяна', 'Улубиев Марат',
  'СтажерРозница · поклейка (09.2026)', 'Стажёр розницы · поклейка',
]);
export function payrollPaymentMonth(employee: string, payment: Payment): PaymentMonth | null {
  if (!payment.identityConfirmed) return null;
  const explicit = confirmedPayrollPaymentBreakdown(employee, payment);
  if (explicit) return {...explicit, basis: payment.advancePeriod ? 'document' : 'owner'};
  const reconciled = reconciledPayments.find(r => r.employee === employee
    && r.key === payment.key && r.employeeRef === payment.employeeRef
    && r.documentNumber === payment.documentNumber && r.documentDate === payment.documentDate
    && r.amount === payment.amount && !payment.comment.trim());
  if (reconciled) return { period: reconciled.period, advance: 0, days: 0, basis: 'reconciled' };
  const procurementAdvance = employee === 'Кумыков Мухаммед' ? confirmedProcurementAdvance(payment) : null;
  if (procurementAdvance) return {...procurementAdvance, basis:'owner'};
  // Extra wording (especially an unparsed advance) must never be overridden by date.
  if (!scheduledEmployees.has(employee) || payment.comment.trim()
      || !/^20\d{2}-\d{2}-(01|16)$/.test(payment.documentDate)) return null;
  const [year, month] = payment.documentDate.split('-').map(Number);
  return {period:new Date(Date.UTC(year,month-2,1)).toISOString().slice(0,7),advance:0,days:0,basis:'schedule'};
}
