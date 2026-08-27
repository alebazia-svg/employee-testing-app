import { prisma } from '@/lib/prisma';
import { getMoscowDateKey } from '@/lib/workday';

async function main() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const today = getMoscowDateKey(now);
  const employeeWhere = { isActive: true, role: { not: 'ADMIN' } } as const;

  const [
    activeEmployees,
    employeesWithoutPush,
    employeesWithoutCashboxMapping,
    staleActiveWorkdays,
    staleCashOperations,
    unconsumedApprovedCloseRequests,
    oldOpenEmployeeIssues,
    oldOpenTerminalReviews,
    latestTerminalRun,
    latestCreditRun,
  ] = await Promise.all([
    prisma.user.count({ where: employeeWhere }),
    prisma.user.count({ where: { ...employeeWhere, pushSubscriptions: { none: { disabledAt: null } } } }),
    prisma.user.count({ where: { ...employeeWhere, OR: [
      { oneCCashboxMapping: null }, { oneCCashboxMapping: { is: { isActive: false } } },
    ] } }),
    prisma.workDayEntry.count({ where: { status: 'active', date: { lt: today } } }),
    prisma.cashOperation.count({ where: {
      status: { in: ['pending_1c', 'creating_1c', 'created_1c', 'retry_pending'] },
      createdAt: { lt: oneDayAgo },
    } }),
    prisma.workdayCloseExceptionRequest.count({ where: {
      status: 'approved', consumedAt: null, workDayEntry: { endedAt: { not: null } },
    } }),
    prisma.workdayControlIssue.count({ where: { status: 'open', detectedAt: { lt: sevenDaysAgo } } }),
    prisma.terminalFiscalEmployeeReview.count({ where: { status: 'open', detectedAt: { lt: sevenDaysAgo } } }),
    prisma.terminalFiscalMatchRun.findFirst({ orderBy: { createdAt: 'desc' }, select: {
      status: true, completedAt: true, tbankComplete: true, oneCComplete: true, ofdComplete: true,
    } }),
    prisma.creditRealizationControlRun.findFirst({ orderBy: { createdAt: 'desc' }, select: {
      status: true, completedAt: true, oneCComplete: true, ofdComplete: true,
    } }),
  ]);

  console.log(JSON.stringify({
    checkedAt: now.toISOString(), today,
    readiness: { activeEmployees, employeesWithoutPush, employeesWithoutCashboxMapping },
    staleLifecycle: { staleActiveWorkdays, staleCashOperations, unconsumedApprovedCloseRequests, oldOpenEmployeeIssues, oldOpenTerminalReviews },
    latestControls: { terminal: latestTerminalRun, credit: latestCreditRun },
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
