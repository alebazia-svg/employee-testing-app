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
