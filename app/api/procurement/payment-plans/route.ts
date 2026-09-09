import { Prisma } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildPaymentPlanCode, validatePaymentPlan } from '@/lib/procurement-payment-control';
import { fetchSupplierOrderFinance, ordersForManager, ordersRequiringPayment } from '@/lib/procurement-payment-source';

function jsonPlan(plan: unknown) { return JSON.parse(JSON.stringify(plan, (_, value) => typeof value === 'bigint' ? String(value) : value)); }

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Необходим вход' }, { status: 401 });
  if (user.role !== 'EMPLOYEE' || user.portalArea !== 'PROCUREMENT') return Response.json({ error: 'Нет доступа' }, { status: 403 });
  const plans = await prisma.supplierPaymentPlan.findMany({ where: { managerUserId: user.id }, orderBy: [{ plannedDate: 'asc' }, { createdAt: 'desc' }] });
  return Response.json(jsonPlan(plans));
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Необходим вход' }, { status: 401 });
  if (user.role !== 'EMPLOYEE' || user.portalArea !== 'PROCUREMENT') return Response.json({ error: 'Нет доступа' }, { status: 403 });
  const checked = validatePaymentPlan(await req.json());
  if (!checked.ok || !checked.data.plannedAmount) return Response.json({ error: checked.errors.join(' ') }, { status: 400 });
  const plannedAmount = checked.data.plannedAmount;
  const managerName = user.oneCManagerName?.trim() || user.name;
  const source = await fetchSupplierOrderFinance();
  const allowed = new Map(ordersRequiringPayment(ordersForManager(source.rows, managerName)).map((order) => [order.ref, order]));
  if (!checked.data.orderRefs.every((ref) => allowed.has(ref))) return Response.json({ error: 'Один из заказов не относится к вашему менеджеру в 1С.' }, { status: 400 });
  const partners = new Set(checked.data.orderRefs.map((ref) => allowed.get(ref)?.supplierPartner));
  if (partners.size !== 1 || !partners.has(checked.data.supplierPartner)) return Response.json({ error: 'Заказы должны относиться к выбранному поставщику.' }, { status: 400 });
  const plan = await prisma.$transaction(async (tx) => {
    const created = await tx.supplierPaymentPlan.create({ data: {
      planCode: buildPaymentPlanCode(), managerUserId: user.id, supplierPartner: checked.data.supplierPartner,
      supplierCounterparty: checked.data.supplierCounterparty, orderRefs: checked.data.orderRefs, orderNumbers: checked.data.orderNumbers,
      plannedDate: new Date(`${checked.data.plannedDate}T00:00:00.000Z`), plannedAmount: new Prisma.Decimal(plannedAmount),
      condition: checked.data.condition, paymentMethod: checked.data.paymentMethod, currency: checked.data.currency,
      foreignAmount: checked.data.foreignAmount == null ? null : new Prisma.Decimal(checked.data.foreignAmount),
      exchangeRate: checked.data.exchangeRate == null ? null : new Prisma.Decimal(checked.data.exchangeRate),
      commissionAmount: checked.data.commissionAmount == null ? null : new Prisma.Decimal(checked.data.commissionAmount),
      exchangerName: checked.data.exchangerName, supplierConfirmation: checked.data.supplierConfirmation,
    } });
    await tx.supplierPaymentPlanEvent.create({ data: { planId: created.id, actorUserId: user.id, action: 'SUBMITTED', snapshot: JSON.parse(JSON.stringify(created)) } });
    return created;
  });
  return Response.json(jsonPlan(plan), { status: 201 });
}
