import 'server-only';

import { exportSabyOfdReceipts } from '@/lib/saby-ofd';
import { readPlatformaReceiptWindow } from './platforma-receipt-window';

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

async function getJson(url: string, signal?: AbortSignal) {
  try {
    const response = await fetch(url, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000) });
    const body = await response.json().catch(() => null);
    return { response, body: record(body) };
  } catch {
    return { response: new Response(null, { status: 503 }), body: null };
  }
}

async function getCompletePlatformaPage(url: string, signal?: AbortSignal) {
  let last = await getJson(url, signal);
  for (let attempt = 1; attempt < 3; attempt += 1) {
    if (signal?.aborted) return last;
    const meta = record(last.body?.meta);
    if (last.response.ok && meta?.complete === true) return last;
    // Repeating the same oversized window does not repair a provider timeout.
    // Let the bounded window reader split this exact range instead.
    if (last.response.status === 504 && record(last.body?.error)?.code === 'OFD_PROVIDER_TIMEOUT'
      && record(last.body?.error)?.retryable === true) return last;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    last = await getJson(url, signal);
  }
  return last;
}

function nextDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

// Read one Moscow calendar day per request. Multi-day provider queries can
// time out even when each constituent day is available and complete.
export function platformaExportWindows(dateFrom: string, dateTo: string) {
  const end = nextDay(dateTo);
  const windows: { from: string; toExclusive: string }[] = [];
  for (let from = dateFrom; from < end;) {
    const next = new Date(`${from}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const toExclusive = next.toISOString().slice(0, 10) < end ? next.toISOString().slice(0, 10) : end;
    windows.push({ from, toExclusive });
    from = toExclusive;
  }
  return windows;
}

export async function loadPlatforma(dateFrom: string, dateTo: string, signal?: AbortSignal) {
  const baseUrl = process.env.PLATFORMA_OFD_PROXY_BASE_URL?.trim().replace(/\/+$/, '');
  if (!baseUrl) return { complete: false, receipts: [] as AusnOfdReceipt[], errors: ['Platforma OFD proxy is not configured'], kkts: 0 };
  const list = await getJson(`${baseUrl}/api/v1/ofd/platforma/kkts`, signal);
  const kktRoot = record(list.body?.data);
  const kkts = rows(kktRoot?.kkts);
  if (!list.response.ok || !list.body || kkts.length === 0) {
    return { complete: false, receipts: [] as AusnOfdReceipt[], errors: ['Platforma OFD KKT list failed'], kkts: 0 };
  }
  const errors: string[] = [];
  const windows = platformaExportWindows(dateFrom, dateTo);
  const jobs: { registrationNumber: string; from: string; toExclusive: string }[] = [];
  for (const rawKkt of kkts) {
    const registrationNumber = text(record(rawKkt)?.registrationNumber);
    if (!registrationNumber) { errors.push('Platforma OFD KKT has no registration number'); continue; }
    for (const window of windows) jobs.push({ registrationNumber, ...window });
  }
  if (!windows.length) errors.push('Platforma OFD period is empty');
  const results: { receipts: AusnOfdReceipt[]; error?: string }[] = new Array(jobs.length);
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length && !signal?.aborted) {
      const index = cursor++;
      const job = jobs[index];
      const { receipts, complete } = await readPlatformaReceiptWindow({
        from: `${job.from}T00:00:00+03:00`, toExclusive: `${job.toExclusive}T00:00:00+03:00`,
        read: async (from, to) => {
          const query = new URLSearchParams({ kktRegNumber: job.registrationNumber, from, to });
          const result = await getCompletePlatformaPage(`${baseUrl}/api/v1/ofd/platforma/receipts?${query}`, signal);
          const receiptRows = record(result.body?.data)?.receipts;
          const sourceRows = rows(receiptRows);
          const normalized = sourceRows.map(normalizePlatformaReceipt).filter(Boolean) as AusnOfdReceipt[];
          return { receipts: normalized,
            complete: result.response.ok && record(result.body?.meta)?.complete === true && Array.isArray(receiptRows) && normalized.length === sourceRows.length,
            providerTimeout: result.response.status === 504 && record(result.body?.error)?.code === 'OFD_PROVIDER_TIMEOUT' && record(result.body?.error)?.retryable === true };
        },
      });
      results[index] = { receipts, ...(!complete ? { error: `Platforma OFD receipt export incomplete for KKT …${job.registrationNumber.slice(-4)} (${job.from}–${job.toExclusive})` } : {}) };
    }
  }
  // Two requests bound upstream load; output order remains KKT/window order.
  await Promise.all(Array.from({ length: Math.min(2, jobs.length) }, worker));
  errors.push(...results.flatMap(result => result.error ? [result.error] : []));
  if (signal?.aborted) errors.push('Platforma OFD export cancelled; the requested period is incomplete');
  return { complete: errors.length === 0, receipts: results.flatMap(result => result.receipts), errors, kkts: kkts.length };
}

// Closed historical source: the saved 2026-10-31 Saby audit contains
// no receipts/corrections in September–October; owner confirmed on 2026-11-04
// that all new payments use Platforma. August remains included conservatively.
export function sabyExportPeriod(dateFrom: string, dateTo: string) {
  const lastHistoricalDay = '2026-08-31';
  return dateFrom > lastHistoricalDay ? null : { dateFrom, dateTo: dateTo < lastHistoricalDay ? dateTo : lastHistoricalDay };
}

export async function exportUnifiedAusnOfdReceipts(options: {
  organizationInn: string;
  dateFrom: string;
  dateTo: string;
  queryLimit?: number;
  maxDocuments?: number;
  signal?: AbortSignal;
}) {
  const sabyPeriod = sabyExportPeriod(options.dateFrom, options.dateTo);
  const [sabyResult, platformaResult] = await Promise.all([
    sabyPeriod ? exportSabyOfdReceipts({ ...options, ...sabyPeriod }).catch(() => ({ ok: false, receipts: [], completeness: { complete: false }, errors: ['Saby OFD export did not complete'] })) : Promise.resolve({ ok: true, receipts: [], completeness: { complete: true }, errors: [] }),
    loadPlatforma(options.dateFrom, options.dateTo, options.signal),
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
        saby: { complete: sabyComplete, receipts: sabyReceipts.length, required: Boolean(sabyPeriod), ...(sabyPeriod ? { period: sabyPeriod } : { scope: 'historical_only_through_2026-08-31' }) },
        platforma_ofd: { complete: platformaResult.complete, receipts: platformaResult.receipts.length, kkts: platformaResult.kkts },
      },
    },
    receipts: merged.receipts,
    errors: [...rows(sabyResult.errors).map(String), ...platformaResult.errors, ...(merged.conflicts.length ? ['Conflicting OFD fiscal keys detected'] : [])],
  };
}
