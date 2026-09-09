import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { getPayrollSalesReport } from '@/lib/one-c';
import { getPayrollOneCCloseState, getPayrollPurchaseAttribution } from '@/lib/payroll-one-c-control-source';
import {
  aggregatePayrollOneCControlSlices,
  getPayrollOneCReportedCloseDate,
  getPayrollOneCRefreshDates,
  isPayrollOneCControlSlice,
  listDates,
  PAYROLL_ONE_C_ROLLING_DAYS,
  PAYROLL_ONE_C_SNAPSHOT_VERSION,
  type PayrollOneCControlSlice,
} from '@/lib/payroll-one-c-control-snapshots';
import { buildPayrollOneCPreview } from '@/lib/payroll-one-c';
import {
  createPayrollOneCControlAggregate,
  getPayrollOneCAggregateKind,
  getPayrollOneCSourceFingerprint,
  getPayrollOneCSupplierRulesFingerprint,
  PAYROLL_ONE_C_AGGREGATE_VERSION,
  readPayrollOneCControlAggregate,
  type PayrollOneCAggregateSourceKind,
} from '@/lib/payroll-one-c-control-aggregate';
import { buildPayrollPurchaseSupplierPreview } from '@/lib/payroll-purchase-suppliers';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function getMoscowToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isValidPeriod(year: number, monthIndex: number) {
  return Number.isInteger(year) && year >= 2020 && year <= 2100
    && Number.isInteger(monthIndex) && monthIndex >= 0 && monthIndex <= 11;
}

