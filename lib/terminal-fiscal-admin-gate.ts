import 'server-only';
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { MatchingAuditRecord } from './terminal-fiscal-matching';

// Temporary pilot policy. Returning to automatic delivery requires an owner decision.
export const TERMINAL_FISCAL_ADMIN_FIRST = true;
export const fiscalApprovalKey = (id: string) => `terminal-fiscal-review:${id}:admin-approved`;

export async function stageFiscalAdminReview(db: PrismaClient, record: MatchingAuditRecord) {
  const hash = createHash('sha256').update(record.matchingKey).digest('hex');
  const reviewKey = `terminal-fiscal-review:${hash}`;
  const now = new Date(record.evaluatedAt);
  const at = new Date(record.evidence.bankTransactionDate);
  if (!Number.isFinite(at.getTime())) return;
  await db.$transaction(async (tx) => {
    const existing = await tx.terminalFiscalEmployeeReview.findUnique({ where: { reviewKey } });
    if (record.status === 'confirmed') {
      if (existing) {
        await tx.terminalFiscalEmployeeReview.update({ where: { id: existing.id }, data: { status: 'resolved', resolvedAt: now, lastCheckedAt: now } });
        await tx.workdayNotification.updateMany({ where: { reviewId: existing.id, status: 'pending' }, data: { status: 'cancelled' } });
      }
      return;
    }
    if (now.getTime() - at.getTime() < 15 * 60_000) return;
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true }, orderBy: { id: 'asc' } });
    if (!admins.length) throw new Error('TERMINAL_FISCAL_ADMIN_RECIPIENT_MISSING');
    const approved = existing && await tx.adminInboxEvent.findUnique({ where: { eventKey: fiscalApprovalKey(existing.id) } });
    const keepOpen = Boolean(approved && existing?.status === 'open');
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
    const when = at.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const event = await tx.adminInboxEvent.upsert({
      where: { eventKey: `${reviewKey}:admin-first` },
      create: { eventKey: `${reviewKey}:admin-first`, type: 'terminal_fiscal_review.created',
        title: 'Проверьте чек', body: `${record.amountKopecks / 100} ₽ · ${when}. Проверка ожидает решения администратора.`,
        href: `/admin/workday/payment-checks/${review.id}`, sourceType: 'terminal_fiscal_review', sourceId: review.id, occurredAt: now },
      update: {},
    });
    await tx.adminInboxReceipt.createMany({ data: admins.map((a) => ({ eventId: event.id, userId: a.id })), skipDuplicates: true });
  });
}

export async function fiscalProposedRecipients(db: Pick<PrismaClient, 'workDayEntry'>, at: Date) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  const entries = await db.workDayEntry.findMany({ where: { date, department: 'retail', status: { in: ['active', 'completed'] }, user: { role: 'EMPLOYEE', isActive: true } },
    select: { userId: true, startedAt: true, endedAt: true, user: { select: { name: true } } }, orderBy: { userId: 'asc' } });
  const active = entries.filter((e) => e.startedAt <= at && (!e.endedAt || e.endedAt >= at));
  const selected = active.length ? active : entries;
  return { scope: active.length ? 'retail_shift' : 'retail_day', users: [...new Map(selected.map((e) => [e.userId, { id: e.userId, name: e.user.name }])).values()] };
}

export async function approveFiscalReview(db: PrismaClient, id: string, adminId: number, expectedIds: number[], bodyFor: (at: Date, amount: number) => string) {
  return db.$transaction(async (tx) => {
    const admin = await tx.user.findFirst({ where: { id: adminId, role: 'ADMIN', isActive: true }, select: { id: true } });
    if (!admin) throw new Error('FORBIDDEN');
    const review = await tx.terminalFiscalEmployeeReview.findUnique({ where: { id } });
    if (!review || review.status === 'resolved') throw new Error('REVIEW_NOT_AVAILABLE');
    const match = await tx.terminalFiscalMatch.findUnique({ where: { matchingId: review.matchingHash } });
    if (match && (match.status === 'confirmed' || match.oneCSourceRef)) throw new Error('CHECK_ALREADY_EXISTS');
    const approved = await tx.adminInboxEvent.findUnique({ where: { eventKey: fiscalApprovalKey(id) } });
    if (approved && review.status === 'open') return { alreadyApproved: true };
    const proposed = await fiscalProposedRecipients(tx, review.bankOperationAt);
    if (!proposed.users.length) throw new Error('NO_RECIPIENTS');
    if (JSON.stringify(proposed.users.map((u) => u.id).sort((a,b)=>a-b)) !== JSON.stringify([...expectedIds].sort((a,b)=>a-b))) throw new Error('RECIPIENTS_CHANGED');
    const changed = await tx.terminalFiscalEmployeeReview.updateMany({ where: { id, status: 'admin_review' }, data: { status: 'open', employeeId: proposed.users[0].id, assignmentScope: proposed.scope } });
    if (changed.count !== 1) throw new Error('REVIEW_NOT_AVAILABLE');
    await tx.terminalFiscalReviewParticipant.deleteMany({ where: { reviewId: id } });
    await tx.terminalFiscalReviewParticipant.createMany({ data: proposed.users.map((u) => ({ reviewId: id, userId: u.id })), skipDuplicates: true });
    const now = new Date();
    await tx.adminInboxEvent.upsert({ where: { eventKey: fiscalApprovalKey(id) }, create: {
      eventKey: fiscalApprovalKey(id), type: 'terminal_fiscal_review.approved', title: 'Проверка передана менеджерам',
      body: `Администратор ${adminId} · ${proposed.users.map((u) => u.name).join(', ')}`, href: `/admin/workday/payment-checks/${id}`, sourceType: 'terminal_fiscal_review', sourceId: id, occurredAt: now }, update: {} });
    for (const u of proposed.users) await tx.workdayNotification.upsert({ where: { fingerprint: `${review.reviewKey}:approved:${u.id}` }, create: {
      fingerprint: `${review.reviewKey}:approved:${u.id}`, userId: u.id, reviewId: id, kind: 'terminal_fiscal_review',
      title: 'В 1С нет чека', body: bodyFor(review.bankOperationAt, review.amountKopecks), scheduledAt: now }, update: {} });
    return { alreadyApproved: false };
  });
}
