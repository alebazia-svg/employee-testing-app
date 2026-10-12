import 'server-only';
import { prisma } from './prisma';
import { attentionDay } from './admin-inbox-attention-policy';
import { shiftDeadlines } from './admin-inbox-deadlines';

/** Exact cashbox ownership only; no surname matching or writes to schedules/checklists. */
export async function loadDecisionCashiers(refs: string[], now: Date) {
  const mappings = refs.length ? await prisma.userOneCCashboxMapping.findMany({
    where: { oneCCashboxRef: { in: [...new Set(refs)] }, isActive: true, user: { isActive: true, role: 'EMPLOYEE', portalArea: 'WORKDAY', department: { in: ['retail','wholesale'] } } },
    select: { oneCCashboxRef: true, userId: true },
  }) : [];
  const shifts = mappings.length ? await prisma.workDayEntry.findMany({
    where: { userId: { in: mappings.map(m => m.userId) }, date: attentionDay(now), startedAt: { lte: now } },
    select: { id: true, userId: true, date: true, startedAt: true, endedAt: true, shiftEndMinutes: true,
      deviations: { where: { kind: 'early_finish' }, select: { requestedEndMinutes: true } },
      shiftControlRun: { select: { tasks: { where: { category: 'cash' }, select: { id: true, plannedTimeMinutes: true, status: true, completedAt: true } } } } },
  }) : [];
  return new Map([...new Set(mappings.map(m => m.oneCCashboxRef))].flatMap(ref => {
    const owners = mappings.filter(m => m.oneCCashboxRef === ref);
    if (owners.length !== 1) return [];
    const userId = owners[0].userId, shift = shifts.find(s => s.userId === userId);
    return [[ref, { userId, shift, deadlines: (requestedAt: Date) => shiftDeadlines(shift, requestedAt, now) }] as const];
  }));
}
export function expenseCashboxRef(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('cashbox' in value)) return null;
  const cashbox = value.cashbox;
  return cashbox && typeof cashbox === 'object' && 'ref' in cashbox && typeof cashbox.ref === 'string' && cashbox.ref.trim() ? cashbox.ref : null;
}
