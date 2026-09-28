import { requireAdminApi } from '@/lib/admin-api-auth';
import { prisma } from '@/lib/prisma';
import { activeDeliveryRequest, deliveryMappedUser, loadDeliveryView } from '@/lib/procurement-delivery-reminders';
import { deliveryNativeCandidates } from '@/lib/procurement-delivery-native-source';
import { DELIVERY_LINK_SOURCE, deliveryLinkKey, type DeliveryNativeCandidate } from '@/lib/procurement-delivery-native';
import { DELIVERY_PERSON, DELIVERY_SOURCE, DELIVERY_OPEN } from '@/lib/procurement-delivery-policy';
import { deliveryDetailsKey, readDeliveryDetails } from '@/lib/procurement-delivery-request';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  try {
    await deliveryMappedUser();
    const active = await activeDeliveryRequest(), view = await loadDeliveryView();
    const selectedDay = new URL(request.url).searchParams.get('date') || undefined;
    let candidates: DeliveryNativeCandidate[] = [], candidatesAvailable = true;
    try { candidates = active && view.nativeRequest?.state === 'unlinked' ? await deliveryNativeCandidates(active.details, selectedDay) : []; }
    catch { candidatesAvailable = false; }
    const link = active ? await prisma.adminInboxEvent.findUnique({ where: { eventKey: deliveryLinkKey(active.id) } }) : null;
    const linkedRef = link?.type === 'procurement.delivery_native_linked' ? link.sourceId : null;
    return Response.json({ view, reminderId: active?.id ?? null, linkedRef, candidates, candidatesAvailable }, { headers });
  } catch { return Response.json({ error: 'Не удалось обновить заявку. Повторим автоматически.' }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  try {
    const origin = new URL(request.headers.get('origin') || '');
    if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== (request.headers.get('host') || new URL(request.url).host)) throw Error('origin');
  } catch { return Response.json({ error: 'Обновите страницу.' }, { status: 403 }); }
  try {
    await deliveryMappedUser();
    const body = await request.text();
    if (body.length > 2048) throw Error('input');
    const input = JSON.parse(body);
    if (!['link', 'unlink'].includes(input.action) || typeof input.reminderId !== 'string') throw Error('input');
    const active = await activeDeliveryRequest();
    if (!active || active.id !== input.reminderId) throw Error('changed');
    const candidate = input.action === 'link'
      ? (await deliveryNativeCandidates(active.details, input.date, true)).find(c => c.status.ref === input.ref && c.quote === input.quote) : null;
    if (input.action === 'link' && !candidate) throw Error('changed');
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106248)`;
      const latest = await tx.adminInboxEvent.findFirst({ where: { sourceType: DELIVERY_SOURCE, sourceId: DELIVERY_PERSON.ref }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      if (latest?.id !== active.id || latest.type !== DELIVERY_OPEN) throw Error('changed');
      const detailsEvent = await tx.adminInboxEvent.findUnique({ where: { eventKey: deliveryDetailsKey(active.id) } });
      const storedDetails = detailsEvent ? readDeliveryDetails(detailsEvent.body) : null;
      if (!storedDetails || storedDetails.amount !== active.details.amount || storedDetails.requestedAt !== active.details.requestedAt
        || storedDetails.comment !== active.details.comment || storedDetails.balance !== active.details.balance
        || storedDetails.checkedAt !== active.details.checkedAt) throw Error('changed');
      const eventKey = deliveryLinkKey(active.id);
      const existing = await tx.adminInboxEvent.findUnique({ where: { eventKey } });
      if (input.action === 'link' && existing?.type === 'procurement.delivery_native_linked') throw Error('already_linked');
      if (input.action === 'unlink' && (!existing || existing.type !== 'procurement.delivery_native_linked' || JSON.parse(existing.body).ref !== input.ref)) throw Error('changed');
      if (candidate) {
        // A native document cannot satisfy two portal requests, including historical ones.
        const used = await tx.adminInboxEvent.findMany({ where: { sourceType: DELIVERY_LINK_SOURCE, sourceId: candidate.status.ref, type: 'procurement.delivery_native_linked' } });
        if (used.some(e => e.eventKey !== eventKey && e.eventKey.startsWith('delivery:native:'))) throw Error('already_used');
      }
      const now = new Date();
      const data = { sourceType: DELIVERY_LINK_SOURCE, sourceId: candidate?.status.ref || input.ref,
        type: input.action === 'link' ? 'procurement.delivery_native_linked' : 'procurement.delivery_native_unlinked',
        title: input.action === 'link' ? 'Заявка 1С связана с запросом пополнения' : 'Связь с заявкой 1С отменена',
        body: JSON.stringify(candidate ? { version: 1, ref: candidate.status.ref, date: candidate.status.date, amount: active.details.amount, userId: access.user.id, linkedAt: now.toISOString() } : { version: 1, ref: input.ref, userId: access.user.id, unlinkedAt: now.toISOString() }),
        occurredAt: now, href: '/admin/expense-requests#delivery' };
      await tx.adminInboxEvent.upsert({ where: { eventKey }, create: { eventKey, ...data }, update: data });
      await tx.adminInboxEvent.create({ data: { ...data, eventKey: `delivery:link-audit:${active.id}:${crypto.randomUUID()}` } });
    });
    return Response.json({ ok: true }, { headers });
  } catch { return Response.json({ error: 'Связь не изменена: данные обновились или документ уже связан. Обновите блок и повторите.' }, { status: 409, headers }); }
}
