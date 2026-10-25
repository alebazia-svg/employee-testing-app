import 'server-only';

import type { PrismaClient } from '@prisma/client';
import { assessTaxLimitRisk, loadAusnReportCatalog, loadCurrentAusnReport } from './ausn-report-cache';
import { queueAdminInboxTelegramDelivery } from './admin-inbox';
import { buildTaxDocumentPlan } from './tax-document-plan';
import { taxDocumentTypes } from './tax-document-types';

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
  const [documents, limit, processing] = await Promise.all([
    syncTaxDocumentReminder(db, now),
    syncTaxLimitReminder(db, now),
    syncTaxProcessingFailureReminder(db, now),
  ]);
  return { documents, limit, processing };
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
