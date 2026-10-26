import { retailHomeTerminalKey, isRetailWorkstationReplacement } from './retail-workstation-responsibility';
import { terminalFiscalSourceIncomplete, terminalFiscalReasonLabel } from './terminal-fiscal-reason-view';
import { isFiscalChainReason } from './terminal-fiscal-chain-review';
import 'server-only';
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { MatchingAuditRecord, TerminalMapping } from './terminal-fiscal-matching';
import {
  TERMINAL_FISCAL_OWNER_DAY_TOTAL_RESOLVED,
  TERMINAL_FISCAL_OWNER_ARCHIVED_UNRESOLVED,
  terminalFiscalReviewHasFinalResolution,
} from './terminal-fiscal-day-closure';

// Uncertain cases stay ADMIN-first; safe workstation reminders are selected in employee-review.
export const TERMINAL_FISCAL_ADMIN_FIRST = true;
const TERMINAL_FISCAL_ADMIN_REVIEW_DELAY_MS = 30 * 60_000;
export const fiscalApprovalKey = (id: string) => `terminal-fiscal-review:${id}:admin-approved`;
export const fiscalTestPaymentKey = (id: string) => `terminal-fiscal-review:${id}:test-payment`;
export const fiscalDayTotalResolutionKey = (id: string) => `terminal-fiscal-review:${id}:day-total-reconciled`;
export const fiscalArchivedUnresolvedKey = (id: string) => `terminal-fiscal-review:${id}:archived-unresolved`;

type ProposedUser = { id: number; name: string };
export type FiscalProposedRecipients = {
  scope: 'workstation_shift' | 'retail_shift' | 'retail_day';
  users: ProposedUser[];
  primary: ProposedUser | null;
  confidence: 'high' | 'uncertain';
  reason: 'manual_kkm_assignment' | 'home_workstation' | 'floating_employee' | 'ambiguous';
};

function money(value: number) {
  return `${(value / 100).toLocaleString('ru-RU')} ₽`;
}

