import 'server-only';

import type { PrismaClient } from '@prisma/client';
import { assessTaxLimitRisk, loadAusnReportCatalog, loadCurrentAusnReport } from './ausn-report-cache';
import { queueAdminInboxTelegramDelivery } from './admin-inbox';
import { buildTaxDocumentPlan } from './tax-document-plan';
import { taxDocumentTypes } from './tax-document-types';
import { loadPortalReports } from './ausn-portal-view';
import { taxDecisionReminder, taxFreshnessReminder, type TaxReminder } from './tax-attention-reminders';

export function taxDocumentReminderEventKey(period: { periodKey: string; missing: readonly string[] }) {
  return `tax_document_missing:${period.periodKey}:${[...period.missing].sort().join(',')}`;
}

export function taxLimitReminderEventKey(input: { level: string; dataCutoff?: string }) {
  const year = input.dataCutoff?.slice(0, 4) || new Date().getUTCFullYear().toString();
  return `tax_limit:${year}:${input.level}`;
}

export async function syncTaxLimitReminder(db: PrismaClient, now = new Date()) {
  const report = await loadCurrentAusnReport();
  const risk = assessTaxLimitRisk(report);
  if (risk.level === 'unknown' || risk.level === 'normal') return { state: risk.level as 'unknown' | 'normal' };
  const eventKey = taxLimitReminderEventKey({ level: risk.level, dataCutoff: report.dataCutoff });
  const event = await db.$transaction(async (tx) => {
    const saved = await tx.adminInboxEvent.upsert({
      where: { eventKey },
      create: {
        eventKey,
        type: 'tax.limit_attention',
        title: risk.label,
        body: `${risk.explanation}${report.remaining === undefined ? '' : ` Остаток: ${report.remaining.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽.`}`,
        href: '/admin/taxes',
        sourceType: 'tax_limit',
        sourceId: report.dataCutoff?.slice(0, 4) || now.getUTCFullYear().toString(),
        occurredAt: now,
      },
      update: {},
    });
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    await tx.adminInboxReceipt.createMany({ data: admins.map((admin) => ({ eventId: saved.id, userId: admin.id })), skipDuplicates: true });
    await queueAdminInboxTelegramDelivery({ db: tx, eventId: saved.id });
    return saved;
  });
  return { state: risk.level, eventId: event.id, eventKey };
}

export async function syncTaxControlReminders(db: PrismaClient, now = new Date()) {
  const [documents, limit, processing, attention] = await Promise.all([
    syncTaxDocumentReminder(db, now),
    syncTaxLimitReminder(db, now),
    syncTaxProcessingFailureReminder(db, now),
    syncTaxAttentionReminders(db, now),
  ]);
  return { documents, limit, processing, attention };
}

// Stale/unavailable figures and the limit decision date go only to the person
// responsible for tax documents (TAX_CONTROL_ALERT_LOGINS, comma-separated), in the
// portal inbox and web push — never to Telegram and never to other admins.
export async function currentTaxAttentionReminders(now = new Date()): Promise<TaxReminder[]> {
  const reports = await loadPortalReports();
  const year = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(now).slice(0, 4);
  const full = reports.find((report) => report.kind === 'full' && report.year === year);
  const freshness = taxFreshnessReminder(reports, now);
  // A decision date computed from stale figures would be misleading.
  const decision = freshness ? undefined : taxDecisionReminder(full?.available ? full : undefined, now);
  return [freshness, decision].filter((item): item is TaxReminder => Boolean(item));
}

export function taxAlertLogins(env: Record<string, string | undefined> = process.env) {
  return (env.TAX_CONTROL_ALERT_LOGINS || '').split(',').map((login) => login.trim()).filter(Boolean);
}

export async function syncTaxAttentionReminders(db: PrismaClient, now = new Date()) {
  const logins = taxAlertLogins();
  if (!logins.length) return { state: 'no_recipient' as const };
  const reminders = await currentTaxAttentionReminders(now);
  const recipients = await db.user.findMany({ where: { login: { in: logins }, role: 'ADMIN', isActive: true }, select: { id: true } });
  if (!recipients.length) return { state: 'no_recipient' as const };
  for (const reminder of reminders) {
    await db.$transaction(async (tx) => {
      const saved = await tx.adminInboxEvent.upsert({
        where: { eventKey: reminder.eventKey },
        create: { eventKey: reminder.eventKey, type: reminder.type, title: reminder.title, body: reminder.body, href: '/admin/taxes', sourceType: reminder.sourceType, sourceId: reminder.eventKey.split(':').slice(1).join(':'), occurredAt: now },
        update: {},
      });
      await tx.adminInboxReceipt.createMany({ data: recipients.map((user) => ({ eventId: saved.id, userId: user.id })), skipDuplicates: true });
    });
  }
  return { state: reminders.length ? 'raised' as const : 'clear' as const, keys: reminders.map((reminder) => reminder.eventKey) };
}

export async function syncTaxProcessingFailureReminder(db: PrismaClient, now = new Date()) {
  const failed = await db.taxControlDocument.findFirst({ where: { status: 'PROCESSING_FAILED' }, orderBy: { createdAt: 'desc' }, select: { id: true, originalName: true, periodKey: true } });
  if (!failed) return { state: 'complete' as const };
  const eventKey = `tax_processing_failed:${failed.id}`;
  const event = await db.$transaction(async (tx) => {
    const saved = await tx.adminInboxEvent.upsert({
      where: { eventKey },
      create: { eventKey, type: 'tax.processing_failed', title: 'Отчёт АУСН не обновился', body: `Файл «${failed.originalName}» за ${failed.periodKey} сохранён, но не обработан. Откройте раздел «Налоги» и повторите загрузку.`, href: '/admin/taxes', sourceType: 'tax_control', sourceId: failed.id, occurredAt: now },
      update: {},
    });
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    await tx.adminInboxReceipt.createMany({ data: admins.map((admin) => ({ eventId: saved.id, userId: admin.id })), skipDuplicates: true });
    await queueAdminInboxTelegramDelivery({ db: tx, eventId: saved.id });
    return saved;
  });
  return { state: 'failed' as const, eventId: event.id, documentId: failed.id };
}

export async function syncTaxDocumentReminder(db: PrismaClient, now = new Date()) {
  const [reports, documents] = await Promise.all([
    loadAusnReportCatalog(),
    db.taxControlDocument.findMany({ select: { documentType: true, periodKey: true, coverageFrom: true, coverageTo: true, originalName: true, status: true } }),
  ]);
  const next = buildTaxDocumentPlan({ now, reports, documents: documents.map((document) => ({ ...document, source: 'portal' as const })) }).find((period) => period.status === 'missing');
  if (!next) return { state: 'complete' as const };
  const eventKey = taxDocumentReminderEventKey(next);
  const event = await db.$transaction(async (tx) => {
    const saved = await tx.adminInboxEvent.upsert({
      where: { eventKey },
      create: { eventKey, type: 'tax.document_missing', title: `Нужны документы ФНС за ${next.periodKey}`, body: `Не хватает: ${next.missing.map((type) => taxDocumentTypes[type]).join(', ')}.`, href: '/admin/taxes', sourceType: 'tax_control', sourceId: next.periodKey, occurredAt: now },
      update: {},
    });
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    await tx.adminInboxReceipt.createMany({ data: admins.map((admin) => ({ eventId: saved.id, userId: admin.id })), skipDuplicates: true });
    await queueAdminInboxTelegramDelivery({ db: tx, eventId: saved.id });
    return saved;
  });
  return { state: 'missing' as const, eventId: event.id, periodKey: next.periodKey, missing: next.missing };
}
