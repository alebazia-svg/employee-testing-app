import 'server-only';
import { readOneCRuntimeEnv } from '@/lib/one-c-env';

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
  organizationInn: string;
  partnerName: string;
  counterpartyName: string;
  warehouseName: string;
  managerName: string;
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
  ref: string;
  name: string;
  number: string;
  date: string;
  posted: boolean | null;
  amount: number | null;
  organizationName: string;
  partnerName: string;
  counterpartyName: string;
  managerName: string;
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
  idempotentReplay: boolean;
  error?: string;
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

function normalizeOneCDateTime(value: string) {
  const match = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) return value;
  const [, day, month, year, hour, minute, second] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:${second}+03:00`;
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
  return {
    ref: readFirstString(source, ['ref', 'document_ref', 'documentRef', 'id', 'guid']),
    number: readFirstString(source, ['number', 'doc_number', 'docNumber', 'document_number', 'documentNumber']),
    date: readFirstString(source, ['date', 'doc_date', 'docDate', 'document_date', 'documentDate']),
    posted: readFirstBoolean(source, ['posted', 'is_posted', 'isPosted']),
    deletionMark: readFirstBoolean(source, ['deletion_mark', 'deletionMark', 'deleted', 'is_deleted', 'isDeleted']),
    amount: readFirstNumber(source, ['amount', 'sum', 'total', 'document_amount', 'documentAmount']),
    currency: readFirstString(source, ['currency', 'currency_code', 'currencyCode']),
    organizationName: readFirstString(source, ['organization_name', 'organizationName']) || readName(source.organization),
    organizationInn: readFirstString(source, ['organization_inn', 'organizationInn', 'inn']),
    partnerName: readFirstString(source, ['partner_name', 'partnerName']) || readName(source.partner),
    counterpartyName: readFirstString(source, ['counterparty_name', 'counterpartyName', 'customer_name', 'customerName']) || readName(source.counterparty),
    warehouseName: readFirstString(source, ['warehouse_name', 'warehouseName']) || readName(source.warehouse),
    managerName: readFirstString(source, ['manager_name', 'managerName']) || readName(source.manager),
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

  return {
    documentType: readFirstString(source, ['document_type', 'documentType', 'type']),
    matchType: readFirstString(source, ['match_type', 'matchType']),
    matchReasons: reasons,
    ref: readFirstString(source, ['ref', 'document_ref', 'documentRef', 'id', 'guid']),
    name: readFirstString(source, ['name', 'presentation', 'description']),
    number: readFirstString(source, ['number', 'doc_number', 'docNumber', 'document_number', 'documentNumber']),
    date: readFirstString(source, ['date', 'doc_date', 'docDate', 'document_date', 'documentDate']),
    posted: readFirstBoolean(source, ['posted', 'is_posted', 'isPosted']),
    amount: readFirstNumber(source, ['amount', 'sum', 'total', 'document_amount', 'documentAmount']),
    organizationName: readFirstString(source, ['organization_name', 'organizationName']) || readName(source.organization),
    partnerName: readFirstString(source, ['partner_name', 'partnerName']) || readName(source.partner),
    counterpartyName: readFirstString(source, ['counterparty_name', 'counterpartyName', 'customer_name', 'customerName']) || readName(source.counterparty),
    managerName: readFirstString(source, ['manager_name', 'managerName']) || readName(source.manager),
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

function findSalesRealizationLinksPayload(data: unknown): { links: OneCSalesRealizationLinks | null; diagnostics: string[] } {
  const root = readRecord(data);
  if (!root) return { links: null, diagnostics: ['Ответ 1С не похож на JSON-объект.'] };

  const nestedData = readRecord(root.data);
  const payload = nestedData ?? root;
  const linksRoot = readRecord(payload.links) ?? payload;
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
      return { ok: false, path, durationMs: Date.now() - startedAt, document: null, idempotentReplay: false, error: readFirstString(preview.data, ['error_text', 'error']) || `1C API returned HTTP ${preview.response.status}` };
    }
    const existingDocument = normalizeCashExpenseOrderDocument(preview.data.document);
    if (preview.data.idempotent_replay === true && existingDocument) {
      return { ok: true, path, durationMs: Date.now() - startedAt, document: existingDocument, idempotentReplay: true };
    }
    const previewToken = readFirstString(preview.data, ['preview_token']);
    if (!previewToken) return { ok: false, path, durationMs: Date.now() - startedAt, document: null, idempotentReplay: false, error: '1C preview did not return a confirmation token' };
    const confirmed = await request({ ...basePayload, confirm: true, preview_token: previewToken });
    const document = normalizeCashExpenseOrderDocument(confirmed.data.document);
    return {
      ok: confirmed.response.ok && confirmed.data.ok === true && Boolean(document) && document?.posted !== true,
      path,
      durationMs: Date.now() - startedAt,
      document,
      idempotentReplay: confirmed.data.idempotent_replay === true,
      error: confirmed.response.ok && confirmed.data.ok === true ? undefined : readFirstString(confirmed.data, ['error_text', 'error']) || `1C API returned HTTP ${confirmed.response.status}`,
    };
  } catch (error) {
    return { ok: false, path, durationMs: Date.now() - startedAt, document: null, idempotentReplay: false, error: formatError(error) };
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
    const payload = findSalesRealizationLinksPayload(data);

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
  if (missingConfig.length) return { ok: false, path: '/cash-expense-order-create', durationMs: 0, document: null, idempotentReplay: false, error: '1C API configuration is incomplete' };
  return requestCashExpenseOrder(config, params);
}
