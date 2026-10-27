import 'server-only';
import { prisma } from './prisma';
import type { PrismaClient } from '@prisma/client';
import { calculateLastVerifiedPersonalPayroll, calculatePersonalCurrentPayroll } from './payroll-current-read';
import type { PayrollSalesClassificationRule } from './payroll-sales-classification';
import { readPersonalPayrollAdvances } from './payroll-settlement-source';
import type { PayrollAdvanceRead } from './payroll-one-c-advances';
import { createHash } from 'node:crypto';
import type { PersonalPayrollSourceMemo } from './payroll-current-read';
import { employeePayrollMonthAt, employeePayrollMonths } from './employee-payroll-view';

const memoHost = globalThis as typeof globalThis & { __moboPersonalSalesMemoV1?: Map<string, { fingerprint: string; value: PersonalPayrollSourceMemo }> };
const sourceMemos = memoHost.__moboPersonalSalesMemoV1 ??= new Map();

// Calculation uses a consistent stored snapshot. The approved advance refresh
// reads 1C without writing snapshots, drafts, runs or salary documents.
export async function readStoredPersonalCurrentPayroll(periodKey: string, userId: number, db: PrismaClient = prisma,
  readAdvances: (period: string) => Promise<PayrollAdvanceRead | null> = readPersonalPayrollAdvances) {
  const evidence = await db.$transaction(async tx => {
    const period = await tx.payrollPeriod.findUnique({ where: { periodKey }, select: { status: true } });
    if (period?.status === 'CLOSED') return null;
    if (await tx.payrollRun.count({ where: { period: { periodKey }, status: 'FINAL' } })) return null;
    const [users, slices, attendance, draft, finbox, classificationRules, supplierRules] = await Promise.all([
      tx.user.findMany({ select: { id: true, name: true, role: true, department: true, isActive: true, payrollName: true,
        payrollSalaryType: true, payrollReportGroup: true, payrollFixedSalary: true, payrollRuleFrom: true, payrollRuleThrough: true } }),
      tx.payrollOneCControlSnapshot.findMany({ where: { periodKey, kind: 'DAILY' }, orderBy: { dateFrom: 'asc' }, select: { dateFrom: true, dateTo: true, payload: true } }),
      tx.payrollAttendanceSnapshot.findUnique({ where: { periodKey }, select: { payload: true, sourceCheckedAt: true, updatedAt: true } }),
      tx.payrollDraftRevision.findFirst({ where: { periodKey }, orderBy: { revision: 'desc' }, select: { payload: true, revision: true } }),
      tx.payrollFinboxRevision.findFirst({ where: { periodKey }, orderBy: { revision: 'desc' }, select: { amountCents: true } }),
      tx.payrollClassificationRule.findMany({ orderBy: [{ priority: 'asc' }, { id: 'asc' }] }),
      tx.payrollPurchaseSupplierRule.findMany({ orderBy: [{ isActive: 'desc' }, { supplierName: 'asc' }] }),
    ]);
    return { users, slices, attendance, draft,
      finboxAmount: finbox ? (finbox.amountCents / 100).toFixed(2) : null,
      classificationRules: classificationRules as unknown as PayrollSalesClassificationRule[], supplierRules };
  }, { isolationLevel: 'RepeatableRead' });
  if (!evidence) return null;
  const visible = employeePayrollMonths(employeePayrollMonthAt());
  for (const key of sourceMemos.keys()) if (!visible.includes(key)) sourceMemos.delete(key);
  const fingerprint = createHash('sha256').update(JSON.stringify([evidence.slices, evidence.classificationRules])).digest('hex');
  let memo = sourceMemos.get(periodKey);
  if (!memo || memo.fingerprint !== fingerprint) {
    memo = { fingerprint, value: new Map() };
    if (visible.includes(periodKey)) sourceMemos.set(periodKey, memo);
  }
  const calculation = calculateLastVerifiedPersonalPayroll(periodKey, userId, evidence, new Date(), memo.value);
  // No external read for unknown/unbound employees or blocked calculations.
  if (!calculation) return null;
  let advances: PayrollAdvanceRead | null;
  try { advances = await readAdvances(periodKey); } catch { advances = null; }
  const slices = evidence.slices.filter(row => row.dateTo <= calculation.verifiedThrough);
  const refreshed = calculatePersonalCurrentPayroll(periodKey, userId, { ...evidence, slices, advances }, new Date(), memo.value);
  return refreshed ? { ...refreshed, ...(calculation.sourceFallback ? { sourceFallback: true } : {}) } : null;
}
