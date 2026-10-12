import 'server-only';
import { prisma } from './prisma';
import { queueAdminInboxTelegramDelivery } from './admin-inbox';
import { fetchDeliveryCash, unavailableDeliveryCash } from './procurement-delivery-source';
import { DELIVERY_PERSON, DELIVERY_SOURCE, DELIVERY_OPEN, DELIVERY_COVERED, DELIVERY_RESERVE, DELIVERY_REQUEST_SOURCE, DELIVERY_MANUAL_REQUEST, deliveryManualRequestKey, legacyDeliveryBuyerRequest, deliveryAction, deliveryFresh } from './procurement-delivery-policy';
import type { DeliveryCashSnapshot } from '../components/ProcurementDeliveryCash';
import { deliveryDetailsKey, parseDeliveryRequest, readDeliveryDetails, type DeliveryRequestDetails, type DeliveryRequestInput } from './procurement-delivery-request';
import { loadDeliveryNative } from './procurement-delivery-native-source';
import { deliveryLinkKey, readDeliveryLink, type DeliveryNativeView } from './procurement-delivery-native';

const sourceWhere = { sourceType: DELIVERY_SOURCE, sourceId: DELIVERY_PERSON.ref };
const orderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
export type DeliveryView = { requestId?: string; snapshot: DeliveryCashSnapshot; requested: boolean; requestedByBuyer?: boolean; requestDetails?: DeliveryRequestDetails | null; requestStateAvailable: boolean; nativeRequest?: DeliveryNativeView; nativeRef?: string };
export type DeliveryHistoryRow = { id: string; requestedAt: string; details: DeliveryRequestDetails | null; native: DeliveryNativeView; nativeRef?: string };

/** Read existing request cycles, without deleting reminders or caching a terminal state.
 * Every linked document is rechecked so a reversed cash order is not reported as paid. */
export async function loadDeliveryHistory(cursor?: string): Promise<{ rows: DeliveryHistoryRow[]; nextCursor: string | null }> {
  const events = await prisma.adminInboxEvent.findMany({
    where: { ...sourceWhere, type: DELIVERY_OPEN }, orderBy, take: 21,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, occurredAt: true },
  });
  const page = events.slice(0, 20);
  const records = await prisma.adminInboxEvent.findMany({ where: { eventKey: { in: [...page.flatMap(e => [deliveryDetailsKey(e.id), deliveryLinkKey(e.id)]), ...(cursor ? [deliveryDetailsKey(cursor)] : [])] } }, select: { eventKey: true, body: true } });
  const details = new Map(records.filter(r => !r.eventKey.startsWith("delivery:native:")).map(r => [r.eventKey, readDeliveryDetails(r.body)]));
  const links = new Map(records.filter(r => r.eventKey.startsWith("delivery:native:")).map(r => {
    try { return [r.eventKey, readDeliveryLink(r.body).ref] as const; } catch { return [r.eventKey, undefined] as const; }
  }));
  const rows: DeliveryHistoryRow[] = [];
  // Bound concurrency; the native reader shares same-day reads across requests.
  for (let i = 0; i < page.length; i += 4) {
    rows.push(...await Promise.all(page.slice(i, i + 4).map(async (event, offset) => {
      const request = details.get(deliveryDetailsKey(event.id)) ?? null;
      const previous = page[i + offset - 1];
      const beforeNextRequest = previous ? (details.get(deliveryDetailsKey(previous.id))?.requestedAt ?? previous.occurredAt.toISOString())
        : cursor ? details.get(deliveryDetailsKey(cursor))?.requestedAt : undefined;
      return { id: event.id, nativeRef: links.get(deliveryLinkKey(event.id)), requestedAt: request?.requestedAt ?? event.occurredAt.toISOString(), details: request,
        native: cursor && i + offset === 0 && !beforeNextRequest ? { state: 'unavailable' as const }
          : request ? await loadDeliveryNative(event.id, request, beforeNextRequest) : { state: 'unlinked' as const } };
    })));
  }
  return { rows, nextCursor: events.length > 20 ? page[page.length - 1].id : null };
}

