import 'server-only';

import type { PrismaClient } from '@prisma/client';
import { loadAusnReportCatalog } from './ausn-report-cache';
import { queueAdminInboxTelegramDelivery } from './admin-inbox';
import { buildTaxDocumentPlan } from './tax-document-plan';
import { taxDocumentTypes } from './tax-document-types';

export function taxDocumentReminderEventKey(period: { periodKey: string; missing: readonly string[] }) {
  return `tax_document_missing:${period.periodKey}:${[...period.missing].sort().join(',')}`;
}

export async function syncTaxDocumentReminder(db: PrismaClient, now = new Date()) {
  const [reports, documents] = await Promise.all([
    loadAusnReportCatalog(),
    db.taxControlDocument.findMany({ select: { documentType: true, periodKey: true, originalName: true } }),
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