export async function stageFiscalAdminReview(db: PrismaClient, record: MatchingAuditRecord, mapping?: TerminalMapping, options: {minimumAgeMs?:number} = {}) {
  // An unavailable dependency is a technical incident, never one new case per payment.
  // Keep existing financial reviews and employee responses unchanged until a complete read.
  if (terminalFiscalSourceIncomplete(record.reasonCode)) return;
  const hash = createHash('sha256').update(record.matchingKey).digest('hex');
  const reviewKey = `terminal-fiscal-review:${hash}`;
  const now = new Date(record.evaluatedAt);
  const at = new Date(record.evidence.bankTransactionDate);
  if (!Number.isFinite(at.getTime())) return;
  await db.$transaction(async (tx) => {
    const existing = await tx.terminalFiscalEmployeeReview.findUnique({ where: { reviewKey } });
    if (existing && terminalFiscalReviewHasFinalResolution(existing)) {
      await tx.workdayNotification.updateMany({ where: { reviewId: existing.id, status: 'pending' }, data: { status: 'cancelled', pushStatus: 'cancelled', nextPushAttemptAt: null } });
      return;
    }
    const markedAsTest = existing && await tx.adminInboxEvent.findUnique({ where: { eventKey: fiscalTestPaymentKey(existing.id) } });
    if (markedAsTest) {
      if (existing.status !== 'resolved') await tx.terminalFiscalEmployeeReview.update({ where: { id: existing.id }, data: { status: 'resolved', resolvedAt: existing.resolvedAt ?? now, lastCheckedAt: now } });
      await tx.workdayNotification.updateMany({ where: { reviewId: existing.id, status: 'pending' }, data: { status: 'cancelled' } });
      return;
    }
    if (record.status === 'confirmed') {
      if (existing) {
        await tx.terminalFiscalEmployeeReview.update({ where: { id: existing.id }, data: { status: 'resolved', reasonCode:record.reasonCode, resolvedAt: existing.resolvedAt ?? now, lastCheckedAt: now } });
        await tx.workdayNotification.updateMany({ where: { reviewId: existing.id, status: 'pending' }, data: { status: 'cancelled' } });
      }
      return;
    }
    if (now.getTime() - at.getTime() < (options.minimumAgeMs ?? TERMINAL_FISCAL_ADMIN_REVIEW_DELAY_MS)) return;
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true }, orderBy: { id: 'asc' } });
    if (!admins.length) throw new Error('TERMINAL_FISCAL_ADMIN_RECIPIENT_MISSING');
    const approved = existing && await tx.adminInboxEvent.findUnique({ where: { eventKey: fiscalApprovalKey(existing.id) } });
    const possibleSplit = record.reasonCode === 'ONE_C_POSSIBLE_SPLIT_SALE' || isFiscalChainReason(record.reasonCode);
    const keepOpen = Boolean((approved || existing?.assignmentScope === 'workstation_shift') && existing?.status === 'open' && !possibleSplit && !record.oneCCheckKey
      && ['ONE_C_CANDIDATE_PENDING','ONE_C_CANDIDATE_NOT_FOUND'].includes(record.reasonCode));
    const review = await tx.terminalFiscalEmployeeReview.upsert({
      where: { reviewKey },
      create: { reviewKey, matchingHash: hash, mappingId: record.mappingId ?? null,
        employeeId: admins[0].id, assignmentScope: 'admin_gate', status: 'admin_review',
        reasonCode: record.reasonCode, bankOperationAt: at, amountKopecks: record.amountKopecks,
        cashierRefHash: hash, detectedAt: now, lastCheckedAt: now },
      update: { lastCheckedAt: now, reasonCode: record.reasonCode,
        ...(!keepOpen ? { status: 'admin_review', resolvedAt: null } : {}) },
    });
    if (!keepOpen) await tx.workdayNotification.updateMany({ where: { reviewId: review.id, status: 'pending' }, data: { status: 'cancelled' } });
    if (keepOpen && !approved && existing?.assignmentScope === 'workstation_shift') return;
    const when = at.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000));
    const proposed = await fiscalProposedRecipients(tx, at, record.mappingId);
    const workstation = proposed.confidence === 'high' && proposed.primary
      ? `Рабочее место: ${proposed.primary.name}. ` : '';
    const terminal = mapping?.terminalKey ? `Терминал ${mapping.terminalKey}. ` : '';
    const definitelyMissing = record.candidateCount === 0
      && ['ONE_C_CANDIDATE_PENDING', 'ONE_C_CANDIDATE_NOT_FOUND'].includes(record.reasonCode)
      && record.sourceCompleteness.tbank
      && record.sourceCompleteness.oneC;
    const uncertain = !definitelyMissing;
    const title = record.reasonCode === 'OFD_CANDIDATE_REQUIRES_LINK' ? 'Связать чек ОФД с оплатой' : record.reasonCode === 'ONE_C_POSSIBLE_SPLIT_SALE' ? 'Возможное разделение продажи' : possibleSplit ? 'Проверить цепочку оплаты' : uncertain ? terminalFiscalReasonLabel(record.reasonCode) : 'В 1С нет чека';
    const body = `${terminal}${workstation}Оплата ${money(record.amountKopecks)} в ${when}. ${record.reasonCode === 'OFD_CANDIDATE_REQUIRES_LINK'
      ? 'Есть возможный чек ОФД. Требуется связать документы; просьба пробить повторный чек не отправляется.'
      : possibleSplit
      ? 'Найдены связанные по суммам фискальные документы; товары сверены с ОФД. Требуется проверить цепочку оплат, чеков и возвратов.'
      : uncertain ? `${terminalFiscalReasonLabel(record.reasonCode)}. Проверьте документы; повторно пробивать чек до проверки не нужно.`
      : `1С прочитана полностью: соответствующего чека нет уже ${elapsedMinutes} мин.`}`;
    const event = await tx.adminInboxEvent.upsert({
      where: { eventKey: `${reviewKey}:admin-first` },
      create: { eventKey: `${reviewKey}:admin-first`, type: 'terminal_fiscal_review.created',
        title, body,
        href: `/admin/workday/payment-checks/${review.id}`, sourceType: 'terminal_fiscal_review', sourceId: review.id, occurredAt: now },
      update: { title, body },
    });
    await tx.adminInboxReceipt.createMany({ data: admins.map((a) => ({ eventId: event.id, userId: a.id })), skipDuplicates: true });
  });
}

