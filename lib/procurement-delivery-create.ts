import { cashboxShifts } from './procurement-cashbox-shifts';
import type { CashboxShift } from './procurement-cashbox-shift-policy';
import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from './prisma';
import { activeDeliveryRequest, deliveryMappedUser, loadDeliveryView } from './procurement-delivery-reminders';
import { DELIVERY_PERSON } from './procurement-delivery-policy';
import { chooseDeliveryCashbox } from './procurement-delivery-cashbox-choice';
import { deliveryFundingFromEvidence, deliveryFundingForManagerCashboxes } from './procurement-delivery-funding';
import { deliveryLinkKey, DELIVERY_LINK_SOURCE } from './procurement-delivery-native';
import { deliveryCreateMode, deliveryCreationRef, deliveryCreationSummary, type DeliveryCreatePlan, type DeliveryCreateSummary } from './procurement-delivery-create-policy';
import { deliveryCreationApi, readDeliveryCreation, previewDeliveryCreation, confirmDeliveryCreation } from './procurement-delivery-create-source';
const creationMode = () => deliveryCreateMode() === 'production' ? 'production' : 'test';
const keyFor = (id: string) => `delivery:create:${creationMode() === 'production' ? 'v1' : 'test'}:${id}`;
const creationEvent = () => creationMode() === 'production'
  ? { type: 'procurement.delivery_creation', sourceType: 'delivery_creation', title: 'Создание подотчётной заявки' }
  : { type: 'procurement.delivery_creation_test', sourceType: 'delivery_creation_test', title: 'Тест создания подотчётной заявки' };
