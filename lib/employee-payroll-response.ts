import 'server-only';
import type { PayrollViewer } from './employee-payroll-read';
import { prisma } from '@/lib/prisma';
import { readEmployeePayroll } from '@/lib/employee-payroll-read';
import { readStoredPersonalCurrentPayroll } from '@/lib/payroll-current-store';
import { bindPersonalPayrollHistory, projectPersonalSettlement } from '@/lib/employee-payroll-history';
import { readPayrollSettlementSource } from '@/lib/payroll-settlement-source';
import { getPrivatePayrollBinding } from '@/lib/payroll-current-read';
import { payrollFeatureState } from '@/lib/payroll-features';


const directorySelect = { id: true, name: true, role: true, department: true, isActive: true, payrollName: true,
  payrollSalaryType: true, payrollReportGroup: true, payrollFixedSalary: true, payrollRuleFrom: true, payrollRuleThrough: true } as const;

export async function employeePayrollResponse(viewer: PayrollViewer | null, query: URLSearchParams, storedOnly = false) {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
  // Disabled until the server draft migration and ADMIN reconciliation pass.
  if (!payrollFeatureState().employeeEnabled) {
    return Response.json({ error: 'Раздел недоступен.' }, { status: 404, headers });
  }
  let historicalName: string | null = null;
  const result = await readEmployeePayroll(viewer, query, {
    currentPeriod: () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit' }).format(new Date()),
    findCurrent: storedOnly ? (period, userId) => readStoredPersonalCurrentPayroll(period, userId, prisma, async () => null) : readStoredPersonalCurrentPayroll,
    findSettlement: async (period, userId) => {
      // First paint must not wait for 1C. No invented historical paid/accrued sum.
      if (storedOnly) return null;
      const users = await prisma.user.findMany({ select: directorySelect });
      const name = getPrivatePayrollBinding(users, userId);
      if (!name || name !== historicalName) return null;
      const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());
      const source = await readPayrollSettlementSource(period, today, false, false);
      return projectPersonalSettlement(period, name, source.cash, source.ledger);
    },
    findFinal: async (periodKey, userId) => {
      const runs = await prisma.payrollRun.findMany({
      where: { status: 'FINAL', period: { periodKey } },
      take: 2,
      select: {
        status: true,
        period: { select: { periodKey: true } },
        employeeResults: {
          select: { userId: true, employeeName: true, grossPay: true, advance: true, dayPay: true },
        },
      },
      });
      if (runs.length !== 1) return null;
      const users = await prisma.user.findMany({ select: directorySelect });
      const bound = bindPersonalPayrollHistory(runs[0], users, userId);
      historicalName = bound?.name ?? null;
      return bound?.run ?? null;
    },
  });
  return Response.json(result.body, { status: result.status, headers });
}
