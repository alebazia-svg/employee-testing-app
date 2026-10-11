import 'server-only';
import { prisma } from './prisma';

export function readAdminPlans() {
  return prisma.supplierPaymentPlan.findMany({
    include: { events: { orderBy: { createdAt: 'desc' }, take: 20 }, manager: { select: { name: true, oneCManagerName: true } } },
    orderBy: [{ plannedDate: 'asc' }, { createdAt: 'desc' }],
  });
}
export type AdminPlans = Awaited<ReturnType<typeof readAdminPlans>>;

export function sameAdminPlanVersions(before: {id:string;updatedAt:Date}[], after: {id:string;updatedAt:Date}[]) {
  const versions = new Map(after.map(p => [p.id, p.updatedAt.getTime()]));
  return before.length === after.length && before.every(p => versions.get(p.id) === p.updatedAt.getTime());
}
