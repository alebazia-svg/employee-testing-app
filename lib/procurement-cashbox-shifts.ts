import 'server-only';
import { prisma } from './prisma';
import { getMoscowDateKey } from './workday';
import type { CashboxShift } from './procurement-cashbox-shift-policy';

export async function cashboxShifts(refs: string[], now = new Date()): Promise<Map<string, CashboxShift>> {
  const day = getMoscowDateKey(now);
  const mappings = await prisma.userOneCCashboxMapping.findMany({
    where: { oneCCashboxRef: { in: refs }, isActive: true, user: { isActive: true, role: 'EMPLOYEE', portalArea: 'WORKDAY', department: { in: ['retail', 'wholesale'] } } },
    select: { oneCCashboxRef: true, userId: true, user: { select: { name: true } } },
  });
  const days = await prisma.workDayEntry.findMany({
    where: { userId: { in: mappings.map(m => m.userId) }, date: day },
    select: { userId: true, id: true, status: true, startedAt: true, endedAt: true },
  });
  return new Map(refs.map(ref => {
    const owners = mappings.filter(m => m.oneCCashboxRef === ref);
    const owner = owners.length === 1 ? owners[0] : null;
    const shift = owner ? days.find(d => d.userId === owner.userId) : null;
    const state: CashboxShift['state'] = !owner ? 'unknown' : !shift ? 'not_started'
      : shift.endedAt || shift.status === 'completed' ? 'completed'
      : shift.status === 'active' && shift.startedAt <= now ? 'active'
      : shift.status === 'active' ? 'not_started' : 'unknown';
    return [ref, { state, employee: owner?.user.name ?? '', checkedAt: now.toISOString(),
      version: JSON.stringify([day, owners.map(o => o.userId).sort(), shift?.id, shift?.status, shift?.startedAt, shift?.endedAt, state]) }];
  }));
}