export async function activeDeliveryRequest() {
  const event = await prisma.adminInboxEvent.findFirst({ where: sourceWhere, orderBy });
  if (event?.type !== DELIVERY_OPEN) return null;
  const record = await prisma.adminInboxEvent.findUnique({ where: { eventKey: deliveryDetailsKey(event.id) } });
  const details = record ? readDeliveryDetails(record.body) : null;
  return details ? { id: event.id, details } : null;
}

export async function deliveryMappedUser() {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: 'EMPLOYEE', portalArea: 'PROCUREMENT', oneCManagerName: DELIVERY_PERSON.name },
    select: { id: true, name: true }, take: 2,
  });
  if (users.length !== 1) throw Error('DELIVERY_MAPPING_AMBIGUOUS');
  return users[0];
}

export async function loadDeliveryView(options: { freshNative?: boolean } = {}): Promise<DeliveryView> {
  const [cash, event] = await Promise.allSettled([
    fetchDeliveryCash(),
    prisma.adminInboxEvent.findFirst({ where: sourceWhere, orderBy }),
  ]);
  const active = event.status === 'fulfilled' && event.value?.type === DELIVERY_OPEN ? event.value : null;
  let requestedByBuyer = false;
  let nativeRef: string | undefined;
  let requestDetails: DeliveryRequestDetails | null = null;
  let requestStateAvailable = event.status === 'fulfilled';
  if (active) {
    try {
      requestedByBuyer = legacyDeliveryBuyerRequest(active) || Boolean(await prisma.adminInboxEvent.findUnique({
        where: { eventKey: deliveryManualRequestKey(active.id) }, select: { id: true },
      }));
      const link = await prisma.adminInboxEvent.findUnique({ where: { eventKey: deliveryLinkKey(active.id) } });
      if (link) { try { nativeRef = readDeliveryLink(link.body).ref; } catch { /* Invalid identity cannot suppress another row. */ } }
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
    requestId: active?.id, requested: Boolean(active), requestedByBuyer, requestDetails, requestStateAvailable, nativeRef,
    ...(active && requestDetails ? { nativeRequest: await loadDeliveryNative(active.id, requestDetails, undefined, options.freshNative) } : {}),
  };
}

/** Only a portal reminder. This never creates, approves, or pays a 1C document. */
export async function syncDeliveryReminder(manual = false, input?: DeliveryRequestInput): Promise<DeliveryView> {
  if (input !== undefined && (!manual || !parseDeliveryRequest(input))) throw Error('DELIVERY_REQUEST_INVALID');
  await deliveryMappedUser();
  const snapshot = await fetchDeliveryCash();
  if (!deliveryFresh(snapshot)) throw Error('DELIVERY_SOURCE_STALE');
  const before = await activeDeliveryRequest();
  const native = before ? await loadDeliveryNative(before.id, before.details) : null;
  const issued = native?.state === 'linked' && native.status?.state === 'issued';
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106248)`;
    const latest = await tx.adminInboxEvent.findFirst({ where: sourceWhere, orderBy });
    const active = latest?.type === DELIVERY_OPEN;
    let activeReminder = active ? latest : null;
    // A slower source read cannot undo a newer request/recovery transaction.
    const superseded = latest && latest.createdAt.getTime() > Date.parse(snapshot.checkedAt) + 1000;
    let action = superseded ? 'keep' : deliveryAction({ snapshot, active, manual });
    // Restored reserve is not proof that this person's specific request was paid.
    const existingDetails = active && latest ? await tx.adminInboxEvent.findUnique({ where: { eventKey: deliveryDetailsKey(latest.id) } }) : null;
    if (existingDetails && action === 'cover') action = 'keep';
    // Keep the exact document visible and re-read it (including reversals). Only
    // the buyer's explicit next request starts a new cycle after confirmed issue.
    if (!superseded && manual && issued && before?.id === latest?.id && snapshot.balance! < DELIVERY_RESERVE.target) action = 'open';
    const now = new Date();
    let openedNow = false;
    if (action === 'open') {
      const amount = Math.max(0, Math.round((DELIVERY_RESERVE.target - snapshot.balance!) * 100) / 100);
      openedNow = true;
      const event = await tx.adminInboxEvent.create({ data: {
        eventKey: `delivery:${DELIVERY_PERSON.ref}:${latest?.id ?? 'initial'}`,
        ...sourceWhere, type: DELIVERY_OPEN, title: 'Пополнение подотчёта · Астемир',
        body: manual && input ? `Астемир запросил ${input.amount.toLocaleString('ru-RU')} ₽.${input.comment ? ` ${input.comment}` : ''}` : `Остаток по 1С: ${snapshot.balance!.toLocaleString('ru-RU')} ₽. До запаса ${DELIVERY_RESERVE.target.toLocaleString('ru-RU')} ₽: ${amount.toLocaleString('ru-RU')} ₽. ${manual ? 'Астемир запросил пополнение.' : 'Низкий остаток.'} Заявку оформите в 1С.`,
        href: '/admin/expense-requests#delivery', occurredAt: now,
      } });
      activeReminder = event;
      if (issued && latest) {
        await tx.adminInboxReceipt.updateMany({ where: { eventId: latest.id, readAt: null }, data: { readAt: now } });
        await tx.adminInboxDelivery.updateMany({ where: { eventId: latest.id, status: 'pending' }, data: { status: 'cancelled', lastErrorCode: 'DELIVERY_NATIVE_ISSUED' } });
      }
      const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
      if (!admins.length) throw Error('DELIVERY_RECIPIENT_UNAVAILABLE');
      await tx.adminInboxReceipt.createMany({ data: admins.map(user => ({ eventId: event.id, userId: user.id })), skipDuplicates: true });
      await queueAdminInboxTelegramDelivery({ db: tx, eventId: event.id });
    }
    if (action === 'cover' && latest) {
      activeReminder = null;
      await tx.adminInboxEvent.create({ data: {
        ...sourceWhere, eventKey: `delivery:covered:${latest.id}`, type: DELIVERY_COVERED,
        title: issued ? 'Пополнение выдано по заявке' : 'Запас подотчёта восстановлен', body: issued ? 'Выдача подтверждена связанными расходниками и регистром 1С.' : 'Остаток по 1С достиг рекомендуемого запаса. Это не подтверждение исполнения конкретной заявки.',
        href: '/admin/expense-requests#delivery', occurredAt: now,
      } });
      await tx.adminInboxReceipt.updateMany({ where: { eventId: latest.id, readAt: null }, data: { readAt: now } });
      await tx.adminInboxDelivery.updateMany({ where: { eventId: latest.id, status: 'pending' }, data: { status: 'cancelled', lastErrorCode: 'DELIVERY_RESERVE_RESTORED' } });
    }
    if (manual && activeReminder && !superseded) {
      const existingManual = await tx.adminInboxEvent.findUnique({ where: { eventKey: deliveryManualRequestKey(activeReminder.id) } });
      const manualEvent = await tx.adminInboxEvent.upsert({
        where: { eventKey: deliveryManualRequestKey(activeReminder.id) }, update: {},
        create: {
          eventKey: deliveryManualRequestKey(activeReminder.id), sourceType: DELIVERY_REQUEST_SOURCE,
          sourceId: DELIVERY_PERSON.ref, type: DELIVERY_MANUAL_REQUEST,
          title: 'Запрос пополнения подотчёта', body: input ? `Астемир запросил ${input.amount.toLocaleString('ru-RU')} ₽.${input.comment ? ` ${input.comment}` : ''}` : 'Астемир запросил пополнение.',
          href: '/admin/expense-requests#delivery', occurredAt: now,
        },
      });
      if (!existingManual && !openedNow) {
        const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
        await tx.adminInboxReceipt.createMany({ data: admins.map(user => ({ eventId: manualEvent.id, userId: user.id })), skipDuplicates: true });
        await queueAdminInboxTelegramDelivery({ db: tx, eventId: manualEvent.id });
      }
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
    return { requestId: activeReminder?.id, snapshot, requested: Boolean(activeReminder), requestedByBuyer, requestDetails, requestStateAvailable: true };
  });
}
