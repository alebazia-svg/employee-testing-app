import 'server-only';
import { readOneCRuntimeEnv } from '@/lib/one-c-env';
import { normalizeOneCDateTime as normalizeOneCDateTimeValue } from '@/lib/one-c-date';

type OneCConfig = {
  baseUrl: string;
  user: string;
  password: string;
  timeoutMs: number;
  cacheTtlSeconds: number;
};

type OneCEndpoint = 'ping' | 'version' | 'info';

type SalesRealizationsParams = {
  dateFrom: string;
  dateTo: string;
  customerRef: string;
  posted: 'true' | 'false' | 'all';
  limit: number;
  offset: number;
  includeLines: boolean;
};

export type PayrollSalesFactsParams = {
  dateFrom: string;
  dateTo: string;
  pageSize?: number;
  maxPages?: number;
};

export type OneCPayrollSalesFact = {
  period: string;
  recorderRef: string;
  recorderName: string;
  recorderType: string;
  lineNumber: number | null;
  managerRef: string;
  managerName: string;
  customerRef: string;
  customerName: string;
  organizationRef: string;
  organizationName: string;
  warehouseRef: string;
  warehouseName: string;
  productRef: string;
  productCode: string;
  productArticle: string;
  productName: string;
  productKindRef: string;
  productKindName: string;
  productCategoryRef: string;
  productCategoryName: string;
  characteristicRef: string;
  characteristicName: string;
  quantity: number;
  revenue: number;
  baseCost: number;
  additionalExpenses: number;
  cost: number;
  grossProfit: number;
  vatAmount: number;
  costReviewRequired: boolean;
  reportCost: number;
  reportGrossProfit: number;
  costCalculationPending: boolean;
};

export type OneCPayrollSalesFactsResult = {
  ok: boolean;
  path: '/payroll-sales-facts';
  checkedAt: string;
  params: Required<PayrollSalesFactsParams>;
  contractVersion: string;
  extractedAt: string;
  periodComplete: boolean;
  pages: number;
  rows: OneCPayrollSalesFact[];
  diagnostics: string[];
  error?: string;
};

export type PayrollSalesReportParams = PayrollSalesFactsParams;

export type OneCPayrollSalesReportRow = {
  period?: string;
  recorderRef?: string;
  organizationRef?: string;
  warehouseRef?: string;
  productCategoryRef?: string;
  productCategoryName?: string;
  costReviewRequired?: boolean;
  costCalculationPending?: boolean;
  managerRef: string;
  managerName: string;
  customerRef: string;
  customerName: string;
  productRef: string;
  productCode: string;
  productArticle: string;
  productName: string;
  productKindRef: string;
  productKindName: string;
  characteristicRef: string;
  characteristicName: string;
  quantity: number;
  revenue: number;
  cost: number;
  grossProfit: number;
};

export type OneCPayrollSalesReportResult = {
  ok: boolean;
  path: '/payroll-sales-facts';
  checkedAt: string;
  params: Required<PayrollSalesReportParams>;
  contractVersion: string;
  extractedAt: string;
  periodComplete: boolean;
  pages: number;
  rows: OneCPayrollSalesReportRow[];
  diagnostics: string[];
  error?: string;
};

export type OneCEndpointResult = {
  ok: boolean;
  path: `/${OneCEndpoint}`;
  status?: number;
  durationMs: number;
  data: unknown;
  error?: string;
};

export type OneCHealthResult = {
  ok: boolean;
  checkedAt: string;
  baseUrlConfigured: boolean;
  timeoutMs: number;
  cacheTtlSeconds: number;
  cached: boolean;
  endpoints: Record<OneCEndpoint, OneCEndpointResult>;
  environment: unknown;
  errors: string[];
};

export type OneCSalesRealizationLine = {
  lineNumber: string;
  productCode: string;
  productName: string;
  productKindName: string;
  productArticle: string;
  quantity: number | null;
  price: number | null;
  amount: number | null;
  vatRate: string;
};

export type OneCSalesRealizationDocument = {
  ref: string;
  number: string;
  date: string;
  posted: boolean | null;
  deletionMark: boolean | null;
  amount: number | null;
  currency: string;
  organizationName: string;
  organizationRef: string;
  organizationInn: string;
  partnerName: string;
  partnerRef: string;
  counterpartyName: string;
  counterpartyRef: string;
  warehouseName: string;
  managerName: string;
  managerRef: string;
  managerSource: string;
  responsibleName: string;
  responsibleSource: string;
  additionalManagerName: string;
  comment: string;
  lines: OneCSalesRealizationLine[];
};

export type OneCSalesRealizationsResult = {
  ok: boolean;
  path: '/sales-realizations';
  status?: number;
  durationMs: number;
  checkedAt: string;
  params: SalesRealizationsParams;
  documents: OneCSalesRealizationDocument[];
  totalDocuments: number | null;
  totalAmount: number | null;
  hasMore: boolean;
  responseDocumentCount: number;
  error?: string;
  diagnostics: string[];
};

export type OneCLinkedDocument = {
  documentType: string;
  matchType: string;
  matchReasons: string[];
  sourcePaths: string[];
  ref: string;
  name: string;
  number: string;
  date: string;
  posted: boolean | null;
  amount: number | null;
  organizationName: string;
  organizationRef: string;
  partnerName: string;
  partnerRef: string;
  counterpartyName: string;
  counterpartyRef: string;
  managerName: string;
  managerRef: string;
  comment: string;
};

export type OneCLinkedDocumentGroup = {
  direct: OneCLinkedDocument[];
  candidates: OneCLinkedDocument[];
};

export type OneCSalesRealizationLinks = {
  realization: OneCSalesRealizationDocument | null;
  cashReceipts: OneCLinkedDocumentGroup;
  acquiring: OneCLinkedDocumentGroup;
  bankReceipts: OneCLinkedDocumentGroup;
  paymentDocuments: OneCLinkedDocumentGroup;
  returns: OneCLinkedDocumentGroup;
  corrections: OneCLinkedDocumentGroup;
  checkedSources: Array<{
    name: string;
    matchMode: string;
    ok: boolean | null;
    count: number | null;
    errorText: string;
  }>;
  fiscalControl: {
    source: string;
    complete: boolean;
    documents: Array<{
      sourceType: string;
      documentType: string;
      documentRef: string;
      linkPath: string;
      operations: OneCSalesRealizationFiscalOperation[];
      dataState: string;
    }>;
    conflictCount: number;
    errors: string[];
  };
  completeness: {
    linksComplete: boolean;
    fiscalOperationsComplete: boolean;
    failedSources: string[];
    complete: boolean;
    absenceIsHardErrorEligible: boolean;
  };
  hardErrorEligible: boolean;
  warnings: string[];
};

export type OneCSalesRealizationLinksResult = {
  ok: boolean;
  path: '/sales-realization-links';
  status?: number;
  durationMs: number;
  checkedAt: string;
  realizationRef: string;
  links: OneCSalesRealizationLinks | null;
  error?: string;
  diagnostics: string[];
};

export type OneCSalesRealizationFiscalOperation = {
  recordId: string;
  datetime: string;
  checkNumber: string;
  shiftNumber: string;
  amount: number | null;
  documentType: string;
  calculationType: string;
  organizationName: string;
  retailLocationName: string;
  kktRegistrationNumber: string;
  fiscalDriveNumber: string;
  fiscalDocumentNumber: string;
  fiscalSign: string;
  cashPayment: number | null;
  electronicPayment: number | null;
  prepayment: number | null;
  postpayment: number | null;
  counterProvision: number | null;
  unifiedCheck: boolean | null;
  hasXmlData: boolean | null;
  fiscalized: boolean;
};

export type OneCSalesRealizationFiscalOperationsResult = {
  ok: boolean;
  path: '/sales-realization-fiscal-operations';
  status?: number;
  durationMs: number;
  checkedAt: string;
  realizationRef: string;
  found: boolean;
  fiscalized: boolean;
  operations: OneCSalesRealizationFiscalOperation[];
  error?: string;
  diagnostics: string[];
};

export type OneCCashStatementDimension = {
  name: string;
  ref: string;
  deleted: boolean | null;
};

export type OneCCashStatementDimensionsResult = {
  ok: boolean;
  path: '/cash-statement-dimensions';
  status?: number;
  durationMs: number;
  checkedAt: string;
  organizations: OneCCashStatementDimension[];
  cashboxes: OneCCashStatementDimension[];
  error?: string;
  diagnostics: string[];
};

export type OneCCashStatementMovement = {
  period: string;
  incoming: number | null;
  outgoing: number | null;
  document: {
    name: string;
    ref: string;
  };
  documentType: string;
};

export type OneCCashStatementSummaryParams = {
  date: string;
  organizationRef: string;
  cashboxRef: string;
};

export type OneCCashStatementSummaryResult = {
  ok: boolean;
  path: '/cash-statement-summary';
  status?: number;
  durationMs: number;
  checkedAt: string;
  params: OneCCashStatementSummaryParams;
  register: string;
  date: string;
  cashbox: OneCCashStatementDimension | null;
  organization: OneCCashStatementDimension | null;
  openingBalance: number | null;
  incomingTotal: number | null;
  outgoingTotal: number | null;
  closingBalance: number | null;
  movements: OneCCashStatementMovement[];
  movementsCount: number;
  error?: string;
  diagnostics: string[];
};

export type OneCKkmEquipmentDiagnosticsParams = {
  dateFrom: string;
  dateTo: string;
  limit?: number;
};

export type OneCKkmReference = {
  name: string;
  ref: string;
};

