import 'server-only';
import { prisma } from './prisma';
import { getMoscowDateKey } from './workday';
import { readDeliveryLink, DELIVERY_LINK_SOURCE } from './procurement-delivery-native';
import { CASH_ISSUE_KIND, cashIssueRef } from './procurement-cash-issue-policy';
import { routeEmployeeExpenses, ADMIN_EXPENSE_ISSUE_SOURCE } from './employee-expense-routing';

/** One persisted-source read for the entire queue. No 1C requests or financial writes. */
export async function loadExpenseRouting(now = new Date()) {
  const [users, shifts, run, cases, links, specialized, mappings, plans, assignments] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true, role: 'EMPLOYEE', portalArea: 'WORKDAY', department: { in: ['retail', 'wholesale'] } },
      select: { id: true, name: true, department: true, oneCCashboxMapping: true } }),
    prisma.workDayEntry.findMany({ where: { date: getMoscowDateKey(now) }, select: { userId: true, status: true, startedAt: true, endedAt: true } }),
    prisma.expenseRequestSyncRun.findFirst({ where: { status: { not: 'running' } }, orderBy: { startedAt: 'desc' } }),
    prisma.expenseRequestAdminCase.findMany({ where: { deletionMark: false, currentStatusKey: 'payable' } }),
    prisma.adminInboxEvent.findMany({ where: { sourceType: DELIVERY_LINK_SOURCE, eventKey: { startsWith: 'delivery:native:' } }, select: { body: true } }),
    prisma.workdayNotification.findMany({ where: { kind: CASH_ISSUE_KIND }, select: { fingerprint: true }, distinct: ['fingerprint'] }),
    prisma.userOneCCashboxMapping.findMany({ where: { isActive: true, user: { isActive: true } }, select: { oneCCashboxRef: true } }),
    prisma.workScheduleEntry.findMany({ where: { date: getMoscowDateKey(now) }, select: { userId: true, status: true } }),
    prisma.adminInboxEvent.findMany({ where: { sourceType: ADMIN_EXPENSE_ISSUE_SOURCE }, select: { eventKey: true, body: true, occurredAt: true } }),
  ]);
  const evaluations = cases.length ? await prisma.expenseRequestAdminEvaluation.findMany({ where: { OR: cases.map(row => ({ caseId: row.id, sourceHash: row.latestSourceHash })) }, select: { caseId: true, normalizedSource: true } }) : [];
  const sources = new Map(evaluations.map(row => [row.caseId, row.normalizedSource]));
  const active = new Set(shifts.filter(s => s.status === 'active' && !s.endedAt && s.startedAt <= now).map(row => row.userId));
  const employees = users.map(user => ({ id: user.id, name: user.name,
    applicantRef: user.oneCCashboxMapping?.isActive ? user.oneCCashboxMapping.oneCCashierRef ?? '' : '', department: user.department,
    cashboxRef: user.oneCCashboxMapping?.isActive ? user.oneCCashboxMapping.oneCCashboxRef : '',
    cashboxName: user.oneCCashboxMapping?.isActive ? user.oneCCashboxMapping.oneCCashboxName : '', onShift: active.has(user.id), shiftState: active.has(user.id) ? 'active' as const : shifts.some(s => s.userId === user.id && s.endedAt && s.endedAt <= now) ? 'ended' as const : plans.some(p => p.userId === user.id && p.status === 'off') ? 'day_off' as const : 'not_started' as const }));
  const excludedRefs = links.flatMap(link => { try { return [readDeliveryLink(link.body).ref.toLowerCase()]; } catch { return []; } });
  for (const row of specialized) { const ref = cashIssueRef(row.fingerprint); if (ref) excludedRefs.push(ref.toLowerCase()); }
  const owners = new Map<string, number>();
  for (const mapping of mappings) { const ref = mapping.oneCCashboxRef.toLowerCase(); owners.set(ref, (owners.get(ref) ?? 0) + 1); }
  const ambiguousCashboxRefs = [...owners].filter(([, count]) => count > 1).map(([ref]) => ref);
  const snapshot = routeEmployeeExpenses({ now, complete: run?.status === 'completed' && run.sourceComplete, checkedAt: run?.completedAt?.toISOString() ?? null,
    employees, excludedRefs, ambiguousCashboxRefs, adminAssignments: assignments.map(a => ({ key: a.eventKey, reason: a.body.split('\n')[0], at: a.occurredAt.toISOString() })), rows: cases.map(row => ({ source: sources.get(row.id) ?? { ref: row.oneCRequestRef, status: { key: 'payable' } }, seenAt: row.lastSeenAt.toISOString(), cycle: row.notApprovedCycle })) });
  return { ...snapshot, employees, assignments };
}
export async function loadEmployeeExpenseRouting(userId: number, now = new Date()) {
  const snapshot = await loadExpenseRouting(now);
  return { ...snapshot, items: snapshot.items.filter(item => item.userId === userId) };
}
