import 'server-only';

import { exportSabyOfdReceipts } from '@/lib/saby-ofd';

type JsonRecord = Record<string, unknown>;

export type AusnOfdReceipt = {
  fiscalDocumentNumber: string;
  fiscalDriveNumber: string;
  fiscalSign: string;
  kktRegistrationNumber: string;
  date: string;
  operationType: number;
  receiptCode: number;
  amountUnit: 'RUB';
  totalSum: number;
  cashTotalSum: number;
  ecashTotalSum: number;
  creditSum: number;
  prepaidSum: number;
  items: unknown[];
  sources: Array<'saby' | 'platforma_ofd'>;
};

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function rows(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function integer(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function rublesFromKopecks(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed / 100 : 0;
}

function canonicalNumeric(value: unknown) {
  const raw = text(value);
  return raw ? raw.replace(/^0+(?=\d)/, '') : '';
}

export function fiscalKey(receipt: Pick<AusnOfdReceipt, 'fiscalDriveNumber' | 'fiscalDocumentNumber' | 'fiscalSign'>) {
  const fn = canonicalNumeric(receipt.fiscalDriveNumber);
  const fd = canonicalNumeric(receipt.fiscalDocumentNumber);
  const fp = canonicalNumeric(receipt.fiscalSign);
  return fn && fd && fp ? `${fn}:${fd}:${fp}` : '';
}

function normalizeSabyReceipt(value: unknown): AusnOfdReceipt | null {
  const source = record(value);
  if (!source) return null;
  const receipt: AusnOfdReceipt = {
    fiscalDocumentNumber: text(source.fiscalDocumentNumber),
    fiscalDriveNumber: text(source.fiscalDriveNumber),
    fiscalSign: text(source.fiscalSign),
    kktRegistrationNumber: text(source.kktRegistrationNumber),
    date: text(source.date),
    operationType: integer(source.operationType),
    receiptCode: integer(source.receiptCode),
    amountUnit: 'RUB',
    totalSum: Number(source.totalSum) || 0,
    cashTotalSum: Number(source.cashTotalSum) || 0,
    ecashTotalSum: Number(source.ecashTotalSum) || 0,
    creditSum: Number(source.creditSum) || 0,
    prepaidSum: Number(source.prepaidSum) || 0,
    items: rows(source.items),
    sources: ['saby'],
  };
  return fiscalKey(receipt) && receipt.kktRegistrationNumber && receipt.date ? receipt : null;
}

export function normalizePlatformaReceipt(value: unknown): AusnOfdReceipt | null {
  const source = record(value);
  const fiscal = record(source?.fiscal);
  const kkt = record(source?.kkt);
  const money = record(source?.money);
  if (!source || !fiscal || !kkt || !money) return null;
  const receipt: AusnOfdReceipt = {
    fiscalDocumentNumber: text(fiscal.documentNumber),
    fiscalDriveNumber: text(fiscal.driveNumber),
    fiscalSign: text(fiscal.sign),
    kktRegistrationNumber: text(kkt.registrationNumber),
    date: text(source.receiptAt),
    operationType: integer(source.operationType),
    receiptCode: integer(source.receiptCode),
    amountUnit: 'RUB',
    totalSum: rublesFromKopecks(money.totalKopecks),
    cashTotalSum: rublesFromKopecks(money.cashKopecks),
    ecashTotalSum: rublesFromKopecks(money.electronicKopecks),
    creditSum: rublesFromKopecks(money.creditKopecks),
    prepaidSum: rublesFromKopecks(money.prepaidKopecks),
    items: rows(source.items),
    sources: ['platforma_ofd'],
  };
  return fiscalKey(receipt) && receipt.kktRegistrationNumber && receipt.date ? receipt : null;
}

function comparable(receipt: AusnOfdReceipt) {
  return JSON.stringify({
    kkt: canonicalNumeric(receipt.kktRegistrationNumber),
    operationType: receipt.operationType,
    receiptCode: receipt.receiptCode,
    totalSum: receipt.totalSum,
    cashTotalSum: receipt.cashTotalSum,
    ecashTotalSum: receipt.ecashTotalSum,
    creditSum: receipt.creditSum,
    prepaidSum: receipt.prepaidSum,
  });
}

export function mergeOfdReceipts(saby: AusnOfdReceipt[], platforma: AusnOfdReceipt[]) {
  const merged = new Map<string, AusnOfdReceipt>();
  const conflicts: string[] = [];
  let duplicateCount = 0;
  for (const receipt of [...saby, ...platforma]) {
    const key = fiscalKey(receipt);
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, receipt);
      continue;
    }
    if (comparable(previous) !== comparable(receipt)) {
      conflicts.push(key);
      continue;
    }
    duplicateCount += 1;
    previous.sources = [...new Set([...previous.sources, ...receipt.sources])];
    if (!previous.items.length && receipt.items.length) previous.items = receipt.items;
  }
  return {
    receipts: [...merged.values()].sort((a, b) => a.date.localeCompare(b.date) || fiscalKey(a).localeCompare(fiscalKey(b))),
    duplicateCount,
    conflicts,
  };
}