export type OneCKkmRecentCheck = {
  ref: string;
  number: string;
  datetime: string;
  amount: number | null;
  organization: OneCKkmReference;
  cashRegister: OneCKkmReference;
  cashier: OneCKkmReference;
  paymentForm: string;
  cashReceived: number | null;
};

export type OneCKkmCashRegisterUsage = {
  organization: OneCKkmReference;
  cashRegister: OneCKkmReference;
  checks: number | null;
  amount: number | null;
  lastCheckDatetime: string;
};

export type OneCKkmAcquiringTerminalUsage = {
  organization: OneCKkmReference;
  cashRegister: OneCKkmReference;
  acquiringTerminal: OneCKkmReference;
  checks: number | null;
  amount: number | null;
  lastCheckDatetime: string;
};

export type OneCKkmEquipmentDiagnosticsResult = {
  ok: boolean;
  path: '/kkm-equipment-diagnostics';
  status?: number;
  durationMs: number;
  checkedAt: string;
  params: OneCKkmEquipmentDiagnosticsParams;
  recentChecks: OneCKkmRecentCheck[];
  cashRegisterUsage: OneCKkmCashRegisterUsage[];
  acquiringTerminalUsage: OneCKkmAcquiringTerminalUsage[];
  catalogCashRegisters: OneCKkmReference[];
  catalogAcquiringTerminals: OneCKkmReference[];
  warnings: string[];
  error?: string;
  diagnostics: string[];
};

export type OneCCashShiftCashier = {
  cashier: OneCKkmReference;
  firstCheckAt: string;
  lastCheckAt: string;
  checksCount: number | null;
};

export type OneCCashShift = {
  ref: string;
  number: string;
  datetime: string;
  organization: OneCKkmReference;
  cashRegister: OneCKkmReference;
  posted: boolean | null;
  deletionMark: boolean | null;
  openedAt: string;
  closedAt: string;
  fiscalShiftDate: string;
  fiscalShiftNumber: string;
  status: string;
  regulatoryStatus: string;
  checksCount: number | null;
  unsentFiscalDocumentsCount: number | null;
  ofdResponseTimeout: boolean | null;
  cashiers: OneCCashShiftCashier[];
};

export type OneCCashShiftsResult = {
  ok: boolean;
  path: '/cash-shifts';
  status?: number;
  durationMs: number;
  checkedAt: string;
  dateFrom: string;
  dateTo: string;
  shifts: OneCCashShift[];
  warnings: string[];
  error?: string;
  diagnostics: string[];
};

export type OneCCashExpenseOrderDocument = {
  ref: string;
  number: string;
  datetime: string;
  posted: boolean | null;
  cashbox: OneCKkmReference;
  targetCashbox: OneCKkmReference;
  amount: number | null;
  operation: string;
};

export type OneCCashReceiptOrderDocument = {
  ref: string;
  number: string;
  datetime: string;
  posted: boolean | null;
  cashbox: OneCKkmReference;
  sourceCashbox: OneCKkmReference;
  baseDocument: OneCKkmReference;
  amount: number | null;
  operation: string;
};

export type CreateOneCCashExpenseOrderParams = {
  idempotencyKey: string;
  organizationRef: string;
  cashboxRef: string;
  targetCashboxRef: string;
  employeeName: string;
  amount: number;
  direction: 'phone_reserve' | 'deposit_safe';
  employeeComment: string;
};

export type CreateOneCCashExpenseOrderResult = {
  ok: boolean;
  path: '/cash-expense-order-create';
  durationMs: number;
  document: OneCCashExpenseOrderDocument | null;
  receiptDocument: OneCCashReceiptOrderDocument | null;
  pairComplete: boolean;
  idempotentReplay: boolean;
  error?: string;
};

export type PreviewOneCCashExpenseOrderResult = CreateOneCCashExpenseOrderResult & {
  confirmationRequired: boolean;
};

let cachedHealth: { expiresAt: number; value: OneCHealthResult } | null = null;

export const DEFAULT_SALES_REALIZATIONS_PARAMS: SalesRealizationsParams = {
  dateFrom: '2026-05-01',
  dateTo: '2026-06-12',
  customerRef: '537e501e-4640-11ed-8f49-0025901e48ee',
  posted: 'true',
  limit: 20,
  offset: 0,
  includeLines: true,
};

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function getConfig(): OneCConfig {
  const env = readOneCRuntimeEnv();
  return {
    baseUrl: env.baseUrl,
    user: env.user,
    password: env.password,
    timeoutMs: readPositiveInteger(env.requestTimeoutMs, 5000),
    cacheTtlSeconds: readPositiveInteger(env.cacheTtlSeconds, 0),
  };
}

function getMissingConfig(config: OneCConfig) {
  const missing: string[] = [];
  if (!config.baseUrl) missing.push('1C_BASE_URL');
  if (!config.user) missing.push('1C_API_USER');
  if (!config.password) missing.push('1C_API_PASSWORD');
  return missing;
}

function buildAuthHeader(config: OneCConfig) {
  return 'Basic ' + Buffer.from(`${config.user}:${config.password}`, 'utf8').toString('base64');
}

async function readResponseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readFirstString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function readName(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);

  const source = readRecord(value);
  return source ? readFirstString(source, ['name', 'Наименование']) : '';
}

function readFirstNumber(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const normalized = Number(value.replace(/\s/g, '').replace(',', '.'));
      if (Number.isFinite(normalized)) return normalized;
    }
  }
  return null;
}

function readFirstBoolean(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'да'].includes(normalized)) return true;
      if (['false', '0', 'no', 'нет'].includes(normalized)) return false;
    }
  }
  return null;
}

function normalizePayrollSalesFact(value: unknown): OneCPayrollSalesFact | null {
  const source = readRecord(value);
  if (!source) return null;

  const recorderRef = readFirstString(source, ['recorder_ref']);
  const productRef = readFirstString(source, ['product_ref']);
  const period = readFirstString(source, ['period']);
  const lineNumber = readFirstNumber(source, ['line_number']);
  if (!recorderRef || !productRef || !period || lineNumber === null) return null;
  // A malformed monetary value must never silently become a plausible zero.
  const requiredNumbers = ['quantity', 'revenue', 'cost', 'gross_profit', 'report_cost', 'report_gross_profit'];
  if (requiredNumbers.some((key) => typeof source[key] !== 'number' || !Number.isFinite(source[key]))) return null;
  if (!Number.isInteger(lineNumber) || lineNumber < 1 || source.active !== true) return null;
  if (typeof source.cost_calculation_pending !== 'boolean' || typeof source.cost_review_required !== 'boolean') return null;
  // Ignore only binary floating-point noise, never a whole kopeck mismatch.
  const revenue = source.revenue as number;
  for (const [costKey, profitKey] of [['cost', 'gross_profit'], ['report_cost', 'report_gross_profit']]) {
    const cost = source[costKey] as number;
    const profit = source[profitKey] as number;
    const tolerance = Math.min(0.0001, Math.max(1e-7, Number.EPSILON * Math.max(Math.abs(revenue), Math.abs(cost), Math.abs(profit)) * 4));
    if (Math.abs(revenue - cost - profit) > tolerance) return null;
  }

  return {
    period,
    recorderRef,
    recorderName: readFirstString(source, ['recorder_name']),
    recorderType: readFirstString(source, ['recorder_type']),
    lineNumber,
    managerRef: readFirstString(source, ['manager_ref']),
    managerName: readFirstString(source, ['manager_name']),
    customerRef: readFirstString(source, ['customer_ref']),
    customerName: readFirstString(source, ['customer_name']),
    organizationRef: readFirstString(source, ['organization_ref']),
    organizationName: readFirstString(source, ['organization_name']),
    warehouseRef: readFirstString(source, ['warehouse_ref']),
    warehouseName: readFirstString(source, ['warehouse_name']),
    productRef,
    productCode: readFirstString(source, ['product_code']),
    productArticle: readFirstString(source, ['product_article']),
    productName: readFirstString(source, ['product_name']),
    productKindRef: readFirstString(source, ['product_kind_ref']),
    productKindName: readFirstString(source, ['product_kind_name']),
    productCategoryRef: readFirstString(source, ['product_category_ref']),
    productCategoryName: readFirstString(source, ['product_category_name']),
    characteristicRef: readFirstString(source, ['characteristic_ref']),
    characteristicName: readFirstString(source, ['characteristic_name']),
    quantity: readFirstNumber(source, ['quantity']) ?? 0,
    revenue: readFirstNumber(source, ['revenue']) ?? 0,
    baseCost: readFirstNumber(source, ['base_cost']) ?? 0,
    additionalExpenses: readFirstNumber(source, ['additional_expenses']) ?? 0,
    cost: readFirstNumber(source, ['cost']) ?? 0,
    grossProfit: readFirstNumber(source, ['gross_profit']) ?? 0,
    vatAmount: readFirstNumber(source, ['vat_amount']) ?? 0,
    costReviewRequired: readFirstBoolean(source, ['cost_review_required']) === true,
    reportCost: readFirstNumber(source, ['report_cost'])!,
    reportGrossProfit: readFirstNumber(source, ['report_gross_profit'])!,
    costCalculationPending: source.cost_calculation_pending === true,
  };
}

type PayrollSalesFactsPageResult = {
  ok: boolean;
  status?: number;
  rows: OneCPayrollSalesFact[];
  nextCursor: string;
  complete: boolean;
  contractVersion: string;
  extractedAt: string;
  periodComplete: boolean;
  diagnostics: string[];
  error?: string;
};

