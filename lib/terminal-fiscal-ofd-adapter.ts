import type { MatchingItem, OfdReceipt } from '@/lib/terminal-fiscal-matching';

export type NormalizedPlatformaOfdZReport = {
  kktRegistrationNumber: string;
  fiscalDriveNumber: string;
  shiftNumber: string;
  openedAt: string;
  closedAt: string;
  documentLink: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function integer(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function decimal(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeItems(value: unknown): MatchingItem[] {
  return array(value).flatMap((entry) => {
    const item = record(entry);
    if (!item) return [];
    return [{
      name: text(item.name),
      quantity: decimal(item.quantity),
      priceKopecks: integer(item.priceKopecks),
      sumKopecks: integer(item.sumKopecks),
    }];
  });
}

export function normalizePlatformaOfdReceipt(value: unknown): OfdReceipt | null {
  const source = record(value);
  const fiscal = record(source?.fiscal);
  const kkt = record(source?.kkt);
  const money = record(source?.money);
  if (!source || !fiscal || !kkt || !money) return null;
  const fiscalDriveNumber = text(fiscal.driveNumber);
  const fiscalDocumentNumber = text(fiscal.documentNumber);
  const fiscalSign = text(fiscal.sign);
  const receiptAt = text(source.receiptAt);
  const kktRegistrationNumber = text(kkt.registrationNumber);
  if (!fiscalDriveNumber || !fiscalDocumentNumber || !fiscalSign || !receiptAt || !kktRegistrationNumber) return null;
  return {
    fiscalDriveNumber,
    fiscalDocumentNumber,
    fiscalSign,
    operationType: integer(source.operationType),
    receiptAt,
    kktRegistrationNumber,
    totalKopecks: integer(money.totalKopecks),
    electronicKopecks: integer(money.electronicKopecks),
    items: normalizeItems(source.items),
  };
}

export function normalizePlatformaOfdZReport(value: unknown, expectedKktRegistrationNumber = ''): NormalizedPlatformaOfdZReport | null {
  const source = record(value);
  const kkt = record(source?.kkt);
  if (!source || !kkt) return null;
  const kktRegistrationNumber = text(kkt.registrationNumber) || expectedKktRegistrationNumber;
  const fiscalDriveNumber = text(kkt.fiscalDriveNumber);
  const shiftNumber = text(source.shiftNumber);
  const openedAt = text(source.openedAt);
  const closedAt = text(source.closedAt);
  if (!kktRegistrationNumber || !fiscalDriveNumber || !shiftNumber || !openedAt || !closedAt) return null;
  if (!Number.isFinite(Date.parse(openedAt)) || !Number.isFinite(Date.parse(closedAt))) return null;
  return { kktRegistrationNumber, fiscalDriveNumber, shiftNumber, openedAt, closedAt, documentLink: text(source.documentLink) };
}