async function getJson(url: string) {
  const response = await fetch(url, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => null);
  return { response, body: record(body) };
}

function nextDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function loadPlatforma(dateFrom: string, dateTo: string) {
  const baseUrl = process.env.PLATFORMA_OFD_PROXY_BASE_URL?.trim().replace(/\/+$/, '');
  if (!baseUrl) return { complete: false, receipts: [] as AusnOfdReceipt[], errors: ['Platforma OFD proxy is not configured'], kkts: 0 };
  const list = await getJson(`${baseUrl}/api/v1/ofd/platforma/kkts`);
  const kktRoot = record(list.body?.data);
  const kkts = rows(kktRoot?.kkts);
  if (!list.response.ok || !list.body || kkts.length === 0) {
    return { complete: false, receipts: [] as AusnOfdReceipt[], errors: ['Platforma OFD KKT list failed'], kkts: 0 };
  }
  const output: AusnOfdReceipt[] = [];
  const errors: string[] = [];
  for (const rawKkt of kkts) {
    const kkt = record(rawKkt);
    const registrationNumber = text(kkt?.registrationNumber);
    if (!registrationNumber) { errors.push('Platforma OFD KKT has no registration number'); continue; }
    const query = new URLSearchParams({
      kktRegNumber: registrationNumber,
      from: `${dateFrom}T00:00:00+03:00`,
      to: `${nextDay(dateTo)}T00:00:00+03:00`,
    });
    const result = await getJson(`${baseUrl}/api/v1/ofd/platforma/receipts?${query}`);
    const data = record(result.body?.data);
    const meta = record(result.body?.meta);
    const sourceRows = rows(data?.receipts);
    const normalized = sourceRows.map(normalizePlatformaReceipt).filter(Boolean) as AusnOfdReceipt[];
    if (!result.response.ok || meta?.complete !== true || normalized.length !== sourceRows.length) {
      errors.push(`Platforma OFD receipt export incomplete for KKT …${registrationNumber.slice(-4)}`);
    }
    output.push(...normalized);
  }
  return { complete: errors.length === 0, receipts: output, errors, kkts: kkts.length };
}

export async function exportUnifiedAusnOfdReceipts(options: {
  organizationInn: string;
  dateFrom: string;
  dateTo: string;
  queryLimit?: number;
  maxDocuments?: number;
}) {
  const [sabyResult, platformaResult] = await Promise.all([
    exportSabyOfdReceipts(options),
    loadPlatforma(options.dateFrom, options.dateTo),
  ]);
  const sabyRows = rows(sabyResult.receipts);
  const sabyReceipts = sabyRows.map(normalizeSabyReceipt).filter(Boolean) as AusnOfdReceipt[];
  const sabyComplete = record(sabyResult.completeness)?.complete === true && sabyReceipts.length === sabyRows.length;
  const merged = mergeOfdReceipts(sabyReceipts, platformaResult.receipts);
  const complete = sabyComplete && platformaResult.complete && merged.conflicts.length === 0;
  return {
    ok: complete,
    checkedAt: new Date().toISOString(),
    source: 'unified_ofd',
    period: { dateFrom: options.dateFrom, dateTo: options.dateTo },
    completeness: {
      complete,
      exportedReceipts: merged.receipts.length,
      duplicateDocuments: merged.duplicateCount,
      conflictingDocuments: merged.conflicts.length,
      sources: {
        saby: { complete: sabyComplete, receipts: sabyReceipts.length },
        platforma_ofd: { complete: platformaResult.complete, receipts: platformaResult.receipts.length, kkts: platformaResult.kkts },
      },
    },
    receipts: merged.receipts,
    errors: [...rows(sabyResult.errors).map(String), ...platformaResult.errors, ...(merged.conflicts.length ? ['Conflicting OFD fiscal keys detected'] : [])],
  };
}