async function requestPayrollSalesFactsPage(
  config: OneCConfig,
  params: { dateFrom: string; dateTo: string; pageSize: number; cursor: string },
): Promise<PayrollSalesFactsPageResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(config.timeoutMs, 30_000));
  const query = new URLSearchParams({
    date_from: params.dateFrom,
    date_to: params.dateTo,
    limit: String(params.pageSize),
  });
  if (params.cursor) query.set('cursor', params.cursor);

  try {
    const response = await fetch(`${config.baseUrl}/payroll-sales-facts?${query.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
        Authorization: buildAuthHeader(config),
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = readRecord(await readResponseBody(response)) ?? {};
    const page = readRecord(payload.page) ?? {};
    const rawRows = readArray(payload.rows);
    const rows = rawRows.map(normalizePayrollSalesFact).filter((row): row is OneCPayrollSalesFact => row !== null);
    const diagnostics: string[] = [];
    if (rows.length !== rawRows.length) diagnostics.push(`Не распознано строк: ${rawRows.length - rows.length}.`);

    if (!response.ok || payload.ok !== true || !Array.isArray(payload.rows) || rows.length !== rawRows.length || payload.date_from !== params.dateFrom || payload.date_to !== params.dateTo || payload.mode !== 'read-only' || typeof page.complete !== 'boolean' || typeof payload.period_complete !== 'boolean' || !readFirstString(payload, ['extracted_at']) || rows.some((row) => row.period.slice(0, 10) < params.dateFrom || row.period.slice(0, 10) > params.dateTo)) {
      return {
        ok: false,
        status: response.status,
        rows: [],
        nextCursor: '',
        complete: false,
        contractVersion: readFirstString(payload, ['contract_version']),
        extractedAt: readFirstString(payload, ['extracted_at']),
        periodComplete: false,
        diagnostics,
        error: 'Источник зарплаты недоступен или вернул неполные/некорректные данные.',
      };
    }

    return {
      ok: true,
      status: response.status,
      rows,
      nextCursor: readFirstString(page, ['next_cursor']),
      complete: readFirstBoolean(page, ['complete']) === true,
      contractVersion: readFirstString(payload, ['contract_version']),
      extractedAt: readFirstString(payload, ['extracted_at']),
      periodComplete: readFirstBoolean(payload, ['period_complete']) === true,
      diagnostics,
    };
  } catch (error) {
    return {
      ok: false,
      rows: [],
      nextCursor: '',
      complete: false,
      contractVersion: '',
      extractedAt: '',
      periodComplete: false,
      diagnostics: [],
      error: formatError(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}


function normalizeOneCDateTime(value: string) {
  return normalizeOneCDateTimeValue(value) || value;
}

function normalizeSalesRealizationLine(value: unknown, index: number): OneCSalesRealizationLine {
  const source = readRecord(value) ?? {};
  return {
    lineNumber: readFirstString(source, ['line_number', 'lineNumber', 'number', 'n']) || String(index + 1),
    productCode: readFirstString(source, ['product_code', 'productCode', 'code', 'sku']),
    productName: readFirstString(source, ['product_name', 'productName', 'item_name', 'itemName', 'nomenclature_name', 'nomenclatureName', 'name']) || readName(source.product),
    productKindName: readFirstString(source, ['product_kind_name', 'productKindName', 'nomenclature_kind_name', 'nomenclatureKindName']) || readName(source.product_kind),
    productArticle: readFirstString(source, ['product_article', 'productArticle', 'article', 'vendor_code', 'vendorCode']),
    quantity: readFirstNumber(source, ['quantity', 'qty']),
    price: readFirstNumber(source, ['price']),
    amount: readFirstNumber(source, ['amount', 'sum', 'total']),
    vatRate: readFirstString(source, ['vat_rate', 'vatRate', 'vat']),
  };
}

function normalizeSalesRealizationDocument(value: unknown): OneCSalesRealizationDocument {
  const source = readRecord(value) ?? {};
  const lines = readArray(source.lines ?? source.items ?? source.products ?? source.rows).map(normalizeSalesRealizationLine);
  const organization = readRecord(source.organization) ?? {};
  const partner = readRecord(source.partner) ?? {};
  const counterparty = readRecord(source.counterparty) ?? {};
  const manager = readRecord(source.manager) ?? {};
  return {
    ref: readFirstString(source, ['ref', 'document_ref', 'documentRef', 'id', 'guid']),
    number: readFirstString(source, ['number', 'doc_number', 'docNumber', 'document_number', 'documentNumber']),
    date: readFirstString(source, ['date', 'doc_date', 'docDate', 'document_date', 'documentDate']),
    posted: readFirstBoolean(source, ['posted', 'is_posted', 'isPosted']),
    deletionMark: readFirstBoolean(source, ['deletion_mark', 'deletionMark', 'deleted', 'is_deleted', 'isDeleted']),
    amount: readFirstNumber(source, ['amount', 'sum', 'total', 'document_amount', 'documentAmount']),
    currency: readFirstString(source, ['currency', 'currency_code', 'currencyCode']),
    organizationName: readFirstString(source, ['organization_name', 'organizationName']) || readName(source.organization),
    organizationRef: readFirstString(organization, ['ref', 'id', 'guid']),
    organizationInn: readFirstString(source, ['organization_inn', 'organizationInn', 'inn']),
    partnerName: readFirstString(source, ['partner_name', 'partnerName']) || readName(source.partner),
    partnerRef: readFirstString(partner, ['ref', 'id', 'guid']),
    counterpartyName: readFirstString(source, ['counterparty_name', 'counterpartyName', 'customer_name', 'customerName']) || readName(source.counterparty),
    counterpartyRef: readFirstString(counterparty, ['ref', 'id', 'guid']),
    warehouseName: readFirstString(source, ['warehouse_name', 'warehouseName']) || readName(source.warehouse),
    managerName: readFirstString(source, ['manager_name', 'managerName']) || readName(source.manager),
    managerRef: readFirstString(manager, ['ref', 'id', 'guid']),
    managerSource: readFirstString(source, ['manager_source', 'managerSource']),
    responsibleName: readFirstString(source, ['responsible_name', 'responsibleName']) || readName(source.responsible),
    responsibleSource: readFirstString(source, ['responsible_source', 'responsibleSource']),
    additionalManagerName: readFirstString(source, ['additional_manager_name', 'additionalManagerName']),
    comment: readFirstString(source, ['comment', 'description']),
    lines,
  };
}

function normalizeLinkedDocument(value: unknown): OneCLinkedDocument {
  const source = readRecord(value) ?? {};
  const reasons = readArray(source.match_reasons ?? source.matchReasons ?? source.reasons)
    .map((reason) => typeof reason === 'string' || typeof reason === 'number' ? String(reason) : '')
    .filter(Boolean);
  const sourcePaths = readArray(source.source_paths ?? source.sourcePaths)
    .map((path) => typeof path === 'string' || typeof path === 'number' ? String(path) : '')
    .filter(Boolean);
  const organization = readRecord(source.organization) ?? {};
  const partner = readRecord(source.partner) ?? {};
  const counterparty = readRecord(source.counterparty) ?? {};
  const manager = readRecord(source.manager) ?? {};

  return {
    documentType: readFirstString(source, ['document_type', 'documentType', 'type']),
    matchType: readFirstString(source, ['match_type', 'matchType']),
    matchReasons: reasons,
    sourcePaths,
    ref: readFirstString(source, ['ref', 'document_ref', 'documentRef', 'id', 'guid']),
    name: readFirstString(source, ['name', 'presentation', 'description']),
    number: readFirstString(source, ['number', 'doc_number', 'docNumber', 'document_number', 'documentNumber']),
    date: readFirstString(source, ['date', 'doc_date', 'docDate', 'document_date', 'documentDate']),
    posted: readFirstBoolean(source, ['posted', 'is_posted', 'isPosted']),
    amount: readFirstNumber(source, ['amount', 'sum', 'total', 'document_amount', 'documentAmount']),
    organizationName: readFirstString(source, ['organization_name', 'organizationName']) || readName(source.organization),
    organizationRef: readFirstString(organization, ['ref', 'id', 'guid']),
    partnerName: readFirstString(source, ['partner_name', 'partnerName']) || readName(source.partner),
    partnerRef: readFirstString(partner, ['ref', 'id', 'guid']),
    counterpartyName: readFirstString(source, ['counterparty_name', 'counterpartyName', 'customer_name', 'customerName']) || readName(source.counterparty),
    counterpartyRef: readFirstString(counterparty, ['ref', 'id', 'guid']),
    managerName: readFirstString(source, ['manager_name', 'managerName']) || readName(source.manager),
    managerRef: readFirstString(manager, ['ref', 'id', 'guid']),
    comment: readFirstString(source, ['comment', 'description']),
  };
}

function normalizeLinkedDocumentGroup(value: unknown): OneCLinkedDocumentGroup {
  const source = readRecord(value) ?? {};
  return {
    direct: readArray(source.direct).map(normalizeLinkedDocument),
    candidates: readArray(source.candidates).map(normalizeLinkedDocument),
  };
}

function normalizeCheckedSource(value: unknown) {
  const source = readRecord(value) ?? {};
  return {
    name: readFirstString(source, ['name', 'source']),
    matchMode: readFirstString(source, ['match_mode', 'matchMode']),
    ok: readFirstBoolean(source, ['ok', 'success']),
    count: readFirstNumber(source, ['count', 'documents_count', 'documentsCount']),
    errorText: readFirstString(source, ['error_text', 'errorText', 'error']),
  };
}

function normalizeCashStatementDimension(value: unknown): OneCCashStatementDimension {
  const source = readRecord(value) ?? {};
  return {
    name: readFirstString(source, ['name', 'presentation', 'description']),
    ref: readFirstString(source, ['ref', 'id', 'guid']),
    deleted: readFirstBoolean(source, ['deleted', 'deletion_mark', 'deletionMark']),
  };
}

function normalizeCashStatementMovement(value: unknown): OneCCashStatementMovement {
  const source = readRecord(value) ?? {};
  const document = normalizeCashStatementDimension(source.document);
  return {
    period: readFirstString(source, ['period', 'date']),
    incoming: readFirstNumber(source, ['incoming', 'income', 'debit']),
    outgoing: readFirstNumber(source, ['outgoing', 'expense', 'credit']),
    document: {
      name: document.name,
      ref: document.ref,
    },
    documentType: readFirstString(source, ['document_type', 'documentType', 'type']),
  };
}

function normalizeKkmReference(value: unknown): OneCKkmReference {
  const source = readRecord(value) ?? {};
  return {
    name: readFirstString(source, ['name', 'presentation', 'description']),
    ref: readFirstString(source, ['ref', 'id', 'guid']),
  };
}

function normalizeKkmRecentCheck(value: unknown): OneCKkmRecentCheck {
  const source = readRecord(value) ?? {};
  return {
    ref: readFirstString(source, ['ref', 'id', 'guid']),
    number: readFirstString(source, ['number', 'document_number', 'documentNumber']),
    datetime: normalizeOneCDateTime(readFirstString(source, ['datetime', 'date'])),
    amount: readFirstNumber(source, ['amount', 'sum', 'total']),
    organization: normalizeKkmReference(source.organization),
    cashRegister: normalizeKkmReference(source.cash_register ?? source.cashRegister),
    cashier: normalizeKkmReference(source.cashier ?? source.responsible),
    paymentForm: readFirstString(source, ['payment_form', 'paymentForm']),
    cashReceived: readFirstNumber(source, ['cash_received', 'cashReceived']),
  };
}

function normalizeKkmCashRegisterUsage(value: unknown): OneCKkmCashRegisterUsage {
  const source = readRecord(value) ?? {};
  return {
    organization: normalizeKkmReference(source.organization),
    cashRegister: normalizeKkmReference(source.cash_register ?? source.cashRegister),
    checks: readFirstNumber(source, ['checks', 'checks_count', 'checksCount']),
    amount: readFirstNumber(source, ['amount', 'sum', 'total']),
    lastCheckDatetime: readFirstString(source, ['last_check_datetime', 'lastCheckDatetime']),
  };
}

function normalizeKkmAcquiringTerminalUsage(value: unknown): OneCKkmAcquiringTerminalUsage {
  const source = readRecord(value) ?? {};
  return {
    organization: normalizeKkmReference(source.organization),
    cashRegister: normalizeKkmReference(source.cash_register ?? source.cashRegister),
    acquiringTerminal: normalizeKkmReference(source.acquiring_terminal ?? source.acquiringTerminal),
    checks: readFirstNumber(source, ['checks', 'checks_count', 'checksCount']),
    amount: readFirstNumber(source, ['amount', 'sum', 'total']),
    lastCheckDatetime: readFirstString(source, ['last_check_datetime', 'lastCheckDatetime']),
  };
}

function normalizeCashShift(value: unknown): OneCCashShift {
  const source = readRecord(value) ?? {};
  return {
    ref: readFirstString(source, ['ref', 'id', 'guid']),
    number: readFirstString(source, ['number', 'document_number']),
    datetime: normalizeOneCDateTime(readFirstString(source, ['datetime', 'date'])),
    organization: normalizeKkmReference(source.organization),
    cashRegister: normalizeKkmReference(source.cash_register ?? source.cashRegister),
    posted: readFirstBoolean(source, ['posted']),
    deletionMark: readFirstBoolean(source, ['deletion_mark', 'deletionMark']),
    openedAt: normalizeOneCDateTime(readFirstString(source, ['opened_at', 'openedAt'])),
    closedAt: normalizeOneCDateTime(readFirstString(source, ['closed_at', 'closedAt'])),
    fiscalShiftDate: normalizeOneCDateTime(readFirstString(source, ['fiscal_shift_date', 'fiscalShiftDate'])),
    fiscalShiftNumber: readFirstString(source, ['fiscal_shift_number', 'fiscalShiftNumber']),
    status: readFirstString(source, ['status']),
    regulatoryStatus: readFirstString(source, ['regulatory_status', 'regulatoryStatus']),
    checksCount: readFirstNumber(source, ['checks_count', 'checksCount']),
    unsentFiscalDocumentsCount: readFirstNumber(source, ['unsent_fiscal_documents_count', 'unsentFiscalDocumentsCount']),
    ofdResponseTimeout: readFirstBoolean(source, ['ofd_response_timeout', 'ofdResponseTimeout']),
    cashiers: readArray(source.cashiers).map((value) => {
      const cashier = readRecord(value) ?? {};
      return {
        cashier: normalizeKkmReference(cashier.cashier),
        firstCheckAt: normalizeOneCDateTime(readFirstString(cashier, ['first_check_at', 'firstCheckAt'])),
        lastCheckAt: normalizeOneCDateTime(readFirstString(cashier, ['last_check_at', 'lastCheckAt'])),
        checksCount: readFirstNumber(cashier, ['checks_count', 'checksCount']),
      };
    }),
  };
}

function findCashShiftsPayload(data: unknown) {
  const root = readRecord(data);
  if (!root) return { shifts: [] as OneCCashShift[], warnings: [] as string[], diagnostics: ['Ответ 1С не похож на JSON-объект.'] };
  const payload = readRecord(root.data) ?? root;
  return {
    shifts: readArray(payload.shifts).map(normalizeCashShift),
    warnings: readArray(payload.warnings).map(String),
    diagnostics: [] as string[],
  };
}

function normalizeCashExpenseOrderDocument(value: unknown): OneCCashExpenseOrderDocument | null {
  const source = readRecord(value);
  if (!source) return null;
  return {
    ref: readFirstString(source, ['ref']),
    number: readFirstString(source, ['number']),
    datetime: readFirstString(source, ['datetime']),
    posted: readFirstBoolean(source, ['posted']),
    cashbox: normalizeKkmReference(source.cashbox),
    targetCashbox: normalizeKkmReference(source.target_cashbox ?? source.targetCashbox),
    amount: readFirstNumber(source, ['amount']),
    operation: readFirstString(source, ['operation']),
  };
}

function normalizeCashReceiptOrderDocument(value: unknown): OneCCashReceiptOrderDocument | null {
  const source = readRecord(value);
  if (!source) return null;
  return {
    ref: readFirstString(source, ['ref']),
    number: readFirstString(source, ['number']),
    datetime: readFirstString(source, ['datetime']),
    posted: readFirstBoolean(source, ['posted']),
    cashbox: normalizeKkmReference(source.cashbox),
    sourceCashbox: normalizeKkmReference(source.source_cashbox ?? source.sourceCashbox),
    baseDocument: normalizeKkmReference(source.base_document ?? source.baseDocument),
    amount: readFirstNumber(source, ['amount']),
    operation: readFirstString(source, ['operation']),
  };
}

function findKkmEquipmentDiagnosticsPayload(data: unknown) {
  const root = readRecord(data);
  if (!root) {
    return {
      recentChecks: [] as OneCKkmRecentCheck[],
      cashRegisterUsage: [] as OneCKkmCashRegisterUsage[],
      acquiringTerminalUsage: [] as OneCKkmAcquiringTerminalUsage[],
      catalogCashRegisters: [] as OneCKkmReference[],
      catalogAcquiringTerminals: [] as OneCKkmReference[],
      warnings: [] as string[],
      diagnostics: ['Ответ 1С не похож на JSON-объект.'],
    };
  }

  const payload = readRecord(root.data) ?? root;
  const catalogs = readRecord(payload.catalogs) ?? {};
  return {
    recentChecks: readArray(payload.recent_checks ?? payload.recentChecks).map(normalizeKkmRecentCheck),
    cashRegisterUsage: readArray(payload.cash_register_usage ?? payload.cashRegisterUsage).map(normalizeKkmCashRegisterUsage),
    acquiringTerminalUsage: readArray(payload.acquiring_terminal_usage ?? payload.acquiringTerminalUsage).map(normalizeKkmAcquiringTerminalUsage),
    catalogCashRegisters: readArray(catalogs.cash_registers ?? catalogs.cashRegisters).map(normalizeKkmReference),
    catalogAcquiringTerminals: readArray(catalogs.acquiring_terminals ?? catalogs.acquiringTerminals).map(normalizeKkmReference),
    warnings: readArray(payload.warnings).map((warning) => String(warning)),
    diagnostics: [] as string[],
  };
}

function findCashStatementDimensionsPayload(data: unknown) {
  const root = readRecord(data);
  if (!root) {
    return {
      organizations: [] as OneCCashStatementDimension[],
      cashboxes: [] as OneCCashStatementDimension[],
      diagnostics: ['Ответ 1С не похож на JSON-объект.'],
    };
  }

  const nestedData = readRecord(root.data);
  const payload = nestedData ?? root;
  const organizations = readArray(payload.organizations).map(normalizeCashStatementDimension);
  const cashboxes = readArray(payload.cashboxes).map(normalizeCashStatementDimension);
  const diagnostics: string[] = [];

  if (organizations.length === 0) diagnostics.push('1С не вернула список организаций.');
  if (cashboxes.length === 0) diagnostics.push('1С не вернула список касс.');

  return { organizations, cashboxes, diagnostics };
}

function findCashStatementSummaryPayload(data: unknown) {
  const root = readRecord(data);
  if (!root) {
    return {
      summary: null,
      diagnostics: ['Ответ 1С не похож на JSON-объект.'],
    };
  }

  const nestedData = readRecord(root.data);
  const payload = nestedData ?? root;
  const movements = readArray(payload.movements).map(normalizeCashStatementMovement);

  return {
    summary: {
      register: readFirstString(payload, ['register']),
      date: readFirstString(payload, ['date']),
      cashbox: payload.cashbox ? normalizeCashStatementDimension(payload.cashbox) : null,
      organization: payload.organization ? normalizeCashStatementDimension(payload.organization) : null,
      openingBalance: readFirstNumber(payload, ['opening_balance', 'openingBalance']),
      incomingTotal: readFirstNumber(payload, ['incoming_total', 'incomingTotal']),
      outgoingTotal: readFirstNumber(payload, ['outgoing_total', 'outgoingTotal']),
      closingBalance: readFirstNumber(payload, ['closing_balance', 'closingBalance']),
      movements,
      movementsCount: readFirstNumber(payload, ['movements_count', 'movementsCount']) ?? movements.length,
    },
    diagnostics: [] as string[],
  };
}

export function normalizeSalesRealizationLinksPayload(data: unknown): { links: OneCSalesRealizationLinks | null; diagnostics: string[] } {
  const root = readRecord(data);
  if (!root) return { links: null, diagnostics: ['Ответ 1С не похож на JSON-объект.'] };

  const nestedData = readRecord(root.data);
  const payload = nestedData ?? root;
  const linksRoot = readRecord(payload.links) ?? payload;
  const fiscalRoot = readRecord(payload.fiscal_control ?? payload.fiscalControl) ?? {};
  const completenessRoot = readRecord(payload.completeness) ?? {};
  const diagnostics: string[] = [];

  const links: OneCSalesRealizationLinks = {
    realization: payload.realization ? normalizeSalesRealizationDocument(payload.realization) : null,
    cashReceipts: normalizeLinkedDocumentGroup(linksRoot.cash_receipts ?? linksRoot.cashReceipts),
    acquiring: normalizeLinkedDocumentGroup(linksRoot.acquiring),
    bankReceipts: normalizeLinkedDocumentGroup(linksRoot.bank_receipts ?? linksRoot.bankReceipts),
    paymentDocuments: normalizeLinkedDocumentGroup(linksRoot.payment_documents ?? linksRoot.paymentDocuments),
    returns: normalizeLinkedDocumentGroup(linksRoot.returns),
    corrections: normalizeLinkedDocumentGroup(linksRoot.corrections),
    checkedSources: readArray(payload.checked_sources ?? payload.checkedSources).map(normalizeCheckedSource),
    fiscalControl: {
      source: readFirstString(fiscalRoot, ['source']),
      complete: readFirstBoolean(fiscalRoot, ['complete']) === true,
      documents: readArray(fiscalRoot.documents).map((value) => {
        const source = readRecord(value) ?? {};
        return {
          sourceType: readFirstString(source, ['source_type', 'sourceType']),
          documentType: readFirstString(source, ['document_type', 'documentType']),
          documentRef: readFirstString(source, ['document_ref', 'documentRef']),
          linkPath: readFirstString(source, ['link_path', 'linkPath']),
          operations: readArray(source.operations).map(normalizeSalesRealizationFiscalOperation),
          dataState: readFirstString(source, ['data_state', 'dataState']),
        };
      }),
      conflictCount: readFirstNumber(fiscalRoot, ['conflict_count', 'conflictCount']) ?? 0,
      errors: readArray(fiscalRoot.errors).map(String),
    },
    completeness: {
      linksComplete: readFirstBoolean(completenessRoot, ['links_complete', 'linksComplete']) === true,
      fiscalOperationsComplete: readFirstBoolean(completenessRoot, ['fiscal_operations_complete', 'fiscalOperationsComplete']) === true,
      failedSources: readArray(completenessRoot.failed_sources ?? completenessRoot.failedSources).map(String),
      complete: readFirstBoolean(completenessRoot, ['complete']) === true,
      absenceIsHardErrorEligible: readFirstBoolean(completenessRoot, ['absence_is_hard_error_eligible', 'absenceIsHardErrorEligible']) === true,
    },
    hardErrorEligible: readFirstBoolean(payload, ['hard_error_eligible', 'hardErrorEligible']) === true,
    warnings: readArray(payload.warnings)
      .map((warning) => typeof warning === 'string' || typeof warning === 'number' ? String(warning) : '')
      .filter(Boolean),
  };

  if (!links.realization) diagnostics.push('В ответе sales-realization-links не найден блок realization.');

  return { links, diagnostics };
}

function normalizeSalesRealizationFiscalOperation(value: unknown): OneCSalesRealizationFiscalOperation {
  const source = readRecord(value) ?? {};
  const organization = readRecord(source.organization) ?? {};
  const retailLocation = readRecord(source.retail_location ?? source.retailLocation) ?? {};
  return {
    recordId: readFirstString(source, ['record_id', 'recordId']),
    datetime: readFirstString(source, ['datetime', 'date']),
    checkNumber: readFirstString(source, ['check_number', 'checkNumber']),
    shiftNumber: readFirstString(source, ['shift_number', 'shiftNumber']),
    amount: readFirstNumber(source, ['amount', 'sum']),
    documentType: readFirstString(source, ['document_type', 'documentType']),
    calculationType: readFirstString(source, ['calculation_type', 'calculationType']),
    organizationName: readFirstString(organization, ['name', 'presentation']),
    retailLocationName: readFirstString(retailLocation, ['name', 'presentation']),
    kktRegistrationNumber: readFirstString(source, ['kkt_registration_number', 'kktRegistrationNumber']),
    fiscalDriveNumber: readFirstString(source, ['fiscal_drive_number', 'fiscalDriveNumber']),
    fiscalDocumentNumber: readFirstString(source, ['fiscal_document_number', 'fiscalDocumentNumber']),
    fiscalSign: readFirstString(source, ['fiscal_sign', 'fiscalSign']),
    cashPayment: readFirstNumber(source, ['cash_payment', 'cashPayment']),
    electronicPayment: readFirstNumber(source, ['electronic_payment', 'electronicPayment']),
    prepayment: readFirstNumber(source, ['prepayment']),
    postpayment: readFirstNumber(source, ['postpayment']),
    counterProvision: readFirstNumber(source, ['counter_provision', 'counterProvision']),
    unifiedCheck: readFirstBoolean(source, ['unified_check', 'unifiedCheck']),
    hasXmlData: readFirstBoolean(source, ['has_xml_data', 'hasXmlData']),
    fiscalized: readFirstBoolean(source, ['fiscalized']) === true,
  };
}

function findSalesRealizationFiscalOperationsPayload(data: unknown) {
  const root = readRecord(data);
  if (!root) {
    return {
      found: false,
      fiscalized: false,
      operations: [] as OneCSalesRealizationFiscalOperation[],
      diagnostics: ['Ответ 1С не похож на JSON-объект.'],
    };
  }
  const payload = readRecord(root.data) ?? root;
  const operations = readArray(payload.operations).map(normalizeSalesRealizationFiscalOperation);
  return {
    found: readFirstBoolean(payload, ['found']) ?? operations.length > 0,
    fiscalized: readFirstBoolean(payload, ['fiscalized']) ?? operations.some((operation) => operation.fiscalized),
    operations,
    diagnostics: [] as string[],
  };
}

function findDocumentsPayload(data: unknown) {
  const root = readRecord(data);
  if (!root) return { documents: [], diagnostics: ['Ответ 1С не похож на JSON-объект.'] };

  const nestedData = readRecord(root.data);
  const candidates = [
    root.documents,
    root.items,
    root.results,
    nestedData?.documents,
    nestedData?.items,
    nestedData?.results,
  ];
  const rawDocuments = candidates.find(Array.isArray);
  const diagnostics: string[] = [];

  if (!rawDocuments) {
    diagnostics.push('В ответе не найден массив documents/items/results.');
    return { documents: [], diagnostics };
  }

  const documents = rawDocuments.map(normalizeSalesRealizationDocument);
  if (documents.some((document) => !document.number && !document.ref)) {
    diagnostics.push('У части документов не найдены поля number/ref.');
  }
  if (documents.some((document) => document.lines.length === 0)) {
    diagnostics.push('У части документов нет строк товаров или поле lines называется иначе.');
  }

  return { documents, diagnostics };
}

function readSalesTotals(data: unknown) {
  const root = readRecord(data) ?? {};
  const nestedData = readRecord(root.data) ?? {};
  const totals = readRecord(root.totals) ?? readRecord(nestedData.totals) ?? {};
  const pagination = readRecord(root.pagination) ?? readRecord(nestedData.pagination) ?? {};
  return {
    totalDocuments: readFirstNumber(totals, ['documents', 'document_count', 'documentCount', 'count']) ?? readFirstNumber(root, ['total', 'total_documents', 'totalDocuments', 'count']),
    totalAmount: readFirstNumber(totals, ['amount', 'sum', 'total_amount', 'totalAmount']),
    hasMore: readFirstBoolean(root, ['has_more', 'hasMore']) ?? readFirstBoolean(pagination, ['has_more', 'hasMore']) ?? false,
  };
}

function formatError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') return 'Request timed out';
  if (error instanceof Error) return error.message;
  return 'Unknown request error';
}

async function requestCashStatementDimensions(config: OneCConfig): Promise<OneCCashStatementDimensionsResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const path = '/cash-statement-dimensions';

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
        Authorization: buildAuthHeader(config),
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await readResponseBody(response);
    const durationMs = Date.now() - startedAt;
    const payload = findCashStatementDimensionsPayload(data);

    if (!response.ok) {
      return {
        ok: false,
        path,
        status: response.status,
        durationMs,
        checkedAt: new Date().toISOString(),
        organizations: [],
        cashboxes: [],
        error: `1C API returned HTTP ${response.status}`,
        diagnostics: payload.diagnostics,
      };
    }

    return {
      ok: payload.organizations.length > 0 && payload.cashboxes.length > 0,
      path,
      status: response.status,
      durationMs,
      checkedAt: new Date().toISOString(),
      organizations: payload.organizations,
      cashboxes: payload.cashboxes,
      diagnostics: payload.diagnostics,
    };
  } catch (error) {
    return {
      ok: false,
      path,
      durationMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      organizations: [],
      cashboxes: [],
      error: formatError(error),
      diagnostics: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestCashStatementSummary(
  config: OneCConfig,
  params: OneCCashStatementSummaryParams,
): Promise<OneCCashStatementSummaryResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const path = '/cash-statement-summary';
  const query = new URLSearchParams({
    date: params.date,
    organization_ref: params.organizationRef,
    cashbox_ref: params.cashboxRef,
  });

  try {
    const response = await fetch(`${config.baseUrl}${path}?${query.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
        Authorization: buildAuthHeader(config),
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await readResponseBody(response);
    const durationMs = Date.now() - startedAt;
    const payload = findCashStatementSummaryPayload(data);

    if (!response.ok || !payload.summary) {
      return {
        ok: false,
        path,
        status: response.status,
        durationMs,
        checkedAt: new Date().toISOString(),
        params,
        register: '',
        date: params.date,
        cashbox: null,
        organization: null,
        openingBalance: null,
        incomingTotal: null,
        outgoingTotal: null,
        closingBalance: null,
        movements: [],
        movementsCount: 0,
        error: response.ok ? '1C API returned an unexpected cash statement payload' : `1C API returned HTTP ${response.status}`,
        diagnostics: payload.diagnostics,
      };
    }

    return {
      ok: true,
      path,
      status: response.status,
      durationMs,
      checkedAt: new Date().toISOString(),
      params,
      ...payload.summary,
      diagnostics: payload.diagnostics,
    };
  } catch (error) {
    return {
      ok: false,
      path,
      durationMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      params,
      register: '',
      date: params.date,
      cashbox: null,
      organization: null,
      openingBalance: null,
      incomingTotal: null,
      outgoingTotal: null,
      closingBalance: null,
      movements: [],
      movementsCount: 0,
      error: formatError(error),
      diagnostics: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestKkmEquipmentDiagnostics(
  config: OneCConfig,
  params: OneCKkmEquipmentDiagnosticsParams,
): Promise<OneCKkmEquipmentDiagnosticsResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const path = '/kkm-equipment-diagnostics';
  const query = new URLSearchParams({
    date_from: params.dateFrom,
    date_to: params.dateTo,
    limit: String(params.limit ?? 300),
    catalog_limit: '1',
  });

  try {
    const response = await fetch(`${config.baseUrl}${path}?${query.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
        Authorization: buildAuthHeader(config),
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await readResponseBody(response);
    const durationMs = Date.now() - startedAt;
    const payload = findKkmEquipmentDiagnosticsPayload(data);

    if (!response.ok) {
      return {
        ok: false,
        path,
        status: response.status,
        durationMs,
        checkedAt: new Date().toISOString(),
        params,
        recentChecks: [],
        cashRegisterUsage: [],
        acquiringTerminalUsage: [],
        catalogCashRegisters: [],
        catalogAcquiringTerminals: [],
        warnings: payload.warnings,
        error: `1C API returned HTTP ${response.status}`,
        diagnostics: payload.diagnostics,
      };
    }

    return {
      ok: true,
      path,
      status: response.status,
      durationMs,
      checkedAt: new Date().toISOString(),
      params,
      ...payload,
    };
  } catch (error) {
    return {
      ok: false,
      path,
      durationMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      params,
      recentChecks: [],
      cashRegisterUsage: [],
      acquiringTerminalUsage: [],
      catalogCashRegisters: [],
      catalogAcquiringTerminals: [],
      warnings: [],
      error: formatError(error),
      diagnostics: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestCashShifts(config: OneCConfig, dateFrom: string, dateTo: string): Promise<OneCCashShiftsResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const path = '/cash-shifts';
  const query = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, limit: '300' });
  try {
    const response = await fetch(`${config.baseUrl}${path}?${query}`, {
      headers: { Accept: 'application/json', Authorization: buildAuthHeader(config) },
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await readResponseBody(response);
    const payload = findCashShiftsPayload(data);
    return {
      ok: response.ok && payload.diagnostics.length === 0,
      path,
      status: response.status,
      durationMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      dateFrom,
      dateTo,
      shifts: response.ok ? payload.shifts : [],
      warnings: payload.warnings,
      error: response.ok ? undefined : `1C API returned HTTP ${response.status}`,
      diagnostics: payload.diagnostics,
    };
  } catch (error) {
    return { ok: false, path, durationMs: Date.now() - startedAt, checkedAt: new Date().toISOString(), dateFrom, dateTo, shifts: [], warnings: [], error: formatError(error), diagnostics: [] };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestCashExpenseOrder(config: OneCConfig, params: CreateOneCCashExpenseOrderParams): Promise<CreateOneCCashExpenseOrderResult> {
  const startedAt = Date.now();
  const path = '/cash-expense-order-create';
  const request = async (payload: Record<string, unknown>) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(config.timeoutMs, 15_000));
    try {
      const response = await fetch(`${config.baseUrl}${path}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: buildAuthHeader(config) },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller.signal,
      });
      return { response, data: readRecord(await readResponseBody(response)) ?? {} };
    } finally {
      clearTimeout(timeout);
    }
  };
  const basePayload = {
    idempotency_key: params.idempotencyKey,
    organization_ref: params.organizationRef,
    cashbox_ref: params.cashboxRef,
    target_cashbox_ref: params.targetCashboxRef,
    employee_name: params.employeeName,
    amount: params.amount,
    direction: params.direction,
    employee_comment: params.employeeComment,
  };

  try {
    const preview = await request({ ...basePayload, confirm: false });
    if (!preview.response.ok || preview.data.ok !== true) {
      return { ok: false, path, durationMs: Date.now() - startedAt, document: null, receiptDocument: null, pairComplete: false, idempotentReplay: false, error: readFirstString(preview.data, ['error_text', 'error']) || `1C API returned HTTP ${preview.response.status}` };
    }
    const existingDocument = normalizeCashExpenseOrderDocument(preview.data.document);
    const existingReceiptDocument = normalizeCashReceiptOrderDocument(preview.data.receipt_document);
    if (preview.data.idempotent_replay === true && existingDocument && existingReceiptDocument && preview.data.pair_complete === true) {
      return { ok: true, path, durationMs: Date.now() - startedAt, document: existingDocument, receiptDocument: existingReceiptDocument, pairComplete: true, idempotentReplay: true };
    }
    const previewToken = readFirstString(preview.data, ['preview_token']);
    if (!previewToken) return { ok: false, path, durationMs: Date.now() - startedAt, document: null, receiptDocument: null, pairComplete: false, idempotentReplay: false, error: '1C preview did not return a confirmation token' };
    const confirmed = await request({ ...basePayload, confirm: true, preview_token: previewToken });
    const document = normalizeCashExpenseOrderDocument(confirmed.data.document);
    const receiptDocument = normalizeCashReceiptOrderDocument(confirmed.data.receipt_document);
    const pairComplete = confirmed.data.pair_complete === true;
    const accepted = confirmed.response.ok
      && confirmed.data.ok === true
      && Boolean(document)
      && Boolean(receiptDocument)
      && document?.posted === true
      && receiptDocument?.posted === true
      && pairComplete;
    return {
      ok: accepted,
      path,
      durationMs: Date.now() - startedAt,
      document,
      receiptDocument,
      pairComplete,
      idempotentReplay: confirmed.data.idempotent_replay === true,
      error: accepted ? undefined : readFirstString(confirmed.data, ['error_text', 'error']) || (confirmed.response.ok ? '1C did not confirm a complete posted RKO/PKO pair' : `1C API returned HTTP ${confirmed.response.status}`),
    };
  } catch (error) {
    return { ok: false, path, durationMs: Date.now() - startedAt, document: null, receiptDocument: null, pairComplete: false, idempotentReplay: false, error: formatError(error) };
  }
}

