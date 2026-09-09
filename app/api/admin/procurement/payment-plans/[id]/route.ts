import { requireAdminApi } from '@/lib/admin-api-auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const { id } = await props.params;
  const action = String((await req.json()).action || '').toUpperCase();
  if (!['APPROVE', 'CANCEL'].includes(action)) return Response.json({ error: 'Недопустимое действие' }, { status: 400 });
  const status = action === 'APPROVE' ? 'APPROVED' : 'CANCELLED';
  const plan = await prisma.$transaction(async (tx) => {
    const updated = await tx.supplierPaymentPlan.update({ where: { id }, data: { status, approvedAt: action === 'APPROVE' ? new Date() : null, approvedById: action === 'APPROVE' ? access.user.id : null } });
    await tx.supplierPaymentPlanEvent.create({ data: { planId: id, actorUserId: access.user.id, action: status, snapshot: JSON.parse(JSON.stringify(updated)) } });
    return updated;
  });
  return Response.json(JSON.parse(JSON.stringify(plan)));
}