export async function fiscalProposedRecipients(db: Pick<PrismaClient,
  'workDayEntry' | 'terminalFiscalMapping' | 'workdayKkmAssignment' | 'userOneCCashboxMapping'
>, at: Date, mappingId?: string | null): Promise<FiscalProposedRecipients> {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  const entries = await db.workDayEntry.findMany({ where: { date, department: 'retail', status: { in: ['active', 'completed'] }, user: { role: 'EMPLOYEE', isActive: true } },
    select: { userId: true, startedAt: true, endedAt: true, user: { select: { name: true } } }, orderBy: { userId: 'asc' } });
  const active = entries.filter((e) => e.startedAt <= at && (!e.endedAt || e.endedAt >= at));
  const selected = active.length ? active : entries;
  const users = [...new Map(selected.map((e) => [e.userId, { id: e.userId, name: e.user.name }])).values()];
  const ambiguous = (): FiscalProposedRecipients => ({
    scope: active.length ? 'retail_shift' : 'retail_day', users, primary: null, confidence: 'uncertain', reason: 'ambiguous',
  });
  // A personal proposal is safe only for the normal two-person retail shift.
  // Otherwise the ADMIN keeps the existing shared delivery instead of guessing.
  if (!mappingId || active.length !== 2 || users.length !== 2) return ambiguous();
  const mapping = await db.terminalFiscalMapping.findUnique({
    where: { id: mappingId }, select: { oneCCashRegisterRef: true, terminalKey: true },
  });
  if (!mapping?.oneCCashRegisterRef) return ambiguous();
  const userIds = users.map((user) => user.id);
  const assignments = await db.workdayKkmAssignment.findMany({
    where: { date, userId: { in: userIds }, oneCCashRegisterRef: mapping.oneCCashRegisterRef,
      effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
    select: { userId: true }, take: 2,
  });
  const assignedIds = [...new Set(assignments.map((item) => item.userId))];
  const ordered = (primaryId: number, reason: FiscalProposedRecipients['reason']): FiscalProposedRecipients => {
    const primary = users.find((user) => user.id === primaryId) ?? null;
    return primary ? { scope: 'workstation_shift', users: [primary, ...users.filter((user) => user.id !== primaryId)], primary, confidence: 'high', reason } : ambiguous();
  };
  if (assignedIds.length === 1) return ordered(assignedIds[0], 'manual_kkm_assignment');
  if (assignedIds.length > 1) return ambiguous();

  const homeMappings = await db.userOneCCashboxMapping.findMany({
    where: { userId: { in: userIds }, isActive: true }, select: { userId: true, oneCCashRegisterRef: true },
  });
  // Owner-confirmed physical seating is independent of personal 1C cashboxes.
  // An explicit home KKM remains authoritative when one has been configured.
  const homeTerminal = (user: ProposedUser) => retailHomeTerminalKey(user.name);
  const hasExplicitHome = (id: number) => homeMappings.some(item => item.userId === id && item.oneCCashRegisterRef);
  const policyIds = users.filter(user => !hasExplicitHome(user.id) && homeTerminal(user) === mapping.terminalKey).map(user => user.id);
  const directIds = [...new Set(homeMappings.filter((item) => item.oneCCashRegisterRef === mapping.oneCCashRegisterRef).map((item) => item.userId).concat(policyIds))];
  if (directIds.length === 1) return ordered(directIds[0], 'home_workstation');
  if (directIds.length > 1) return ambiguous();

  const activeMappings = await db.terminalFiscalMapping.findMany({
    where: { isActive: true, effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
    select: { oneCCashRegisterRef: true, terminalKey: true },
  });
  const knownWorkstations = new Set(activeMappings.map((item) => item.oneCCashRegisterRef));
  const fixedEmployeeIds = new Set(homeMappings.filter((item) => item.oneCCashRegisterRef && knownWorkstations.has(item.oneCCashRegisterRef)).map((item) => item.userId));
  const knownTerminals = new Set(activeMappings.map(item => item.terminalKey));
  for (const user of users) {
    const key = homeTerminal(user);
    if (!hasExplicitHome(user.id) && key && knownTerminals.has(key)) fixedEmployeeIds.add(user.id);
  }
  const floating = users.filter((user) => !fixedEmployeeIds.has(user.id));
  return floating.length === 1 && isRetailWorkstationReplacement(floating[0].name)
    && fixedEmployeeIds.size === 1 && knownTerminals.has(mapping.terminalKey)
    ? ordered(floating[0].id, 'floating_employee') : ambiguous();
}

export async function approveFiscalReview(db: PrismaClient, id: string, adminId: number, expectedIds: number[], bodyFor: (at: Date, amount: number, shared: boolean) => string) {
  return db.$transaction(async (tx) => {
    const admin = await tx.user.findFirst({ where: { id: adminId, role: 'ADMIN', isActive: true }, select: { id: true } });
    if (!admin) throw new Error('FORBIDDEN');
    const review = await tx.terminalFiscalEmployeeReview.findUnique({ where: { id } });
    if (!review || review.status === 'resolved') throw new Error('REVIEW_NOT_AVAILABLE');
    const match = await tx.terminalFiscalMatch.findUnique({ where: { matchingId: review.matchingHash } });
    if (match?.reasonCode === 'ONE_C_POSSIBLE_SPLIT_SALE' || review.reasonCode === 'ONE_C_POSSIBLE_SPLIT_SALE' || isFiscalChainReason(match?.reasonCode ?? '') || isFiscalChainReason(review.reasonCode)) throw new Error('REVIEW_NOT_AVAILABLE');
    if (match && (match.status === 'confirmed' || match.oneCSourceRef)) throw new Error('CHECK_ALREADY_EXISTS');
    if (match?.reasonCode === 'OFD_CANDIDATE_REQUIRES_LINK' || review.reasonCode === 'OFD_CANDIDATE_REQUIRES_LINK') throw new Error('REVIEW_NOT_AVAILABLE');
    const approved = await tx.adminInboxEvent.findUnique({ where: { eventKey: fiscalApprovalKey(id) } });
    if (approved && review.status === 'open') return { alreadyApproved: true };
    const proposed = await fiscalProposedRecipients(tx, review.bankOperationAt, review.mappingId);
    if (!proposed.users.length) throw new Error('NO_RECIPIENTS');
    if (JSON.stringify(proposed.users.map((u) => u.id).sort((a,b)=>a-b)) !== JSON.stringify([...expectedIds].sort((a,b)=>a-b))) throw new Error('RECIPIENTS_CHANGED');
    const primary = proposed.primary ?? proposed.users[0];
    const recipients = proposed.confidence === 'high' ? [primary] : proposed.users;
    const changed = await tx.terminalFiscalEmployeeReview.updateMany({ where: { id, status: 'admin_review' }, data: { status: 'open', employeeId: primary.id, assignmentScope: proposed.scope } });
    if (changed.count !== 1) throw new Error('REVIEW_NOT_AVAILABLE');
    await tx.terminalFiscalReviewParticipant.deleteMany({ where: { reviewId: id } });
    await tx.terminalFiscalReviewParticipant.createMany({ data: proposed.users.map((u) => ({ reviewId: id, userId: u.id })), skipDuplicates: true });
    const now = new Date();
    await tx.adminInboxEvent.upsert({ where: { eventKey: fiscalApprovalKey(id) }, create: {
      eventKey: fiscalApprovalKey(id), type: 'terminal_fiscal_review.approved', title: proposed.confidence === 'high' ? 'Проверка передана менеджеру' : 'Проверка передана менеджерам',
      body: `Администратор ${adminId} · ${recipients.map((u) => u.name).join(', ')}`, href: `/admin/workday/payment-checks/${id}`, sourceType: 'terminal_fiscal_review', sourceId: id, occurredAt: now }, update: {} });
    for (const u of recipients) await tx.workdayNotification.upsert({ where: { fingerprint: `${review.reviewKey}:approved:${u.id}` }, create: {
      fingerprint: `${review.reviewKey}:approved:${u.id}`, userId: u.id, reviewId: id, kind: 'terminal_fiscal_review',
      title: 'В 1С нет чека', body: bodyFor(review.bankOperationAt, review.amountKopecks, proposed.confidence !== 'high'), scheduledAt: now }, update: {} });
    return { alreadyApproved: false };
  });
}

export async function dismissFiscalReviewAsTestPayment(db: PrismaClient, id: string, adminId: number) {
  return db.$transaction(async (tx) => {
    const admin = await tx.user.findFirst({ where: { id: adminId, role: 'ADMIN', isActive: true }, select: { id: true } });
    if (!admin) throw new Error('FORBIDDEN');
    const review = await tx.terminalFiscalEmployeeReview.findUnique({ where: { id } });
    if (!review || review.status === 'resolved') throw new Error('REVIEW_NOT_AVAILABLE');
    const now = new Date();
    await tx.terminalFiscalEmployeeReview.update({ where: { id }, data: { status: 'resolved', resolvedAt: now, lastCheckedAt: now } });
    await tx.workdayNotification.updateMany({ where: { reviewId: id, status: 'pending' }, data: { status: 'cancelled' } });
    await tx.adminInboxEvent.upsert({
      where: { eventKey: fiscalTestPaymentKey(id) },
      create: { eventKey: fiscalTestPaymentKey(id), type: 'terminal_fiscal_review.test_payment', title: 'Тестовая оплата исключена из контроля',
        body: `Администратор ${adminId} подтвердил тестовую операцию ${money(review.amountKopecks)}.`, href: `/admin/workday/payment-checks/${id}`,
        sourceType: 'terminal_fiscal_review', sourceId: id, occurredAt: now },
      update: {},
    });
    return { resolvedAt: now };
  });
}

export async function dismissFiscalReviewAsReconciledDay(db: PrismaClient, id: string, adminId: number) {
  return db.$transaction(async (tx) => {
    const admin = await tx.user.findFirst({ where: { id: adminId, role: 'ADMIN', isActive: true }, select: { id: true } });
    if (!admin) throw new Error('FORBIDDEN');
    const review = await tx.terminalFiscalEmployeeReview.findUnique({ where: { id } });
    if (!review) throw new Error('REVIEW_NOT_AVAILABLE');
    if (terminalFiscalReviewHasFinalResolution(review)) return { resolvedAt: review.resolvedAt, alreadyResolved: true };
    if (review.status === 'resolved') throw new Error('REVIEW_NOT_AVAILABLE');
    const now = new Date();
    await tx.terminalFiscalEmployeeReview.update({
      where: { id },
      data: {
        status: 'resolved',
        reasonCode: TERMINAL_FISCAL_OWNER_DAY_TOTAL_RESOLVED,
        resolvedAt: now,
        lastCheckedAt: now,
      },
    });
    await tx.workdayNotification.updateMany({
      where: { reviewId: id, status: 'pending' },
      data: { status: 'cancelled', pushStatus: 'cancelled', nextPushAttemptAt: null },
    });
    await tx.adminInboxEvent.upsert({
      where: { eventKey: fiscalDayTotalResolutionKey(id) },
      create: {
        eventKey: fiscalDayTotalResolutionKey(id),
        type: 'terminal_fiscal_review.day_total_reconciled',
        title: 'Проверка закрыта после сверки дня',
        body: `Администратор ${adminId} подтвердил сверку итогов дня для операции ${money(review.amountKopecks)}.`,
        href: `/admin/workday/payment-checks/${id}`,
        sourceType: 'terminal_fiscal_review',
        sourceId: id,
        occurredAt: now,
      },
      update: {},
    });
    return { resolvedAt: now, alreadyResolved: false };
  });
}

export async function archiveFiscalReviewUnresolved(db: PrismaClient, id: string, adminId: number) {
  return db.$transaction(async (tx) => {
    const admin = await tx.user.findFirst({ where: { id: adminId, role: 'ADMIN', isActive: true }, select: { id: true } });
    if (!admin) throw new Error('FORBIDDEN');
    const review = await tx.terminalFiscalEmployeeReview.findUnique({ where: { id } });
    if (!review) throw new Error('REVIEW_NOT_AVAILABLE');
    if (review.status === 'resolved' && review.reasonCode === TERMINAL_FISCAL_OWNER_ARCHIVED_UNRESOLVED) {
      return { resolvedAt: review.resolvedAt, alreadyResolved: true };
    }
    if (review.status === 'resolved') throw new Error('REVIEW_NOT_AVAILABLE');
    const now = new Date();
    await tx.terminalFiscalEmployeeReview.update({
      where: { id },
      data: {
        status: 'resolved',
        reasonCode: TERMINAL_FISCAL_OWNER_ARCHIVED_UNRESOLVED,
        resolvedAt: now,
        lastCheckedAt: now,
      },
    });
    await tx.workdayNotification.updateMany({
      where: { reviewId: id, status: 'pending' },
      data: { status: 'cancelled', pushStatus: 'cancelled', nextPushAttemptAt: null },
    });
    await tx.adminInboxEvent.upsert({
      where: { eventKey: fiscalArchivedUnresolvedKey(id) },
      create: {
        eventKey: fiscalArchivedUnresolvedKey(id),
        type: 'terminal_fiscal_review.archived_unresolved',
        title: 'Старая проверка убрана в историю',
        body: `Администратор ${adminId} убрал из активных нерешённую проверку операции ${money(review.amountKopecks)}. Ошибка не отмечена исправленной.`,
        href: `/admin/workday/payment-checks/${id}`,
        sourceType: 'terminal_fiscal_review',
        sourceId: id,
        occurredAt: now,
      },
      update: {},
    });
    return { resolvedAt: now, alreadyResolved: false };
  });
}
