import 'server-only';
import { prisma } from './prisma';
import { queueAdminInboxTelegramDelivery } from './admin-inbox';
import { fetchDeliveryCash, unavailableDeliveryCash } from './procurement-delivery-source';
import { DELIVERY_PERSON, DELIVERY_SOURCE, DELIVERY_OPEN, DELIVERY_COVERED, DELIVERY_RESERVE, DELIVERY_REQUEST_SOURCE, DELIVERY_MANUAL_REQUEST, deliveryManualRequestKey, legacyDeliveryBuyerRequest, deliveryAction, deliveryFresh } from './procurement-delivery-policy';
import type { DeliveryCashSnapshot } from '../components/ProcurementDeliveryCash';
import { deliveryDetailsKey, parseDeliveryRequest, readDeliveryDetails, type DeliveryRequestDetails, type DeliveryRequestInput } from './procurement-delivery-request';

const sourceWhere = { sourceType: DELIVERY_SOURCE, sourceId: DELIVERY_PERSON.ref };
const orderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
export type DeliveryView = { snapshot: DeliveryCashSnapshot; requested: boolean; requestedByBuyer?: boolean; requestDetails?: DeliveryRequestDetails | null; requestStateAvailable: boolean };

export async function deliveryMappedUser() {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: 'EMPLOYEE', portalArea: 'PROCUREMENT', oneCManagerName: DELIVERY_PERSON.name },
    select: { id: true, name: true }, take: 2,
  });
  if (users.length !== 1) throw Error('DELIVERY_MAPPING_AMBIGUOUS');
  return users[0];
}

export async function loadDeliveryView(): Promise<DeliveryView> {
  const [cash, event] = await Promise.allSettled([
    fetchDeliveryCash(),
    prisma.adminInboxEvent.findFirst({ where: sourceWhere, orderBy }),
  ]);
  const active = event.status === 'fulfilled' && event.value?.type === DELIVERY_OPEN ? event.value : null;
  let requestedByBuyer = false;
  let requestDetails: DeliveryRequestDetails | null = null;
  let requestStateAvailable = event.status === 'fulfilled';
  if (active) {
    try {
      requestedByBuyer = legacyDeliveryBuyerRequest(active) || Boolean(await prisma.adminInboxEvent.findUnique({
        where: { eventKey: deliveryManualRequestKey(active.id) }, select: { id: true },
      }));
      const details = await prisma.adminInboxEvent.findUnique({ where: { eventKey: deliveryDetailsKey(active.id) } });
      if (details) {
        requestDetails = readDeliveryDetails(details.body);
        if (!requestDetails) throw Error('DELIVERY_REQUEST_CORRUPT');
        requestedByBuyer = true;
      }
    } catch { requestStateAvailable = false; }
  }
  return {
    snapshot: cash.status === 'fulfilled' ? cash.value : unavailableDeliveryCash(),
    requested: Boolean(active), requestedByBuyer, requestDetails, requestStateAvailable,
  };
}