async function requestCashExpenseOrderPreview(config: OneCConfig, params: CreateOneCCashExpenseOrderParams): Promise<PreviewOneCCashExpenseOrderResult> {
  const startedAt = Date.now();
  const path = '/cash-expense-order-create';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(config.timeoutMs, 15_000));
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: buildAuthHeader(config) },
      body: JSON.stringify({
        idempotency_key: params.idempotencyKey,
        organization_ref: params.organizationRef,
        cashbox_ref: params.cashboxRef,
        target_cashbox_ref: params.targetCashboxRef,
        employee_name: params.employeeName,
        amount: params.amount,
        direction: params.direction,
        employee_comment: params.employeeComment,
        confirm: false,
      }),
      cache: 'no-store', signal: controller.signal,
    });
    const data = readRecord(await readResponseBody(response)) ?? {};
    const document = normalizeCashExpenseOrderDocument(data.document);
    const receiptDocument = normalizeCashReceiptOrderDocument(data.receipt_document);
    return {
      ok: response.ok && data.ok === true,
      path, durationMs: Date.now() - startedAt, document, receiptDocument,
      pairComplete: data.pair_complete === true,
      idempotentReplay: data.idempotent_replay === true,
      confirmationRequired: Boolean(readFirstString(data, ['preview_token'])),
      error: response.ok && data.ok === true ? undefined : readFirstString(data, ['error_text', 'error']) || `1C API returned HTTP ${response.status}`,
    };
  } catch (error) {
    return { ok: false, path, durationMs: Date.now() - startedAt, document: null, receiptDocument: null, pairComplete: false, idempotentReplay: false, confirmationRequired: false, error: formatError(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestSalesRealizations(config: OneCConfig, params: SalesRealizationsParams): Promise<OneCSalesRealizationsResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const path = '/sales-realizations';
  const query = new URLSearchParams({
    date_from: params.dateFrom,
    date_to: params.dateTo,
    customer_ref: params.customerRef,
    posted: params.posted,
    limit: String(params.limit),
    offset: String(params.offset),
    include_lines: String(params.includeLines),
  });

  try {
    const response = await fetch(`${config.baseUrl}${path}?${query.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
        Authorization: buildAuthHeader(config),
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await readResponseBody(response);
    const durationMs = Date.now() - startedAt;
    const payload = findDocumentsPayload(data);
    const totals = readSalesTotals(data);

    if (!response.ok) {
      return {
        ok: false,
        path,
        status: response.status,
        durationMs,
        checkedAt: new Date().toISOString(),
        params,
        documents: [],
        totalDocuments: null,
        totalAmount: null,
        hasMore: false,
        responseDocumentCount: 0,
        error: `1C API returned HTTP ${response.status}`,
        diagnostics: payload.diagnostics,
      };
    }

    return {
      ok: payload.diagnostics.length === 0 || payload.documents.length > 0,
      path,
      status: response.status,
      durationMs,
      checkedAt: new Date().toISOString(),
      params,
      documents: payload.documents,
      totalDocuments: totals.totalDocuments,
      totalAmount: totals.totalAmount,
      hasMore: totals.hasMore,
      responseDocumentCount: payload.documents.length,
      diagnostics: payload.diagnostics,
    };
  } catch (error) {
    return {
      ok: false,
      path,
      durationMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      params,
      documents: [],
      totalDocuments: null,
      totalAmount: null,
      hasMore: false,
      responseDocumentCount: 0,
      error: formatError(error),
      diagnostics: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestSalesRealizationLinks(config: OneCConfig, realizationRef: string): Promise<OneCSalesRealizationLinksResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const path = '/sales-realization-links';
  const query = new URLSearchParams({ realization_ref: realizationRef });

  try {
    const response = await fetch(`${config.baseUrl}${path}?${query.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
        Authorization: buildAuthHeader(config),
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await readResponseBody(response);
    const durationMs = Date.now() - startedAt;
    const payload = normalizeSalesRealizationLinksPayload(data);

    if (!response.ok) {
      return {
        ok: false,
        path,
        status: response.status,
        durationMs,
        checkedAt: new Date().toISOString(),
        realizationRef,
        links: null,
        error: `1C API returned HTTP ${response.status}`,
        diagnostics: payload.diagnostics,
      };
    }

    return {
      ok: Boolean(payload.links),
      path,
      status: response.status,
      durationMs,
      checkedAt: new Date().toISOString(),
      realizationRef,
      links: payload.links,
      diagnostics: payload.diagnostics,
    };
  } catch (error) {
    return {
      ok: false,
      path,
      durationMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      realizationRef,
      links: null,
      error: formatError(error),
      diagnostics: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestSalesRealizationFiscalOperations(
  config: OneCConfig,
  realizationRef: string,
): Promise<OneCSalesRealizationFiscalOperationsResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const path = '/sales-realization-fiscal-operations';
  const query = new URLSearchParams({ realization_ref: realizationRef });

  try {
    const response = await fetch(`${config.baseUrl}${path}?${query.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
        Authorization: buildAuthHeader(config),
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await readResponseBody(response);
    const durationMs = Date.now() - startedAt;
    const payload = findSalesRealizationFiscalOperationsPayload(data);

    if (!response.ok) {
      return {
        ok: false,
        path,
        status: response.status,
        durationMs,
        checkedAt: new Date().toISOString(),
        realizationRef,
        found: false,
        fiscalized: false,
        operations: [],
        error: `1C API returned HTTP ${response.status}`,
        diagnostics: payload.diagnostics,
      };
    }

    return {
      ok: true,
      path,
      status: response.status,
      durationMs,
      checkedAt: new Date().toISOString(),
      realizationRef,
      ...payload,
    };
  } catch (error) {
    return {
      ok: false,
      path,
      durationMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      realizationRef,
      found: false,
      fiscalized: false,
      operations: [],
      error: formatError(error),
      diagnostics: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestEndpoint(config: OneCConfig, endpoint: OneCEndpoint): Promise<OneCEndpointResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const path = `/${endpoint}` as const;

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
        Authorization: buildAuthHeader(config),
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await readResponseBody(response);
    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      return {
        ok: false,
        path,
        status: response.status,
        durationMs,
        data,
        error: `1C API returned HTTP ${response.status}`,
      };
    }

    return { ok: true, path, status: response.status, durationMs, data };
  } catch (error) {
    return {
      ok: false,
      path,
      durationMs: Date.now() - startedAt,
      data: null,
      error: formatError(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractEnvironment(info: unknown) {
  if (!info || typeof info !== 'object' || Array.isArray(info)) return null;
  const source = info as Record<string, unknown>;
  return source.environment ?? source.env ?? source.stage ?? null;
}

export async function getAIAgentHealth(): Promise<OneCHealthResult> {
  const now = Date.now();
  if (cachedHealth && cachedHealth.expiresAt > now) {
    return { ...cachedHealth.value, cached: true };
  }

  const config = getConfig();
  const missingConfig = getMissingConfig(config);

  if (missingConfig.length) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      baseUrlConfigured: Boolean(config.baseUrl),
      timeoutMs: config.timeoutMs,
      cacheTtlSeconds: config.cacheTtlSeconds,
      cached: false,
      endpoints: {
        ping: { ok: false, path: '/ping', durationMs: 0, data: null, error: '1C API configuration is incomplete' },
        version: { ok: false, path: '/version', durationMs: 0, data: null, error: '1C API configuration is incomplete' },
        info: { ok: false, path: '/info', durationMs: 0, data: null, error: '1C API configuration is incomplete' },
      },
      environment: null,
      errors: [`Missing env: ${missingConfig.join(', ')}`],
    };
  }

  const [ping, version, info] = await Promise.all([
    requestEndpoint(config, 'ping'),
    requestEndpoint(config, 'version'),
    requestEndpoint(config, 'info'),
  ]);
  const endpoints = { ping, version, info };
  const errors = Object.values(endpoints)
    .filter((result) => !result.ok)
    .map((result) => `${result.path}: ${result.error ?? 'request failed'}`);
  const value: OneCHealthResult = {
    ok: errors.length === 0,
    checkedAt: new Date().toISOString(),
    baseUrlConfigured: true,
    timeoutMs: config.timeoutMs,
    cacheTtlSeconds: config.cacheTtlSeconds,
    cached: false,
    endpoints,
    environment: extractEnvironment(info.data) ?? readOneCRuntimeEnv().nodeEnv ?? null,
    errors,
  };

  if (config.cacheTtlSeconds > 0) {
    cachedHealth = {
      expiresAt: now + config.cacheTtlSeconds * 1000,
      value,
    };
  }

  return value;
}

export async function getSalesRealizations(
  params: SalesRealizationsParams = DEFAULT_SALES_REALIZATIONS_PARAMS,
): Promise<OneCSalesRealizationsResult> {
  const config = getConfig();
  const missingConfig = getMissingConfig(config);

  if (missingConfig.length) {
    return {
      ok: false,
      path: '/sales-realizations',
      durationMs: 0,
      checkedAt: new Date().toISOString(),
      params,
      documents: [],
      totalDocuments: null,
      totalAmount: null,
      hasMore: false,
      responseDocumentCount: 0,
      error: '1C API configuration is incomplete',
      diagnostics: [`Missing env: ${missingConfig.join(', ')}`],
    };
  }

  return requestSalesRealizations(config, params);
}

export async function getPayrollSalesFacts(params: PayrollSalesFactsParams): Promise<OneCPayrollSalesFactsResult> {
  const normalizedParams: Required<PayrollSalesFactsParams> = {
    dateFrom: params.dateFrom.trim(),
    dateTo: params.dateTo.trim(),
    pageSize: Math.max(1, Math.min(Math.trunc(params.pageSize ?? 1000), 1000)),
    maxPages: Math.max(1, Math.min(Math.trunc(params.maxPages ?? 100), 100)),
  };
  const baseResult = {
    path: '/payroll-sales-facts' as const,
    checkedAt: new Date().toISOString(),
    params: normalizedParams,
  };
  const config = getConfig();
  const missingConfig = getMissingConfig(config);

  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (!validDate(normalizedParams.dateFrom) || !validDate(normalizedParams.dateTo) || normalizedParams.dateFrom > normalizedParams.dateTo || normalizedParams.dateTo > today || Date.parse(normalizedParams.dateTo) - Date.parse(normalizedParams.dateFrom) > 30 * 86400000 || !Number.isFinite(normalizedParams.pageSize) || !Number.isFinite(normalizedParams.maxPages)) {
    return {
      ...baseResult,
      ok: false,
      contractVersion: '',
      extractedAt: '',
      periodComplete: false,
      pages: 0,
      rows: [],
      diagnostics: [],
      error: 'dateFrom and dateTo must use YYYY-MM-DD',
    };
  }

  if (missingConfig.length) {
    return {
      ...baseResult,
      ok: false,
      contractVersion: '',
      extractedAt: '',
      periodComplete: false,
      pages: 0,
      rows: [],
      diagnostics: [`Missing env: ${missingConfig.join(', ')}`],
      error: '1C API configuration is incomplete',
    };
  }

  const rows: OneCPayrollSalesFact[] = [];
  const diagnostics: string[] = [];
  const keys = new Set<string>();
  let cursor = '';
  let pages = 0;
  let contractVersion = '';
  let extractedAt = '';
  let periodComplete = false;
  const expectedContractVersion = 'payroll-sales-facts-v2';
  const cursors = new Set<string>();

  while (pages < normalizedParams.maxPages) {
    const page = await requestPayrollSalesFactsPage(config, {
      dateFrom: normalizedParams.dateFrom,
      dateTo: normalizedParams.dateTo,
      pageSize: normalizedParams.pageSize,
      cursor,
    });
    pages += 1;
    diagnostics.push(...page.diagnostics);

    if (!page.ok) {
      return {
        ...baseResult,
        ok: false,
        contractVersion: page.contractVersion || contractVersion,
        extractedAt: page.extractedAt || extractedAt,
        periodComplete,
        pages,
        rows: [],
        diagnostics,
        error: page.status === 404
          ? 'В рабочей 1С ещё не установлен read-only источник зарплатных данных.'
          : page.error || 'Не удалось прочитать зарплатные данные из 1С.',
      };
    }

    if (page.contractVersion !== expectedContractVersion) {
      return {
        ...baseResult,
        ok: false,
        contractVersion: page.contractVersion,
        extractedAt: page.extractedAt || extractedAt,
        periodComplete: page.periodComplete,
        pages,
        rows: [],
        diagnostics,
        error: `1C returned unsupported payroll contract ${page.contractVersion || 'без версии'}; expected ${expectedContractVersion}.`,
      };
    }

    if (pages > 1 && page.periodComplete !== periodComplete) {
      return {
        ...baseResult, ok: false, contractVersion: page.contractVersion,
        extractedAt: page.extractedAt || extractedAt, periodComplete: false,
        pages, rows: [], diagnostics,
        error: 'Страницы 1С сообщают разную готовность периода. Сверка остановлена; загрузите данные заново.',
      };
    }

    contractVersion = page.contractVersion || contractVersion;
    extractedAt = page.extractedAt || extractedAt;
    periodComplete = page.periodComplete;

    for (const row of page.rows) {
      const key = `${row.period}|${row.recorderRef}|${row.lineNumber}`;
      if (keys.has(key)) {
        return { ...baseResult, ok: false, contractVersion, extractedAt, periodComplete, pages, rows: [], diagnostics, error: 'Повтор строки источника. Сверка остановлена.' };
      }
      keys.add(key);
      rows.push(row);
    }

    if (page.complete) {
      return {
        ...baseResult,
        ok: true,
        contractVersion,
        extractedAt,
        periodComplete,
        pages,
        rows,
        diagnostics,
      };
    }

    if (!page.nextCursor || page.nextCursor === cursor || cursors.has(page.nextCursor)) {
      return {
        ...baseResult,
        ok: false,
        contractVersion,
        extractedAt,
        periodComplete,
        pages,
        rows: [],
        diagnostics,
        error: '1C вернула незавершённую страницу без корректного продолжения.',
      };
    }
    cursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }

  return {
    ...baseResult,
    ok: false,
    contractVersion,
    extractedAt,
    periodComplete,
    pages,
    rows: [],
    diagnostics,
    error: `Превышен безопасный лимит страниц (${normalizedParams.maxPages}).`,
  };
}

export async function getPayrollSalesReport(params: PayrollSalesReportParams): Promise<OneCPayrollSalesReportResult> {
  const facts = await getPayrollSalesFacts(params);
  return {
    ...facts,
    rows: facts.ok ? facts.rows.map((row) => ({
      ...row,
      cost: row.reportCost,
      grossProfit: row.reportGrossProfit,
    })) : [],
  };
}

export async function getSalesRealizationLinks(realizationRef: string): Promise<OneCSalesRealizationLinksResult> {
  const normalizedRef = realizationRef.trim();
  const config = getConfig();
  const missingConfig = getMissingConfig(config);

  if (!normalizedRef) {
    return {
      ok: false,
      path: '/sales-realization-links',
      durationMs: 0,
      checkedAt: new Date().toISOString(),
      realizationRef,
      links: null,
      error: 'realization_ref is required',
      diagnostics: ['Missing realization_ref'],
    };
  }

  if (missingConfig.length) {
    return {
      ok: false,
      path: '/sales-realization-links',
      durationMs: 0,
      checkedAt: new Date().toISOString(),
      realizationRef: normalizedRef,
      links: null,
      error: '1C API configuration is incomplete',
      diagnostics: [`Missing env: ${missingConfig.join(', ')}`],
    };
  }

  return requestSalesRealizationLinks(config, normalizedRef);
}

export async function getSalesRealizationFiscalOperations(
  realizationRef: string,
): Promise<OneCSalesRealizationFiscalOperationsResult> {
  const normalizedRef = realizationRef.trim();
  const config = getConfig();
  const missingConfig = getMissingConfig(config);

  if (!normalizedRef || missingConfig.length) {
    return {
      ok: false,
      path: '/sales-realization-fiscal-operations',
      durationMs: 0,
      checkedAt: new Date().toISOString(),
      realizationRef: normalizedRef,
      found: false,
      fiscalized: false,
      operations: [],
      error: !normalizedRef ? 'realization_ref is required' : '1C API configuration is incomplete',
      diagnostics: !normalizedRef ? ['Missing realization_ref'] : [`Missing env: ${missingConfig.join(', ')}`],
    };
  }

  return requestSalesRealizationFiscalOperations(config, normalizedRef);
}

export async function getCashStatementDimensions(): Promise<OneCCashStatementDimensionsResult> {
  const config = getConfig();
  const missingConfig = getMissingConfig(config);

  if (missingConfig.length) {
    return {
      ok: false,
      path: '/cash-statement-dimensions',
      durationMs: 0,
      checkedAt: new Date().toISOString(),
      organizations: [],
      cashboxes: [],
      error: '1C API configuration is incomplete',
      diagnostics: [`Missing env: ${missingConfig.join(', ')}`],
    };
  }

  return requestCashStatementDimensions(config);
}

export async function getCashStatementSummary(
  params: OneCCashStatementSummaryParams,
): Promise<OneCCashStatementSummaryResult> {
  const config = getConfig();
  const missingConfig = getMissingConfig(config);

  if (missingConfig.length) {
    return {
      ok: false,
      path: '/cash-statement-summary',
      durationMs: 0,
      checkedAt: new Date().toISOString(),
      params,
      register: '',
      date: params.date,
      cashbox: null,
      organization: null,
      openingBalance: null,
      incomingTotal: null,
      outgoingTotal: null,
      closingBalance: null,
      movements: [],
      movementsCount: 0,
      error: '1C API configuration is incomplete',
      diagnostics: [`Missing env: ${missingConfig.join(', ')}`],
    };
  }

  return requestCashStatementSummary(config, params);
}

export async function getKkmEquipmentDiagnostics(
  params: OneCKkmEquipmentDiagnosticsParams,
): Promise<OneCKkmEquipmentDiagnosticsResult> {
  const config = getConfig();
  const missingConfig = getMissingConfig(config);

  if (missingConfig.length) {
    return {
      ok: false,
      path: '/kkm-equipment-diagnostics',
      durationMs: 0,
      checkedAt: new Date().toISOString(),
      params,
      recentChecks: [],
      cashRegisterUsage: [],
      acquiringTerminalUsage: [],
      catalogCashRegisters: [],
      catalogAcquiringTerminals: [],
      warnings: [],
      error: '1C API configuration is incomplete',
      diagnostics: [`Missing env: ${missingConfig.join(', ')}`],
    };
  }

  return requestKkmEquipmentDiagnostics(config, params);
}

export async function getCashShifts(dateFrom: string, dateTo = dateFrom): Promise<OneCCashShiftsResult> {
  const config = getConfig();
  const missingConfig = getMissingConfig(config);
  if (missingConfig.length) {
    return {
      ok: false,
      path: '/cash-shifts',
      durationMs: 0,
      checkedAt: new Date().toISOString(),
      dateFrom,
      dateTo,
      shifts: [],
      warnings: [],
      error: '1C API configuration is incomplete',
      diagnostics: [`Missing env: ${missingConfig.join(', ')}`],
    };
  }
  return requestCashShifts(config, dateFrom, dateTo);
}

export async function createOneCCashExpenseOrder(params: CreateOneCCashExpenseOrderParams): Promise<CreateOneCCashExpenseOrderResult> {
  const config = getConfig();
  const missingConfig = getMissingConfig(config);
  if (missingConfig.length) return { ok: false, path: '/cash-expense-order-create', durationMs: 0, document: null, receiptDocument: null, pairComplete: false, idempotentReplay: false, error: '1C API configuration is incomplete' };
  return requestCashExpenseOrder(config, params);
}

export async function previewOneCCashExpenseOrder(params: CreateOneCCashExpenseOrderParams): Promise<PreviewOneCCashExpenseOrderResult> {
  const config = getConfig();
  const missingConfig = getMissingConfig(config);
  if (missingConfig.length) return { ok: false, path: '/cash-expense-order-create', durationMs: 0, document: null, receiptDocument: null, pairComplete: false, idempotentReplay: false, confirmationRequired: false, error: '1C API configuration is incomplete' };
  return requestCashExpenseOrderPreview(config, params);
}