function previousDate(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function readPeriod(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const year = Number(searchParams.get('year'));
  const monthIndex = Number(searchParams.get('month'));
  if (!isValidPeriod(year, monthIndex)) return null;
  const today = getMoscowToday();
  const periodKey = `${year}-${pad(monthIndex + 1)}`;
  if (periodKey > today.slice(0, 7)) return null;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return {
    today,
    periodKey,
    dateFrom: `${periodKey}-01`,
    lastDate: `${periodKey}-${pad(lastDay)}`,
    currentPeriod: periodKey === today.slice(0, 7),
    force: searchParams.get('force') === '1',
  };
}

async function resolveClose(period: NonNullable<ReturnType<typeof readPeriod>>) {
  const candidateDate = period.currentPeriod ? period.today : period.lastDate;
  let close = await getPayrollOneCCloseState(candidateDate, { requireExecutionDate: period.currentPeriod });
  let verifiedThrough = candidateDate;
  let usingPreviousClose = false;
  if (period.currentPeriod && (!close.ok || !close.data?.ready)) {
    const reportedExecutionDate = getPayrollOneCReportedCloseDate(period.periodKey, candidateDate, close.data?.executionDate);
    if (reportedExecutionDate) {
      const reportedClose = await getPayrollOneCCloseState(reportedExecutionDate, { requireExecutionDate: true });
      if (reportedClose.ok && reportedClose.data?.ready) {
        return { close: reportedClose, candidateDate, verifiedThrough: reportedExecutionDate, usingPreviousClose: true };
      }
    }
    const fallbackDate = previousDate(candidateDate);
    if (fallbackDate.startsWith(period.periodKey)) {
      const fallback = await getPayrollOneCCloseState(fallbackDate, { requireExecutionDate: true });
      if (fallback.ok && fallback.data?.ready) {
        close = fallback;
        verifiedThrough = fallbackDate;
        usingPreviousClose = true;
      }
    }
  }
  return { close, candidateDate, verifiedThrough, usingPreviousClose };
}

async function readSourceSlice(dateFrom: string, dateTo: string, close: NonNullable<Awaited<ReturnType<typeof getPayrollOneCCloseState>>['data']>) {
  const [salesSource, purchaseSource] = await Promise.all([
    getPayrollSalesReport({ dateFrom, dateTo, pageSize: 1000, maxPages: 100 }),
    getPayrollPurchaseAttribution(dateFrom, dateTo),
  ]);
  if (!salesSource.ok || !purchaseSource.ok || !purchaseSource.data) {
    throw new Error(salesSource.ok ? purchaseSource.error : salesSource.error);
  }
  const sales = buildPayrollOneCPreview(salesSource.rows);
  return {
    version: PAYROLL_ONE_C_SNAPSHOT_VERSION,
    dateFrom,
    dateTo,
    close,
    source: {
      contractVersion: salesSource.contractVersion,
      checkedAt: salesSource.checkedAt,
      extractedAt: salesSource.extractedAt,
      pages: salesSource.pages,
    },
    sales: {
      summary: sales.summary,
      managerKeys: Array.from(new Set(sales.rows.map((row) => row.managerRef || row.manager))).sort(),
      rows: sales.rows,
    },
    purchases: purchaseSource.data,
  } satisfies PayrollOneCControlSlice;
}

async function mapWithLimit<T, R>(values: T[], limit: number, task: (value: T) => Promise<R>) {
  const results = new Array<R>(values.length);
  let index = 0;
  async function worker() {
    while (index < values.length) {
      const current = index++;
      results[current] = await task(values[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => worker()));
  return results;
}

function hashPayload(payload: PayrollOneCControlSlice) {
  return createHash('sha256').update(JSON.stringify({
    version: payload.version,
    dateFrom: payload.dateFrom,
    dateTo: payload.dateTo,
    close: payload.close,
    sourceContractVersion: payload.source.contractVersion,
    sales: payload.sales,
    purchases: payload.purchases,
  })).digest('hex');
}

type StoredSnapshot = {
  periodKey: string;
  kind: string;
  dateFrom: string;
  dateTo: string;
  payload: Prisma.JsonValue;
  contentHash: string;
  revision: number;
  updatedAt: Date;
};

type ControlResponse = ReturnType<typeof buildControlResponse>;

function isControlResponse(value: unknown): value is ControlResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const response = value as Partial<ControlResponse>;
  return response.ok === true
    && response.mode === 'control'
    && response.affectsPayroll === false
    && typeof response.period?.periodKey === 'string'
    && typeof response.period?.verifiedThrough === 'string'
    && Array.isArray(response.sales?.rows)
    && Array.isArray(response.purchases?.rows)
    && Array.isArray(response.blockingIssues);
}

function buildControlResponse(
  period: NonNullable<ReturnType<typeof readPeriod>>,
  rows: StoredSnapshot[],
  supplierRules: Awaited<ReturnType<typeof prisma.payrollPurchaseSupplierRule.findMany>>,
  options: { refreshedDates?: string[]; servedFrom: 'stored' | 'refreshed'; usingPreviousClose?: boolean },
) {
  const slices = rows.map((row) => row.payload).filter(isPayrollOneCControlSlice);
  if (slices.length !== rows.length || !slices.length) throw new Error('Сохранённый снимок 1С повреждён; нужна полная перепроверка.');
  const combined = aggregatePayrollOneCControlSlices(slices);
  const purchases = buildPayrollPurchaseSupplierPreview(combined.purchases.settlements, supplierRules);
  const blockingIssues = [
    combined.sales.summary.missingManagerRows ? `Не определён менеджер: ${combined.sales.summary.missingManagerRows} строк.` : '',
    combined.sales.summary.missingCustomerRows ? `Не определён покупатель: ${combined.sales.summary.missingCustomerRows} строк.` : '',
    combined.sales.summary.missingProductRows ? `Не определён товар: ${combined.sales.summary.missingProductRows} строк.` : '',
    combined.purchases.reviewDocumentCount
      ? `Нужно проверить ответственных в ${combined.purchases.reviewDocumentCount} документах закупок Астемира.` : '',
    purchases.newSupplierCount ? `Нужно решить, учитывать ли ${purchases.newSupplierCount} новых поставщиков Астемира.` : '',
  ].filter(Boolean);
  const latestUpdatedAt = rows.reduce((latest, row) => row.updatedAt > latest ? row.updatedAt : latest, rows[0].updatedAt);
  const final = rows.length === 1 && rows[0].kind === 'FINAL';
  return {
    ok: true,
    mode: 'control',
    affectsPayroll: false,
    readyForControl: blockingIssues.length === 0,
    period: {
      periodKey: period.periodKey,
      dateFrom: combined.period.dateFrom,
      verifiedThrough: combined.period.verifiedThrough,
      candidateDate: period.currentPeriod ? period.today : period.lastDate,
      usingPreviousClose: options.usingPreviousClose ?? (period.currentPeriod && combined.period.verifiedThrough < period.today),
    },
    close: combined.close,
    source: combined.source,
    sales: combined.sales,
    purchases: {
      ...purchases,
      attribution: {
        contractVersion: combined.purchases.contractVersion,
        employeeName: combined.purchases.employeeName,
        documentCount: combined.purchases.documentCount,
        reviewDocumentCount: combined.purchases.reviewDocumentCount,
        ignoredOtherDocumentCount: combined.purchases.ignoredOtherDocumentCount,
      },
    },
    snapshot: {
      storage: 'server',
      servedFrom: options.servedFrom,
      kind: final ? 'FINAL' : 'DAILY',
      rollingDays: PAYROLL_ONE_C_ROLLING_DAYS,
      storedThrough: combined.period.verifiedThrough,
      storedAt: latestUpdatedAt.toISOString(),
      refreshedDates: options.refreshedDates ?? [],
      finalReconciled: final,
    },
    blockingIssues,
  };
}

async function loadStored(period: NonNullable<ReturnType<typeof readPeriod>>) {
  const kind = period.currentPeriod ? 'DAILY' : 'FINAL';
  return prisma.payrollOneCControlSnapshot.findMany({
    where: { periodKey: period.periodKey, kind },
    orderBy: [{ dateFrom: 'asc' }, { dateTo: 'asc' }],
  });
}

function getSourceKind(period: NonNullable<ReturnType<typeof readPeriod>>): PayrollOneCAggregateSourceKind {
  return period.currentPeriod ? 'DAILY' : 'FINAL';
}

function aggregateSnapshotKey(
  period: NonNullable<ReturnType<typeof readPeriod>>,
  sourceKind = getSourceKind(period),
) {
  return {
    periodKey: period.periodKey,
    kind: getPayrollOneCAggregateKind(sourceKind),
    dateFrom: period.dateFrom,
    dateTo: period.lastDate,
  };
}

function asStoredResponse(response: ControlResponse): ControlResponse {
  return {
    ...response,
    snapshot: {
      ...response.snapshot,
      servedFrom: 'stored',
      refreshedDates: [],
    },
  };
}

async function loadAggregateResponse(
  period: NonNullable<ReturnType<typeof readPeriod>>,
  supplierRules: Awaited<ReturnType<typeof prisma.payrollPurchaseSupplierRule.findMany>>,
) {
  const sourceKind = getSourceKind(period);
  const key = aggregateSnapshotKey(period, sourceKind);
  const row = await prisma.payrollOneCControlSnapshot.findUnique({
    where: { periodKey_kind_dateFrom_dateTo: key },
    select: { payload: true },
  });
  const envelope = readPayrollOneCControlAggregate(
    row?.payload,
    {
      periodKey: period.periodKey,
      sourceKind,
      supplierRulesFingerprint: getPayrollOneCSupplierRulesFingerprint(supplierRules),
    },
    (response): response is ControlResponse => isControlResponse(response)
      && response.period.periodKey === period.periodKey
      && response.period.verifiedThrough.startsWith(`${period.periodKey}-`)
      && response.snapshot.kind === sourceKind,
  );
  return envelope ? asStoredResponse(envelope.response) : null;
}

function buildAggregateWrite(
  period: NonNullable<ReturnType<typeof readPeriod>>,
  rows: StoredSnapshot[],
  supplierRules: Awaited<ReturnType<typeof prisma.payrollPurchaseSupplierRule.findMany>>,
  response: ControlResponse,
  existing: { contentHash: string; revision: number } | null,
) {
  const sourceKind = getSourceKind(period);
  const key = aggregateSnapshotKey(period, sourceKind);
  const sourceFingerprint = getPayrollOneCSourceFingerprint(rows);
  const supplierRulesFingerprint = getPayrollOneCSupplierRulesFingerprint(supplierRules);
  const contentHash = createHash('sha256')
    .update(`${sourceFingerprint}:${supplierRulesFingerprint}`)
    .digest('hex');
  const revision = existing && existing.contentHash !== contentHash ? existing.revision + 1 : existing?.revision ?? 1;
  const payload = createPayrollOneCControlAggregate({
    periodKey: period.periodKey,
    sourceKind,
    sourceFingerprint,
    supplierRulesFingerprint,
    response,
  }) as unknown as Prisma.InputJsonValue;
  const sourceCheckedAt = new Date(response.source.checkedAt);
  return prisma.payrollOneCControlSnapshot.upsert({
    where: { periodKey_kind_dateFrom_dateTo: key },
    create: {
      ...key,
      payloadVersion: PAYROLL_ONE_C_AGGREGATE_VERSION,
      payload,
      contentHash,
      revision,
      sourceCheckedAt,
    },
    update: {
      payloadVersion: PAYROLL_ONE_C_AGGREGATE_VERSION,
      payload,
      contentHash,
      revision,
      sourceCheckedAt,
    },
  });
}

export async function GET(request: Request) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const period = readPeriod(request);
  if (!period) return Response.json({ error: 'Не выбран корректный период.' }, { status: 400 });
  const supplierRules = await prisma.payrollPurchaseSupplierRule.findMany({ orderBy: [{ isActive: 'desc' }, { supplierName: 'asc' }] });
  const aggregate = await loadAggregateResponse(period, supplierRules);
  if (aggregate) return Response.json(aggregate);
  const rows = await loadStored(period);
  if (!rows.length) return Response.json({ ok: false, error: 'Серверный снимок ещё не создан.' }, { status: 404 });
  try {
    const response = buildControlResponse(period, rows, supplierRules, { servedFrom: 'stored' });
    const key = aggregateSnapshotKey(period);
    const existing = await prisma.payrollOneCControlSnapshot.findUnique({
      where: { periodKey_kind_dateFrom_dateTo: key },
      select: { contentHash: true, revision: true },
    });
    try {
      await buildAggregateWrite(period, rows, supplierRules, response, existing);
    } catch (cacheError) {
      console.error('Failed to warm payroll 1C aggregate snapshot', cacheError);
    }
    return Response.json(response);
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : 'Снимок 1С не читается.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const period = readPeriod(request);
  if (!period) return Response.json({ error: 'Не выбран корректный период.' }, { status: 400 });

  const supplierRulesBefore = await prisma.payrollPurchaseSupplierRule.findMany({ orderBy: [{ isActive: 'desc' }, { supplierName: 'asc' }] });
  if (!period.currentPeriod && !period.force) {
    const aggregate = await loadAggregateResponse(period, supplierRulesBefore);
    if (aggregate) return Response.json(aggregate);
  }
  const storedBefore = await loadStored(period);
  if (!period.currentPeriod && storedBefore.length && !period.force) {
    try {
      const response = buildControlResponse(period, storedBefore, supplierRulesBefore, { servedFrom: 'stored' });
      const key = aggregateSnapshotKey(period);
      const existing = await prisma.payrollOneCControlSnapshot.findUnique({
        where: { periodKey_kind_dateFrom_dateTo: key },
        select: { contentHash: true, revision: true },
      });
      try {
        await buildAggregateWrite(period, storedBefore, supplierRulesBefore, response, existing);
      } catch (cacheError) {
        console.error('Failed to warm payroll 1C aggregate snapshot', cacheError);
      }
      return Response.json(response);
    } catch {
      // A malformed or obsolete final snapshot must be rebuilt from 1C rather
      // than returned as a zero/partial control result.
    }
  }

  const { close, candidateDate, verifiedThrough, usingPreviousClose } = await resolveClose(period);
  if (!close.ok || !close.data?.ready) {
    return Response.json({
      ok: false,
      mode: 'control',
      affectsPayroll: false,
      period: { periodKey: period.periodKey, dateFrom: period.dateFrom, candidateDate },
      error: close.error ?? 'Закрытие себестоимости за выбранную дату ещё не подтверждено.',
      blockingIssues: close.data?.blockingIssues ?? [],
      checkedAt: close.checkedAt,
    }, { status: 503 });
  }

  try {
    const final = !period.currentPeriod;
    const existingDates = storedBefore.map((row) => row.dateTo);
    const refreshDates = final
      ? [verifiedThrough]
      : period.force
        ? listDates(period.dateFrom, verifiedThrough)
        : getPayrollOneCRefreshDates(period.periodKey, verifiedThrough, existingDates);
    const slices = final
      ? [await readSourceSlice(period.dateFrom, verifiedThrough, close.data)]
      : await mapWithLimit(refreshDates, 3, (date) => readSourceSlice(date, date, close.data!));
    const existingByKey = new Map(storedBefore.map((row) => [`${row.kind}|${row.dateFrom}|${row.dateTo}`, row]));
    const refreshedAt = new Date();
    const nextRowsByKey = new Map<string, StoredSnapshot>(
      storedBefore.map((row) => [`${row.kind}|${row.dateFrom}|${row.dateTo}`, row]),
    );
    const snapshotWrites = slices.map((slice) => {
      const kind = final ? 'FINAL' : 'DAILY';
      const key = `${kind}|${slice.dateFrom}|${slice.dateTo}`;
      const existing = existingByKey.get(key);
      const contentHash = hashPayload(slice);
      const revision = existing && existing.contentHash !== contentHash ? existing.revision + 1 : existing?.revision ?? 1;
      const payload = slice as unknown as Prisma.InputJsonValue;
      nextRowsByKey.set(key, {
        periodKey: period.periodKey,
        kind,
        dateFrom: slice.dateFrom,
        dateTo: slice.dateTo,
        payload: slice as unknown as Prisma.JsonValue,
        contentHash,
        revision,
        updatedAt: refreshedAt,
      });
      return prisma.payrollOneCControlSnapshot.upsert({
        where: { periodKey_kind_dateFrom_dateTo: { periodKey: period.periodKey, kind, dateFrom: slice.dateFrom, dateTo: slice.dateTo } },
        create: {
          periodKey: period.periodKey, kind, dateFrom: slice.dateFrom, dateTo: slice.dateTo,
          payloadVersion: PAYROLL_ONE_C_SNAPSHOT_VERSION, payload, contentHash, revision,
          sourceCheckedAt: new Date(slice.source.checkedAt),
        },
        update: {
          payloadVersion: PAYROLL_ONE_C_SNAPSHOT_VERSION, payload, contentHash, revision,
          sourceCheckedAt: new Date(slice.source.checkedAt),
        },
      });
    });
    const rows = Array.from(nextRowsByKey.values())
      .filter((row) => row.kind === getSourceKind(period))
      .sort((left, right) => left.dateFrom.localeCompare(right.dateFrom) || left.dateTo.localeCompare(right.dateTo));
    const response = buildControlResponse(period, rows, supplierRulesBefore, {
      servedFrom: 'refreshed', refreshedDates: refreshDates, usingPreviousClose,
    });
    const aggregateKey = aggregateSnapshotKey(period);
    const existingAggregate = await prisma.payrollOneCControlSnapshot.findUnique({
      where: { periodKey_kind_dateFrom_dateTo: aggregateKey },
      select: { contentHash: true, revision: true },
    });
    await prisma.$transaction([
      ...snapshotWrites,
      buildAggregateWrite(period, rows, supplierRulesBefore, response, existingAggregate),
    ]);
    return Response.json(response);
  } catch (error) {
    return Response.json({
      ok: false,
      mode: 'control',
      affectsPayroll: false,
      error: error instanceof Error ? error.message : 'Не удалось обновить серверный снимок 1С.',
      checkedAt: new Date().toISOString(),
    }, { status: 503 });
  }
}