/** Only a portal reminder. This never creates, approves, or pays a 1C document. */
export async function syncDeliveryReminder(manual = false, input?: DeliveryRequestInput): Promise<DeliveryView> {
  if (input !== undefined && (!manual || !parseDeliveryRequest(input))) throw Error('DELIVERY_REQUEST_INVALID');
  await deliveryMappedUser();
  const snapshot = await fetchDeliveryCash();
  if (!deliveryFresh(snapshot)) throw Error('DELIVERY_SOURCE_STALE');
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106248)`;
    const latest = await tx.adminInboxEvent.findFirst({ where: sourceWhere, orderBy });
    const active = latest?.type === DELIVERY_OPEN;
    let activeReminder = active ? latest : null;
    // A slower source read cannot undo a newer request/recovery transaction.
    const superseded = latest && latest.createdAt.getTime() > Date.parse(snapshot.checkedAt) + 1000;
    const action = superseded ? 'keep' : deliveryAction({ snapshot, active, manual });
    const now = new Date();
    if (action === 'open') {
      const amount = Math.max(0, Math.round((DELIVERY_RESERVE.target - snapshot.balance!) * 100) / 100);
      const event = await tx.adminInboxEvent.create({ data: {
        eventKey: `delivery:${DELIVERY_PERSON.ref}:${latest?.id ?? 'initial'}`,
        ...sourceWhere, type: DELIVERY_OPEN, title: 'Пополнение подотчёта · Астемир',
        body: `Остаток по 1С: ${snapshot.balance!.toLocaleString('ru-RU')} ₽. До запаса ${DELIVERY_RESERVE.target.toLocaleString('ru-RU')} ₽: ${amount.toLocaleString('ru-RU')} ₽. ${manual ? 'Астемир запросил пополнение.' : 'Низкий остаток.'} Заявку оформите в 1С.`,
        href: '/admin/expense-requests#delivery', occurredAt: now,
      } });
      activeReminder = event;
      const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
      if (!admins.length) throw Error('DELIVERY_RECIPIENT_UNAVAILABLE');
      await tx.adminInboxReceipt.createMany({ data: admins.map(user => ({ eventId: event.id, userId: user.id })), skipDuplicates: true });
      await queueAdminInboxTelegramDelivery({ db: tx, eventId: event.id });
    }
    if (action === 'cover' && latest) {
      activeReminder = null;
      await tx.adminInboxEvent.create({ data: {
        ...sourceWhere, eventKey: `delivery:covered:${latest.id}`, type: DELIVERY_COVERED,
        title: 'Запас подотчёта восстановлен', body: 'Остаток по 1С достиг рекомендуемого запаса. Это не подтверждение исполнения конкретной заявки.',
        href: '/admin/expense-requests#delivery', occurredAt: now,
      } });
      await tx.adminInboxReceipt.updateMany({ where: { eventId: latest.id, readAt: null }, data: { readAt: now } });
      await tx.adminInboxDelivery.updateMany({ where: { eventId: latest.id, status: 'pending' }, data: { status: 'cancelled', lastErrorCode: 'DELIVERY_RESERVE_RESTORED' } });
    }
    if (manual && activeReminder && !superseded) {
      await tx.adminInboxEvent.upsert({
        where: { eventKey: deliveryManualRequestKey(activeReminder.id) }, update: {},
        create: {
          eventKey: deliveryManualRequestKey(activeReminder.id), sourceType: DELIVERY_REQUEST_SOURCE,
          sourceId: DELIVERY_PERSON.ref, type: DELIVERY_MANUAL_REQUEST,
          title: 'Запрос пополнения подотчёта', body: 'Астемир запросил пополнение.',
          href: '/admin/expense-requests#delivery', occurredAt: now,
        },
      });
      if (input) await tx.adminInboxEvent.upsert({
        where: { eventKey: deliveryDetailsKey(activeReminder.id) }, update: {},
        create: {
          eventKey: deliveryDetailsKey(activeReminder.id), sourceType: DELIVERY_REQUEST_SOURCE,
          sourceId: DELIVERY_PERSON.ref, type: 'procurement.delivery_request_details',
          title: 'Сумма запроса пополнения',
          body: JSON.stringify({ version: 1, ...parseDeliveryRequest(input), balance: snapshot.balance, checkedAt: snapshot.checkedAt, requestedAt: now.toISOString() }),
          href: '/admin/expense-requests#delivery', occurredAt: now,
        },
      });
    }
    const requestedByBuyer = activeReminder ? legacyDeliveryBuyerRequest(activeReminder) || Boolean(await tx.adminInboxEvent.findUnique({
      where: { eventKey: deliveryManualRequestKey(activeReminder.id) }, select: { id: true },
    })) : false;
    const details = activeReminder ? await tx.adminInboxEvent.findUnique({ where: { eventKey: deliveryDetailsKey(activeReminder.id) } }) : null;
    const requestDetails = details ? readDeliveryDetails(details.body) : null;
    if (details && !requestDetails) throw Error('DELIVERY_REQUEST_CORRUPT');
    return { snapshot, requested: Boolean(activeReminder), requestedByBuyer, requestDetails, requestStateAvailable: true };
  });
}
