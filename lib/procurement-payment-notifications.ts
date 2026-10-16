import 'server-only';

import type { Prisma } from '@prisma/client';
import {SUPPLIER_ADVANCE, SUPPLIER_ADVANCE_LABEL} from './procurement-supplier-advance';

type NotificationDb = Pick<
  Prisma.TransactionClient,
  'user' | 'adminInboxEvent' | 'adminInboxReceipt' | 'workdayNotification'
>;

type PaymentPlanSummary = {
  paymentPurpose?: string;
  id: string;
  planCode: string;
  supplierPartner: string;
  plannedDate: Date;
  plannedAmount: Prisma.Decimal | number;
  condition: string;
  paymentMethod: string;
  managerUserId: number;
};

const rub = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

const shortDate = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'long',
  timeZone: 'UTC',
});

function methodLabel(method: string) {
  if (method === 'CNY') return 'наличные на перевод в юанях';
  if (method === 'USDT') return 'оплата в USDT';
  if (method === 'ACCOUNTABLE_QR') return 'оплата по QR';
  if (method === 'BANK') return 'перевод на карту';
  return 'наличные';
}

function meaningfulComment(value: string) {
  const comment = value.replace(/\s+/g, ' ').trim();
  return comment && comment !== 'Оплата по выбранным заказам' ? comment : '';
}

export async function notifyAdminsAboutProcurementPlans(input: {
  db: NotificationDb;
  eventKey: string;
  action: 'SUBMITTED' | 'UPDATED';
  revisionProposal?: boolean;
  managerName: string;
  plans: PaymentPlanSummary[];
  now?: Date;
}) {
  if (!input.plans.length) return;
  const now = input.now ?? new Date();
  const total = input.plans.reduce((sum, plan) => sum + Number(plan.plannedAmount), 0);
  const first = input.plans[0];
  const single = input.plans.length === 1;
  const comment = single ? meaningfulComment(first.condition) : '';
  const title = input.revisionProposal ? 'Изменения оплаты на согласование' : input.action === 'UPDATED' ? 'Оплата поставщику изменена' : single && first.paymentPurpose === SUPPLIER_ADVANCE ? 'Новый аванс поставщику' : 'Новая оплата поставщику';
  const body = single
    ? [
        input.managerName,
        first.supplierPartner,
        first.paymentPurpose === SUPPLIER_ADVANCE && comment !== SUPPLIER_ADVANCE_LABEL ? SUPPLIER_ADVANCE_LABEL : '',
        rub.format(Number(first.plannedAmount)),
        `к ${shortDate.format(first.plannedDate)}`,
        methodLabel(first.paymentMethod),
        comment,
      ].filter(Boolean).join(' · ')
    : `${input.managerName} · ${input.plans.length} оплат · ${rub.format(total)} · к ${shortDate.format(first.plannedDate)}`;
  const admins = await input.db.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  const event = await input.db.adminInboxEvent.upsert({
    where: { eventKey: input.eventKey },
    create: {
      eventKey: input.eventKey,
      type: input.action === 'UPDATED' ? 'procurement.payment_updated' : 'procurement.payment_submitted',
      title,
      body,
      href: '/admin/procurement',
      sourceType: 'supplier_payment_plan',
      sourceId: first.id,
      occurredAt: now,
    },
    update: {},
  });
  if (admins.length) {
    await input.db.adminInboxReceipt.createMany({
      data: admins.map((admin) => ({ eventId: event.id, userId: admin.id })),
      skipDuplicates: true,
    });
  }
}

export async function notifyProcurementManagerAboutDecision(input: {
  db: NotificationDb;
  plan: PaymentPlanSummary;
  decision: 'APPROVED' | 'CANCELLED' | 'NEEDS_CHANGES';
  revisionDecision?: boolean;
  rescheduled?: boolean;
  reason?: string;
  eventKey?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const approved = input.decision === 'APPROVED';
  const needsChanges = input.decision === 'NEEDS_CHANGES';
  if (input.rescheduled || input.revisionDecision && approved) {
    // Do not leave the old approved date in the unread inbox or pending push queue.
    await input.db.workdayNotification.updateMany({where:{userId:input.plan.managerUserId,kind:'procurement_payment_approved',fingerprint:{startsWith:`procurement-payment:${input.plan.id}:approved:`},status:{in:['pending','sent']}},data:{status:'cancelled',readAt:now,nextPushAttemptAt:null}});
  }
  await input.db.workdayNotification.upsert({
    where: { fingerprint: `procurement-payment:${input.plan.id}:${input.decision.toLowerCase()}:${input.eventKey || 'decision'}` },
    create: {
      userId: input.plan.managerUserId,
      fingerprint: `procurement-payment:${input.plan.id}:${input.decision.toLowerCase()}:${input.eventKey || 'decision'}`,
      kind: approved ? 'procurement_payment_approved' : needsChanges ? 'procurement_payment_needs_changes' : 'procurement_payment_cancelled',
      title: input.rescheduled ? 'Дата оплаты изменена' : input.revisionDecision ? approved ? 'Изменения оплаты согласованы' : 'Сохраняются прежние условия оплаты' : approved ? 'Оплата согласована' : needsChanges ? 'Исправьте оплату' : 'Оплата отменена',
      body: needsChanges
        ? `${input.plan.supplierPartner} · ${input.reason || 'уточните данные заявки'}`
        : `${input.plan.supplierPartner} · ${rub.format(Number(input.plan.plannedAmount))} · к ${shortDate.format(input.plan.plannedDate)}`,
      status: 'pending',
      scheduledAt: now,
      nextPushAttemptAt: now,
    },
    update: {},
  });
}
