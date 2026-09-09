import { requireAdminApi } from '@/lib/admin-api-auth';
import { prisma } from '@/lib/prisma';
import { notifyProcurementManagerAboutDecision } from '@/lib/procurement-payment-notifications';

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const { id } = await props.params;
  const payload = await req.json();
  const action = String(payload.action || '').toUpperCase();
  const reason = typeof payload.reason === 'string' ? payload.reason.trim().slice(0, 300) : '';
  if (!['APPROVE', 'RETURN', 'CANCEL'].includes(action)) return Response.json({ error: 'Недопустимое действие' }, { status: 400 });
  if (action === 'RETURN' && reason.length < 3) return Response.json({ error: 'Коротко укажите, что нужно исправить.' }, { status: 400 });
  const status = action === 'APPROVE' ? 'APPROVED' : action === 'RETURN' ? 'NEEDS_CHANGES' : 'CANCELLED';
  const plan = await prisma.$transaction(async (tx) => {
    const changed = await tx.supplierPaymentPlan.updateMany({ where: { id, status: 'SUBMITTED' }, data: { status, approvedAt: action === 'APPROVE' ? new Date() : null, approvedById: action === 'APPROVE' ? access.user.id : null } });
    if (changed.count !== 1) throw new Error('PLAN_STATUS_CHANGED');
    const updated = await tx.supplierPaymentPlan.findUniqueOrThrow({ where: { id } });
    const event = await tx.supplierPaymentPlanEvent.create({ data: { planId: id, actorUserId: access.user.id, action: status, snapshot: { ...JSON.parse(JSON.stringify(updated)), correctionReason: reason } } });
    await notifyProcurementManagerAboutDecision({ db: tx, plan: updated, decision: status as 'APPROVED' | 'CANCELLED' | 'NEEDS_CHANGES', reason, eventKey: event.id });
    return updated;
  }).catch((error) => {
    if (error instanceof Error && error.message === 'PLAN_STATUS_CHANGED') return null;
    throw error;
  });
  if (!plan) return Response.json({ error: 'Заявка уже рассмотрена или изменена.' }, { status: 409 });
  return Response.json({ ...JSON.parse(JSON.stringify(plan)), correctionReason: reason });
}