type Stored = { cashboxShift?: CashboxShift; state: 'checking' | 'preview' | 'confirming' | 'review' | 'committed'; plan: DeliveryCreatePlan; requestedAt: string; previewId?: string; token?: string; summary?: DeliveryCreateSummary; expiresAt?: number };
async function stored(id: string): Promise<Stored | null> {
  const row = await prisma.adminInboxEvent.findUnique({ where: { eventKey: keyFor(id) } });
  return row ? JSON.parse(row.body) : null;
}
async function save(id: string, value: Stored) {
  const data = { ...creationEvent(), sourceId: id, body: JSON.stringify(value), href: '/admin/expense-requests#delivery', occurredAt: new Date() };
  await prisma.adminInboxEvent.upsert({ where: { eventKey: keyFor(id) }, create: { eventKey: keyFor(id), ...data }, update: data });
}
function publicState(value: Stored | null) {
  return value ? { state: value.state, summary: value.summary, cashboxShift: value.cashboxShift, previewId: value.previewId, expiresAt: value.expiresAt } : { state: 'ready' as const };
}
export async function deliveryCreationState() {
  const active = await activeDeliveryRequest();
  return { reminderId: active?.id ?? null, ...publicState(active ? await stored(active.id) : null) };
}
async function currentRequest(id: string, command?: Stored) {
  await deliveryMappedUser();
  const active = await activeDeliveryRequest();
  if (!active || active.id !== id || (command && (active.details.amount !== command.plan.amount || active.details.comment !== command.plan.comment || active.details.requestedAt !== command.requestedAt))) throw Error('REQUEST_CHANGED');
  return active;
}
async function checkCashbox(ref: string, amount: number) {
  const [raw, mappings] = await Promise.all([
    deliveryCreationApi(`cash-funding-context?organization_ref=${DELIVERY_PERSON.organizationRef}`),
    prisma.userOneCCashboxMapping.findMany({ where: { isActive: true, user: { isActive: true, role: 'EMPLOYEE', portalArea: 'WORKDAY', department: { in: ['retail', 'wholesale'] } } }, select: { oneCCashboxRef: true } }),
  ]);
  const choice = chooseDeliveryCashbox(deliveryFundingForManagerCashboxes(deliveryFundingFromEvidence(raw), mappings.map(m => m.oneCCashboxRef)), amount);
  if (choice.state !== 'ready' || !choice.candidates.some(c => c.ref === ref)) throw Error('CASHBOX_REVIEW_REQUIRED');
  const shift = (await cashboxShifts([ref])).get(ref);
  if (!shift || shift.state === 'unknown') throw Error('CASHBOX_SHIFT_UNAVAILABLE');
  return shift;
}
async function finish(id: string, command: Stored, native: any) {
  const summary = deliveryCreationSummary(native.state, command.plan);
  const result: Stored = { ...command, state: 'committed', summary };
  // Independent native read succeeded. Persist the existing native link atomically.
  await prisma.$transaction(async tx => {
    const eventKey = deliveryLinkKey(id);
    const link = await tx.adminInboxEvent.findUnique({ where: { eventKey } });
    if (link && link.sourceId !== summary.ref) throw Error('LINK_CONFLICT');
    const data = { sourceType: DELIVERY_LINK_SOURCE, sourceId: summary.ref, type: 'procurement.delivery_native_linked', title: creationMode() === 'production' ? 'Заявка создана: к оплате' : 'Тестовая заявка создана: к оплате', body: JSON.stringify({ version: 1, ref: summary.ref, date: summary.date, amount: summary.amount, userId: Number(command.plan.actor.replace(/^portal-admin:/, '')), linkedAt: new Date().toISOString() }), href: '/admin/expense-requests#delivery', occurredAt: new Date() };
    await tx.adminInboxEvent.upsert({ where: { eventKey }, create: { eventKey, ...data }, update: data });
    await tx.adminInboxEvent.update({ where: { eventKey: keyFor(id) }, data: { body: JSON.stringify(result) } });
  });
  return publicState(result);
}
export async function actDeliveryCreation(input: { action: string; reminderId: string; cashboxRef?: string; previewId?: string; reportDate?: string }, userId: number) {
  const { reminderId: id } = input;
  if (input.action === 'recover') {
    const command = await stored(id); if (!command) throw Error('NO_COMMAND');
    const native = await readDeliveryCreation(command.plan.request_ref);
    if (native.status === 'committed') return finish(id, command, native);
    // After a potentially committed POST, never offer a new command. Same identity only.
    if (['confirming', 'review'].includes(command.state)) return publicState(command);
    if (native.status === 'absent' || native.status === 'preview') {
      const reset: Stored = { ...command, state: 'preview', expiresAt: 0, token: undefined, previewId: undefined };
      await save(id, reset); return publicState(reset);
    }
    throw Error('RECOVERY_UNAVAILABLE');
  }
  const active = await currentRequest(id);
  let command = await stored(id);
  if (command?.state === 'committed') return finish(id, command, await readDeliveryCreation(command.plan.request_ref));
  if (input.action === 'preview') {
    if (command && ['confirming', 'review', 'checking'].includes(command.state)) throw Error('RECOVERY_REQUIRED');
    const view = await loadDeliveryView();
    const linked = await prisma.adminInboxEvent.findUnique({ where: { eventKey: deliveryLinkKey(id) } });
    if (linked || view.nativeRequest?.state !== 'unlinked' || view.nativeRequest.reviewReason) throw Error('EXISTING_OR_UNVERIFIED_REQUEST');
    if (!input.reportDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.reportDate)) throw Error('REPORT_DATE_REQUIRED');
    if (!input.cashboxRef || !/^[0-9a-f-]{36}$/.test(input.cashboxRef)) throw Error('CASHBOX_REQUIRED');
    const cashboxShift = await checkCashbox(input.cashboxRef, active.details.amount);
    const expectedCommand = command ? JSON.stringify(command) : null;
    const ref = deliveryCreationRef(id, creationMode());
    command = { state: 'checking', cashboxShift, requestedAt: active.details.requestedAt, plan: { action: 'create_accountable', request_ref: ref, command_id: ref, cashbox_ref: input.cashboxRef, amount: active.details.amount, comment: active.details.comment, actor: `portal-admin:${userId}`, report_date: input.reportDate } };
    // A conditional write prevents two tabs replacing each other's preview.
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106250)`;
      const old = await tx.adminInboxEvent.findUnique({ where: { eventKey: keyFor(id) } });
      if ((old?.body ?? null) !== expectedCommand) throw Error('PREVIEW_CHANGED');
      if (old && ['checking','confirming','review','committed'].includes(JSON.parse(old.body).state)) throw Error('RECOVERY_REQUIRED');
      const data = { ...creationEvent(), sourceId: id, body: JSON.stringify(command), href: '/admin/expense-requests#delivery', occurredAt: new Date() };
      await tx.adminInboxEvent.upsert({ where: { eventKey: keyFor(id) }, create: { eventKey: keyFor(id), ...data }, update: data });
    });
    try {
      const result = await previewDeliveryCreation(command.plan);
      if (result.committed) return finish(id, command, await readDeliveryCreation(ref));
      if (result.transaction_rolled_back !== true || !result.preview_token) throw Error('ROLLBACK_NOT_CONFIRMED');
      const native = await readDeliveryCreation(ref);
      if (native.status !== 'preview') throw Error('ROLLBACK_READBACK');
      command = { ...command, state: 'preview', token: result.preview_token, previewId: randomUUID(), expiresAt: Date.now() + 10 * 60000, summary: deliveryCreationSummary(result.proposed_after, command.plan) };
      await save(id, command); return publicState(command);
    } catch (error) { await save(id, { ...command, state: 'checking' }); throw error; }
  }
  if (input.action !== 'confirm' || !command?.token || input.previewId !== command.previewId) throw Error('PREVIEW_REQUIRED');
  // Retry an uncertain confirmation ONLY with the identical stored plan/token.
  const native = await readDeliveryCreation(command.plan.request_ref);
  if (native.status === 'committed') return finish(id, command, native);
  await currentRequest(id, command);
  if (command.state !== 'preview' || !command.expiresAt || Date.now() > command.expiresAt) throw Error('RECOVERY_REQUIRED');
  const currentShift = await checkCashbox(command.plan.cashbox_ref, command.plan.amount);
  if (!command.cashboxShift || currentShift.version !== command.cashboxShift.version) {
    // Preserve command identity, but require a new review of the changed cashier/shift.
    await prisma.adminInboxEvent.updateMany({
      where: { eventKey: keyFor(id), body: JSON.stringify(command) },
      data: { body: JSON.stringify({ ...command, expiresAt: 0 }) },
    });
    throw Error('CASHBOX_SHIFT_CHANGED');
  }
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106250)`;
    const row = await tx.adminInboxEvent.findUniqueOrThrow({ where: { eventKey: keyFor(id) } });
    const saved: Stored = JSON.parse(row.body);
    if (saved.state !== 'preview' || saved.previewId !== input.previewId) throw Error('PREVIEW_CHANGED');
    await tx.adminInboxEvent.update({ where: { id: row.id }, data: { body: JSON.stringify({ ...command, state: 'confirming' }) } });
  });
  try {
    await confirmDeliveryCreation(command.plan, command.token);
    const readback = await readDeliveryCreation(command.plan.request_ref);
    if (readback.status !== 'committed') throw Error('CREATION_UNVERIFIED');
    return await finish(id, command, readback);
  } catch (error) { await save(id, { ...command, state: 'review' }); throw error; }
}
