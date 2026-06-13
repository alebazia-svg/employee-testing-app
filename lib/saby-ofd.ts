import 'server-only';
import process from 'node:process';

type ProbeStepStatus = 'skipped' | 'ok' | 'failed';

type ProbeStep = {
  name: string;
  status: ProbeStepStatus;
  durationMs?: number;
  path?: string;
  method?: string;
  responseKeys?: string[];
  sample?: unknown;
  error?: string;
};

type SelectedFiscalDocument = {
  wrapperKey: string;
  document: JsonRecord;
};

type ReceiptIssueSeverity = 'needs_review' | 'error';

type ReceiptIssue = {
  code: string;
  severity: ReceiptIssueSeverity;
  message: string;
  expectedPaymentType?: string;
  actualPaymentTypes?: unknown[];
  itemIndexes?: number[];
  rule: string;
};

type SabyOfdProbeOptions = {
  organizationInn?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

type DateWindow = {
  dateFrom: Date;
  dateTo: Date;
};

type ReceiptAnalysisResult = ReturnType<typeof analyzeSabyReceipt>;

type AnalyzedReceipt = {
  fiscalDocumentNumber: string;
  fiscalDriveNumber: string;
  fiscalSign: string;
  date: string;
  totalSum: number;
  cashTotalSum: number;
  ecashTotalSum: number;
  creditSum: number;
  rawPaymentTypes: unknown[];
  normalizedPaymentTypes: unknown[];
  matchedRule: string | null;
  issues: ReceiptIssue[];
};

type FullReceiptProbeResult = {
  receipt: JsonRecord;
  analysis: ReceiptAnalysisResult;
  summary: AnalyzedReceipt;
  wrapperKey: string;
};

type AuthResult = {
  step: ProbeStep;
  accessToken: string;
  sid: string;
};

type SabyOfdConfig = {
  enabled: boolean;
  baseUrl: string;
  appClientId: string;
  appSecret: string;
  secretKey: string;
  requestTimeoutMs: number;
};

type JsonRecord = Record<string, unknown>;

const TOKEN_PATH = '/oauth/service/';
const OFD_API_BASE_URL = 'https://api.saby.ru';
const MAX_SAMPLE_DEPTH = 3;
const REDACTED = '[redacted]';

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  '4': 'full_payment',
  '5': 'partial_payment_and_credit',
  '6': 'transfer_on_credit',
  '7': 'credit_payment',
};

function readConfig(): SabyOfdConfig {
  const requestTimeoutMs = Number(process.env.SABY_OFD_REQUEST_TIMEOUT_MS ?? 10000);

  return {
    enabled: process.env.SABY_OFD_ENABLED === 'true',
    baseUrl: (process.env.SABY_OFD_BASE_URL ?? 'https://online.sbis.ru').trim().replace(/\/+$/, ''),
    appClientId: (process.env.SABY_OFD_APP_CLIENT_ID ?? '').trim(),
    appSecret: process.env.SABY_OFD_APP_SECRET ?? '',
    secretKey: process.env.SABY_OFD_SECRET_KEY ?? '',
    requestTimeoutMs: Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0 ? requestTimeoutMs : 10000,
  };
}

function missingConfig(config: SabyOfdConfig) {
  const missing: string[] = [];
  if (!config.enabled) missing.push('SABY_OFD_ENABLED');
  if (!config.baseUrl) missing.push('SABY_OFD_BASE_URL');
  if (!config.appClientId) missing.push('SABY_OFD_APP_CLIENT_ID');
  if (!config.appSecret) missing.push('SABY_OFD_APP_SECRET');
  if (!config.secretKey) missing.push('SABY_OFD_SECRET_KEY');
  return missing;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function responseKeys(value: unknown) {
  if (Array.isArray(value)) return value[0] && isRecord(value[0]) ? Object.keys(value[0]).slice(0, 30) : [];
  return isRecord(value) ? Object.keys(value).slice(0, 30) : [];
}

function isSensitiveKey(key: string) {
  return /(sid|token|secret|password|phone|tel|email|mail|buyer|customer|address)/i.test(key);
}

function isFiscalIdentityKey(key: string) {
  return /^(fiscalDocumentNumber|fiscalDriveNumber|fiscalSign|fpd|fd|fn)$/i.test(key);
}

function sanitizeSample(value: unknown, depth = 0, key = ''): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (!isFiscalIdentityKey(key) && (/\d{7,}/.test(value) || value.includes('@'))) return REDACTED;
    return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  }
  if (typeof value === 'number') return Math.round(value * 100) / 100;
  if (typeof value === 'boolean') return value;
  if (depth >= MAX_SAMPLE_DEPTH) return Array.isArray(value) ? '[array]' : '[object]';
  if (Array.isArray(value)) return value.slice(0, 3).map((item) => sanitizeSample(item, depth + 1, key));
  if (!isRecord(value)) return '[unknown]';

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 20)
      .map(([entryKey, entry]) => [entryKey, isSensitiveKey(entryKey) ? REDACTED : sanitizeSample(entry, depth + 1, entryKey)])
  );
}

function extractAccessToken(payload: unknown) {
  if (!isRecord(payload)) return '';
  const candidates = [
    payload.access_token,
    payload.accessToken,
    payload.token,
    isRecord(payload.result) ? payload.result.access_token : undefined,
    isRecord(payload.result) ? payload.result.accessToken : undefined,
    isRecord(payload.result) ? payload.result.token : undefined,
  ];
  return candidates.find((value): value is string => typeof value === 'string' && value.length > 0) ?? '';
}

function extractSid(payload: unknown) {
  if (!isRecord(payload)) return '';
  const candidates = [
    payload.sid,
    isRecord(payload.result) ? payload.result.sid : undefined,
  ];
  return candidates.find((value): value is string => typeof value === 'string' && value.length > 0) ?? '';
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { text: text.slice(0, 500) };
      }
    }

    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function tokenRequest(config: SabyOfdConfig, contentType: 'json' | 'form') {
  const url = `${config.baseUrl}${TOKEN_PATH}`;
  const body =
    contentType === 'json'
      ? JSON.stringify({
          app_client_id: config.appClientId,
          app_secret: config.appSecret,
          secret_key: config.secretKey,
        })
      : new URLSearchParams({
          app_client_id: config.appClientId,
          app_secret: config.appSecret,
          secret_key: config.secretKey,
        }).toString();

  return fetchJson(
    url,
    {
      method: 'POST',
      headers: {
        'content-type': contentType === 'json' ? 'application/json; charset=utf-8' : 'application/x-www-form-urlencoded; charset=utf-8',
        accept: 'application/json',
      },
      body,
    },
    config.requestTimeoutMs
  );
}

async function getAccessToken(config: SabyOfdConfig): Promise<AuthResult> {
  const startedAt = Date.now();

  for (const contentType of ['json', 'form'] as const) {
    const { response, data } = await tokenRequest(config, contentType);
    const accessToken = extractAccessToken(data);
    const sid = extractSid(data);
    if (response.ok && (accessToken || sid)) {
      return {
        accessToken,
        sid,
        step: {
          name: 'auth.service_token',
          status: 'ok',
          durationMs: Date.now() - startedAt,
          path: TOKEN_PATH,
          method: 'POST',
          responseKeys: responseKeys(data).filter((key) => !/sid|token|secret/i.test(key)),
          sample: sanitizeSample(data),
        },
      };
    }

    if (contentType === 'form') {
      return {
        accessToken: '',
        sid: '',
        step: {
          name: 'auth.service_token',
          status: 'failed',
          durationMs: Date.now() - startedAt,
          path: TOKEN_PATH,
          method: 'POST',
          responseKeys: responseKeys(data).filter((key) => !/sid|token|secret/i.test(key)),
          sample: sanitizeSample(data),
          error: `Saby token request failed with HTTP ${response.status}`,
        },
      };
    }
  }

  return {
    accessToken: '',
    sid: '',
    step: {
      name: 'auth.service_token',
      status: 'failed',
      durationMs: Date.now() - startedAt,
      path: TOKEN_PATH,
      method: 'POST',
      error: 'Saby token response did not contain an access token or sid',
    },
  };
}

async function restProbe(
  config: SabyOfdConfig,
  auth: { sid: string; accessToken: string },
  path: string,
  stepName: string
): Promise<{ step: ProbeStep; data: unknown }> {
  const startedAt = Date.now();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'application/json',
  };
  if (auth.sid) headers.Cookie = `sid=${auth.sid}`;
  if (auth.accessToken) headers['X-SBISAccessToken'] = auth.accessToken;

  const { response, data } = await fetchJson(
    `${OFD_API_BASE_URL}${path}`,
    {
      method: 'GET',
      headers,
    },
    config.requestTimeoutMs
  );

  return {
    data,
    step: {
      name: stepName,
      status: response.ok ? 'ok' : 'failed',
      durationMs: Date.now() - startedAt,
      path,
      method: 'GET',
      responseKeys: responseKeys(data),
      sample: sanitizeSample(data),
      error: response.ok ? undefined : `HTTP ${response.status}`,
    },
  };
}

function readStringField(value: unknown, keys: string[]) {
  if (!isRecord(value)) return '';
  for (const key of keys) {
    const entry = value[key];
    if (typeof entry === 'string' && entry.trim()) return entry.trim();
    if (typeof entry === 'number' && Number.isFinite(entry)) return String(entry);
  }
  return '';
}

function listItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  for (const key of ['result', 'data', 'items', 'kkts', 'documents']) {
    const entry = value[key];
    if (Array.isArray(entry)) return entry;
  }
  return Object.keys(value).length ? [value] : [];
}

function firstItem(value: unknown) {
  return listItems(value)[0];
}

function selectedFiscalDocument(value: unknown): SelectedFiscalDocument | null {
  const items = listItems(value);
  const receipts: SelectedFiscalDocument[] = [];

  for (const item of items) {
    if (!isRecord(item)) continue;
    for (const [wrapperKey, document] of Object.entries(item)) {
      if (isRecord(document)) {
        const selected = { wrapperKey, document };
        if (wrapperKey === 'receipt') receipts.push(selected);
      }
    }
  }

  const creditReceipt = receipts.find(({ document }) => Number(document.creditSum) > 0);
  if (creditReceipt) return creditReceipt;
  if (receipts[0]) return receipts[0];

  for (const item of items) {
    if (!isRecord(item)) continue;
    const [wrapperKey, document] = Object.entries(item).find(([, entry]) => isRecord(entry)) ?? [];
    if (wrapperKey && isRecord(document)) return { wrapperKey, document };
  }

  return null;
}

function receiptDocuments(value: unknown): SelectedFiscalDocument[] {
  const receipts: SelectedFiscalDocument[] = [];

  for (const item of listItems(value)) {
    if (!isRecord(item)) continue;
    const receipt = item.receipt;
    if (isRecord(receipt)) receipts.push({ wrapperKey: 'receipt', document: receipt });
  }

  return receipts;
}

function findFirstString(value: unknown, patterns: RegExp[]): string {
  if (typeof value === 'string' && patterns.some((pattern) => pattern.test(value))) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstString(item, patterns);
      if (found) return found;
    }
  }
  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (patterns.some((pattern) => pattern.test(key)) && typeof entry === 'string') return entry;
      const found = findFirstString(entry, patterns);
      if (found) return found;
    }
  }
  return '';
}

function formatSabyDate(date: Date) {
  return date.toISOString().slice(0, 19);
}

function parseProbeDate(value: string | undefined, endOfDay: boolean) {
  if (!value) return null;
  const normalized = value.includes('T') ? value : `${value}T${endOfDay ? '23:59:59' : '00:00:00'}`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function probeDateRange(options: SabyOfdProbeOptions) {
  const fallbackDateTo = new Date();
  const fallbackDateFrom = new Date(fallbackDateTo.getTime() - 6 * 24 * 60 * 60 * 1000);
  const dateFrom = parseProbeDate(options.dateFrom, false) ?? fallbackDateFrom;
  const dateTo = parseProbeDate(options.dateTo, true) ?? fallbackDateTo;
  return dateFrom <= dateTo ? { dateFrom, dateTo } : { dateFrom: dateTo, dateTo: dateFrom };
}

function dateWindows(dateFrom: Date, dateTo: Date): DateWindow[] {
  const windows: DateWindow[] = [];
  let currentFrom = new Date(dateFrom);

  while (currentFrom <= dateTo) {
    const currentTo = new Date(Math.min(currentFrom.getTime() + 6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59000, dateTo.getTime()));
    windows.push({ dateFrom: currentFrom, dateTo: currentTo });
    currentFrom = new Date(currentTo.getTime() + 1000);
  }

  return windows;
}

function documentListPath(organizationInn: string, regId: string, fsNumber: string, window: DateWindow, queryLimit: number) {
  const params = new URLSearchParams({
    dateFrom: formatSabyDate(window.dateFrom),
    dateTo: formatSabyDate(window.dateTo),
    limit: String(queryLimit),
  });
  return `/ofd/v1/orgs/${encodeURIComponent(organizationInn)}/kkts/${encodeURIComponent(regId)}/storages/${encodeURIComponent(fsNumber)}/docs?${params}`;
}

function fullDocumentPaths(organizationInn: string, regId: string, fsNumber: string, document: JsonRecord) {
  const docNum = readStringField(document, ['fiscalDocumentNumber']);
  const fiscalSign = readStringField(document, ['fiscalSign']);
  const docDate = readStringField(document, ['receiveDateTime', 'dateTime']);
  const paths: string[] = [];

  if (docNum && docDate) {
    const params = new URLSearchParams({ docDate, format: 'json' });
    paths.push(
      `/ofd/v1/orgs/${encodeURIComponent(organizationInn)}/kkts/${encodeURIComponent(regId)}/storages/${encodeURIComponent(fsNumber)}/docs/${encodeURIComponent(docNum)}?${params}`
    );
  }

  if (docNum && fiscalSign && docDate) {
    const params = new URLSearchParams({
      docNum,
      fiscalSign,
      docDate,
      format: 'json',
    });
    paths.push(`/ofd/v1/storage/${encodeURIComponent(fsNumber)}/doc?${params}`);
  }

  return paths;
}

function unwrapFiscalDocument(value: unknown): JsonRecord | null {
  if (!isRecord(value)) return null;
  for (const key of ['receipt', 'openShift', 'closeShift', 'document', 'result']) {
    const entry = value[key];
    if (isRecord(entry)) return entry;
  }
  return value;
}

function fullDocumentSample(value: unknown) {
  const document = unwrapFiscalDocument(value);
  const lines = document && Array.isArray(document.items) ? document.items : [];
  const firstLine = lines.find(isRecord);
  const paymentKeys = document
    ? Object.keys(document).filter((key) => /(cash|ecash|credit|prepaid|provision|consideration|counteroffer|payment|Sum)$/i.test(key))
    : [];

  return {
    topLevelKeys: responseKeys(value),
    documentKeys: document ? Object.keys(document).slice(0, 60) : [],
    lineKeys: firstLine ? Object.keys(firstLine).slice(0, 60) : [],
    paymentKeys,
    analysis: document ? analyzeReceiptForProbe(document) : null,
    hasItems: lines.length > 0,
    itemCount: lines.length,
    sample: sanitizeSample(value),
  };
}

function readAmount(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizePaymentType(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return PAYMENT_TYPE_LABELS[String(value)] ?? String(value);
  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (PAYMENT_TYPE_LABELS[trimmed]) return PAYMENT_TYPE_LABELS[trimmed];
  if (lower.includes('полный расчет') || lower.includes('full')) return 'full_payment';
  if (lower.includes('частичный') && lower.includes('кредит')) return 'partial_payment_and_credit';
  if (lower.includes('передача') && lower.includes('кредит')) return 'transfer_on_credit';
  if (lower.includes('оплата') && lower.includes('кредит')) return 'credit_payment';
  return trimmed;
}

function uniqueValues(values: unknown[]) {
  return Array.from(new Set(values.map((value) => JSON.stringify(value)))).map((value) => JSON.parse(value));
}

function findUnexpectedPaymentTypeItems(items: JsonRecord[], expected: string) {
  return items
    .map((item, index) => ({ index, paymentType: normalizePaymentType(item.paymentType) }))
    .filter((item) => item.paymentType !== expected)
    .map((item) => item.index);
}

export function analyzeSabyReceipt(receipt: JsonRecord) {
  const totalSum = readAmount(receipt.totalSum);
  const creditSum = readAmount(receipt.creditSum);
  const cashTotalSum = readAmount(receipt.cashTotalSum);
  const ecashTotalSum = readAmount(receipt.ecashTotalSum);
  const paidNowSum = cashTotalSum + ecashTotalSum;
  const items = Array.isArray(receipt.items) ? receipt.items.filter(isRecord) : [];
  const rawPaymentTypes = uniqueValues(items.map((item) => item.paymentType));
  const normalizedPaymentTypes = uniqueValues(items.map((item) => normalizePaymentType(item.paymentType)));
  const issues: ReceiptIssue[] = [];

  const creditPaymentIndexes = items
    .map((item, index) => ({ index, paymentType: normalizePaymentType(item.paymentType) }))
    .filter((item) => item.paymentType === 'credit_payment')
    .map((item) => item.index);

  if (creditPaymentIndexes.length > 0) {
    issues.push({
      code: 'payment_type_credit_payment',
      severity: 'needs_review',
      message: 'Item paymentType is credit payment, which is suspicious for sale receipts.',
      actualPaymentTypes: rawPaymentTypes,
      itemIndexes: creditPaymentIndexes,
      rule: 'paymentType=Оплата кредита is always suspicious',
    });
  }

  const expectedByRule =
    creditSum === totalSum && paidNowSum === 0
      ? { paymentType: 'transfer_on_credit', rule: 'creditSum == totalSum and cashTotalSum + ecashTotalSum == 0' }
      : creditSum > 0 && paidNowSum > 0
        ? { paymentType: 'partial_payment_and_credit', rule: 'creditSum > 0 and cashTotalSum + ecashTotalSum > 0' }
        : creditSum === 0 && paidNowSum === totalSum
          ? { paymentType: 'full_payment', rule: 'creditSum == 0 and cashTotalSum + ecashTotalSum == totalSum' }
          : null;

  if (expectedByRule) {
    const itemIndexes = findUnexpectedPaymentTypeItems(items, expectedByRule.paymentType);
    if (itemIndexes.length > 0) {
      issues.push({
        code: 'payment_type_mismatch',
        severity: 'error',
        message: `Receipt payment totals require ${expectedByRule.paymentType}, but some item paymentType values differ.`,
        expectedPaymentType: expectedByRule.paymentType,
        actualPaymentTypes: rawPaymentTypes,
        itemIndexes,
        rule: expectedByRule.rule,
      });
    }
  } else {
    issues.push({
      code: 'payment_totals_unclassified',
      severity: 'needs_review',
      message: 'Receipt payment totals do not match V1 credit/full-payment scenarios.',
      actualPaymentTypes: rawPaymentTypes,
      rule: 'No V1 totals rule matched',
    });
  }

  return {
    totals: {
      totalSum,
      creditSum,
      cashTotalSum,
      ecashTotalSum,
      paidNowSum,
    },
    rawPaymentTypes,
    normalizedPaymentTypes,
    matchedRule: expectedByRule?.rule ?? null,
    expectedPaymentType: expectedByRule?.paymentType ?? null,
    issues,
  };
}

function analyzeReceiptForProbe(receipt: JsonRecord): ReceiptAnalysisResult {
  const operationType = readAmount(receipt.operationType);
  const receiptCode = readAmount(receipt.receiptCode);
  const baseAnalysis = analyzeSabyReceipt(receipt);

  if (operationType !== 1) {
    return {
      ...baseAnalysis,
      matchedRule: null,
      expectedPaymentType: null,
      issues: [
        {
          code: 'non_sale_receipt',
          severity: 'needs_review',
          message: 'Receipt is not a regular sale receipt; refund/correction-like documents are not analyzed by V1 rules.',
          actualPaymentTypes: baseAnalysis.rawPaymentTypes,
          rule: 'operationType is not regular sale',
        },
      ],
    };
  }

  if (receiptCode && receiptCode !== 3) {
    return {
      ...baseAnalysis,
      matchedRule: null,
      expectedPaymentType: null,
      issues: [
        {
          code: 'unusual_receipt_code',
          severity: 'needs_review',
          message: 'Receipt code is not the regular receipt code observed in Saby samples; V1 marks it for review.',
          actualPaymentTypes: baseAnalysis.rawPaymentTypes,
          rule: 'receiptCode is not regular receipt',
        },
      ],
    };
  }

  return baseAnalysis;
}

function analyzedReceiptSummary(receipt: JsonRecord, analysis: ReceiptAnalysisResult): AnalyzedReceipt {
  return {
    fiscalDocumentNumber: readStringField(receipt, ['fiscalDocumentNumber']),
    fiscalDriveNumber: readStringField(receipt, ['fiscalDriveNumber']),
    fiscalSign: readStringField(receipt, ['fiscalSign']),
    date: readStringField(receipt, ['receiveDateTime', 'dateTime']),
    totalSum: readAmount(receipt.totalSum),
    cashTotalSum: readAmount(receipt.cashTotalSum),
    ecashTotalSum: readAmount(receipt.ecashTotalSum),
    creditSum: readAmount(receipt.creditSum),
    rawPaymentTypes: analysis.rawPaymentTypes,
    normalizedPaymentTypes: analysis.normalizedPaymentTypes,
    matchedRule: analysis.matchedRule,
    issues: analysis.issues,
  };
}

function isReturnReceipt(receipt: JsonRecord) {
  return readAmount(receipt.operationType) === 2;
}

function receiptTimestamp(receipt: JsonRecord) {
  const date = readStringField(receipt, ['receiveDateTime', 'dateTime']);
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function itemSignature(receipt: JsonRecord) {
  const items = Array.isArray(receipt.items) ? receipt.items.filter(isRecord) : [];
  return items
    .map((item) => ({
      name: String(item.name ?? '').trim().toLowerCase(),
      quantity: readAmount(item.quantity),
      sum: readAmount(item.sum),
    }))
    .sort((a, b) => `${a.name}:${a.quantity}:${a.sum}`.localeCompare(`${b.name}:${b.quantity}:${b.sum}`))
    .map((item) => `${item.name}|${item.quantity}|${item.sum}`)
    .join(';');
}

function itemsPreview(receipt: JsonRecord) {
  const items = Array.isArray(receipt.items) ? receipt.items.filter(isRecord) : [];
  return items.slice(0, 12).map((item, index) => ({
    index: index + 1,
    name: typeof item.name === 'string' ? item.name.slice(0, 120) : '',
    quantity: readAmount(item.quantity),
    sum: readAmount(item.sum),
    price: readAmount(item.price),
    paymentType: item.paymentType,
    normalizedPaymentType: normalizePaymentType(item.paymentType),
  }));
}

function findDirectLinkFields(value: unknown, path = '', links: Array<{ path: string; value: unknown }> = []) {
  if (Array.isArray(value)) {
    value.slice(0, 20).forEach((entry, index) => findDirectLinkFields(entry, `${path}[${index}]`, links));
    return links;
  }
  if (!isRecord(value)) return links;

  for (const [key, entry] of Object.entries(value)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (/(original|parent|related|linked|correction|base|reason|source|исход|основан|связан|родител)/i.test(key)) {
      links.push({ path: currentPath, value: sanitizeSample(entry, 0, key) });
    }
    if (isRecord(entry) || Array.isArray(entry)) findDirectLinkFields(entry, currentPath, links);
  }

  return links.slice(0, 20);
}

function possibleOriginalCandidates(returnReceipt: JsonRecord, receipts: FullReceiptProbeResult[]) {
  const returnFn = readStringField(returnReceipt, ['fiscalDriveNumber']);
  const returnTotal = readAmount(returnReceipt.totalSum);
  const returnDate = receiptTimestamp(returnReceipt);
  const returnItems = itemSignature(returnReceipt);

  return receipts
    .filter(({ receipt }) => !isReturnReceipt(receipt))
    .map(({ receipt }) => originalCandidate(returnReceipt, receipt, returnFn, returnTotal, returnDate, returnItems))
    .filter((candidate) => candidate.matchScore >= 4)
    .sort((a, b) => b.matchScore - a.matchScore || a.timeDeltaSeconds - b.timeDeltaSeconds)
    .slice(0, 5);
}

function rejectedOriginalCandidates(returnReceipt: JsonRecord, receipts: FullReceiptProbeResult[]) {
  const returnFn = readStringField(returnReceipt, ['fiscalDriveNumber']);
  const returnTotal = readAmount(returnReceipt.totalSum);
  const returnDate = receiptTimestamp(returnReceipt);
  const returnItems = itemSignature(returnReceipt);

  return receipts
    .filter(({ receipt }) => !isReturnReceipt(receipt))
    .map(({ receipt }) => originalCandidate(returnReceipt, receipt, returnFn, returnTotal, returnDate, returnItems))
    .filter((candidate) => candidate.matchScore >= 3 && !candidate.reasons.includes('return_after_sale'))
    .sort((a, b) => b.matchScore - a.matchScore || Math.abs(a.timeDeltaSeconds) - Math.abs(b.timeDeltaSeconds))
    .slice(0, 5);
}

function originalCandidate(_returnReceipt: JsonRecord, receipt: JsonRecord, returnFn: string, returnTotal: number, returnDate: number, returnItems: string) {
  const candidateFn = readStringField(receipt, ['fiscalDriveNumber']);
  const candidateTotal = readAmount(receipt.totalSum);
  const candidateDate = receiptTimestamp(receipt);
  const candidateItems = itemSignature(receipt);
  const timeDeltaSeconds = returnDate > 0 && candidateDate > 0 ? Math.round((returnDate - candidateDate) / 1000) : 0;
  const reasons = [
    candidateFn && candidateFn === returnFn ? 'same_fn' : '',
    candidateTotal === returnTotal ? 'same_total_sum' : '',
    candidateItems && candidateItems === returnItems ? 'same_items' : '',
    timeDeltaSeconds > 0 ? 'return_after_sale' : '',
  ].filter(Boolean);

  return {
    fiscalDocumentNumber: readStringField(receipt, ['fiscalDocumentNumber']),
    fiscalDriveNumber: candidateFn,
    fiscalSign: readStringField(receipt, ['fiscalSign']),
        date: readStringField(receipt, ['receiveDateTime', 'dateTime']),
        totalSum: candidateTotal,
    itemsPreview: itemsPreview(receipt),
    matchScore: reasons.length,
    timeDeltaSeconds,
    confidence: reasons.length >= 4 ? 'probable' : 'needs_review',
    reasons,
  };
}

function returnDiagnostics(receipts: FullReceiptProbeResult[]) {
  const returns = receipts.filter(({ receipt }) => isReturnReceipt(receipt));
  const samples = returns.slice(0, 5).map(({ receipt }) => {
    const directLinks = findDirectLinkFields(receipt);
    const possibleCandidates = possibleOriginalCandidates(receipt, receipts);
    const rejectedCandidates = rejectedOriginalCandidates(receipt, receipts);
    return {
      fiscalDocumentNumber: readStringField(receipt, ['fiscalDocumentNumber']),
      fiscalDriveNumber: readStringField(receipt, ['fiscalDriveNumber']),
      fiscalSign: readStringField(receipt, ['fiscalSign']),
      date: readStringField(receipt, ['receiveDateTime', 'dateTime']),
      totalSum: readAmount(receipt.totalSum),
      operationType: readAmount(receipt.operationType),
      itemsPreview: itemsPreview(receipt),
      sampleReturnKeys: Object.keys(receipt).slice(0, 80),
      directLinks,
      possibleOriginalCandidates: possibleCandidates,
      rejectedCandidates,
      matchingStatus:
        directLinks.length > 0
          ? 'direct_link_needs_review'
          : possibleCandidates.length === 1
            ? 'single_probable_candidate_needs_review'
            : possibleCandidates.length > 1
              ? 'multiple_candidates_needs_review'
              : 'not_found',
    };
  });

  const foundDirectLinks = samples.filter((sample) => sample.directLinks.length > 0).length;

  return {
    returnDocumentsChecked: returns.length,
    foundDirectLinks,
    matchingStatuses: samples.reduce<Record<string, number>>((acc, sample) => {
      acc[sample.matchingStatus] = (acc[sample.matchingStatus] ?? 0) + 1;
      return acc;
    }, {}),
    sampleReturnKeys: samples[0]?.sampleReturnKeys ?? [],
    possibleOriginalCandidates: samples.flatMap((sample) =>
      sample.possibleOriginalCandidates.map((candidate) => ({
        returnFiscalDocumentNumber: sample.fiscalDocumentNumber,
        returnDate: sample.date,
        returnTotalSum: sample.totalSum,
        ...candidate,
      }))
    ).slice(0, 10),
    rejectedCandidates: samples.flatMap((sample) =>
      sample.rejectedCandidates.map((candidate) => ({
        returnFiscalDocumentNumber: sample.fiscalDocumentNumber,
        returnDate: sample.date,
        returnTotalSum: sample.totalSum,
        ...candidate,
      }))
    ).slice(0, 10),
    samples,
    conclusion:
      returns.length === 0
        ? 'No return receipts were found in the checked sample.'
        : foundDirectLinks > 0
          ? 'Some returns expose direct link-like fields; verify whether these fields point to the original receipt before auto-closing issues.'
          : 'No direct original receipt links were found in checked returns; auto-closing should use fallback matching and remain needs_review until confirmed.',
  };
}

function receiptDiagnostics(receipts: FullReceiptProbeResult[]) {
  const sales = receipts.filter(({ receipt }) => readAmount(receipt.operationType) === 1);
  const returns = receipts.filter(({ receipt }) => isReturnReceipt(receipt));
  const selected = [...returns.slice(0, 5), ...sales.slice(0, 10)].slice(0, 12);

  const samples = selected.map(({ receipt, analysis, summary }) => {
    const directLinks = isReturnReceipt(receipt) ? findDirectLinkFields(receipt) : [];
    const possibleCandidates = isReturnReceipt(receipt) ? possibleOriginalCandidates(receipt, receipts) : [];
    const rejectedCandidates = isReturnReceipt(receipt) ? rejectedOriginalCandidates(receipt, receipts) : [];

    return {
      fiscalDocumentNumber: summary.fiscalDocumentNumber,
      fiscalDriveNumber: summary.fiscalDriveNumber,
      fiscalSign: summary.fiscalSign,
      date: summary.date,
      totalSum: summary.totalSum,
      cashTotalSum: summary.cashTotalSum,
      ecashTotalSum: summary.ecashTotalSum,
      creditSum: summary.creditSum,
      operationType: readAmount(receipt.operationType),
      receiptCode: readAmount(receipt.receiptCode),
      rawPaymentTypes: summary.rawPaymentTypes,
      normalizedPaymentTypes: summary.normalizedPaymentTypes,
      matchedRule: summary.matchedRule,
      issues: analysis.issues,
      itemsPreview: itemsPreview(receipt),
      directLinks,
      possibleOriginalCandidates: possibleCandidates,
      rejectedCandidates,
      matchingStatus: isReturnReceipt(receipt)
        ? directLinks.length > 0
          ? 'direct_link_needs_review'
          : possibleCandidates.length === 1
            ? 'single_probable_candidate_needs_review'
            : possibleCandidates.length > 1
              ? 'multiple_candidates_needs_review'
              : 'not_found'
        : 'sale_receipt_needs_review',
    };
  });

  return {
    documentsChecked: receipts.length,
    salesShown: samples.filter((sample) => sample.operationType === 1).length,
    returnsShown: samples.filter((sample) => sample.operationType === 2).length,
    samples,
  };
}

function addIssueCounts(target: Record<string, number>, issues: ReceiptIssue[]) {
  for (const issue of issues) {
    target[issue.code] = (target[issue.code] ?? 0) + 1;
  }
}

function receiptAnalysisAggregate(receipts: AnalyzedReceipt[]) {
  const issuesByCode: Record<string, number> = {};
  const withIssues = receipts.filter((receipt) => receipt.issues.length > 0);
  for (const receipt of withIssues) addIssueCounts(issuesByCode, receipt.issues);

  return {
    totalChecked: receipts.length,
    withIssues: withIssues.length,
    issuesByCode,
    rawPaymentTypes: uniqueValues(receipts.flatMap((receipt) => receipt.rawPaymentTypes)),
    normalizedPaymentTypes: uniqueValues(receipts.flatMap((receipt) => receipt.normalizedPaymentTypes)),
    sampleIssues: withIssues.slice(0, 10),
  };
}

export async function runSabyOfdProbe(options: SabyOfdProbeOptions = {}) {
  const config = readConfig();
  const missing = missingConfig(config);
  const steps: ProbeStep[] = [];
  const errors: string[] = [];
  const requestedLimit = Number.isFinite(options.limit) && options.limit && options.limit > 0 ? Math.min(Math.trunc(options.limit), 100) : 20;

  if (missing.length) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      enabled: config.enabled,
      configured: false,
      missing,
      steps,
      errors: [`Missing or disabled env: ${missing.join(', ')}`],
    };
  }

  const auth = await getAccessToken(config);
  steps.push(auth.step);
  if (!auth.sid && !auth.accessToken) {
    errors.push(auth.step.error ?? 'Saby service auth failed');
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      enabled: config.enabled,
      configured: true,
      steps,
      errors,
    };
  }

  if (!options.organizationInn) {
    steps.push({
      name: 'ofd.kkt_list',
      status: 'skipped',
      method: 'GET',
      path: '/ofd/v1/orgs/<inn>/kkts?status=2',
      error: 'organizationInn query parameter is required for Saby OFD REST probe',
    });
    errors.push('organizationInn query parameter is required for Saby OFD REST probe');
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      enabled: config.enabled,
      configured: true,
      steps,
      errors,
    };
  }

  let kktProbe = await restProbe(config, auth, `/ofd/v1/orgs/${encodeURIComponent(options.organizationInn)}/kkts?status=2`, 'ofd.kkt_list');
  steps.push(kktProbe.step);

  if (kktProbe.step.status === 'ok' && listItems(kktProbe.data).length === 0) {
    kktProbe = await restProbe(config, auth, `/ofd/v1/orgs/${encodeURIComponent(options.organizationInn)}/kkts`, 'ofd.kkt_list_all_statuses');
    steps.push(kktProbe.step);
  }

  const kkt = firstItem(kktProbe.data);
  const kktRegNumber = readStringField(kkt, ['regId', 'registrationNumber', 'kktRegId']) || findFirstString(kkt, [/reg/i, /registration/i]);
  const fn = readStringField(kkt, ['fsNumber', 'storageId', 'fn', 'fiscalDriveNumber']) || findFirstString(kkt, [/fsNumber/i, /storage/i, /fn/i, /fiscal/i]);

  if (kktProbe.step.status !== 'ok' || !kktRegNumber) {
    errors.push('KKT REST probe did not expose a recognizable KKT registration identifier');
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      enabled: config.enabled,
      configured: true,
      steps,
      errors,
    };
  }

  steps.push({
    name: 'ofd.fn_from_kkt',
    status: fn ? 'ok' : 'failed',
    path: 'ofd.kkt_list.fsNumber',
    responseKeys: responseKeys(kkt),
    sample: sanitizeSample({
      regId: kktRegNumber,
      fsNumber: fn,
    }),
    error: fn ? undefined : 'KKT response did not contain fsNumber / fiscal drive number',
  });

  if (!fn) {
    errors.push('KKT REST response did not expose a recognizable fiscal drive identifier');
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      enabled: config.enabled,
      configured: true,
      steps,
      errors,
    };
  }

  const range = probeDateRange(options);
  const windows = dateWindows(range.dateFrom, range.dateTo);
  const selectedReceipts: SelectedFiscalDocument[] = [];
  const queryLimit = Math.min(1000, Math.max(100, requestedLimit * 5));
  let documentListFailures = 0;

  for (const window of windows) {
    const documentsProbe = await restProbe(config, auth, documentListPath(options.organizationInn, kktRegNumber, fn, window, queryLimit), 'ofd.document_list');
    steps.push({
      ...documentsProbe.step,
      sample: {
        dateFrom: formatSabyDate(window.dateFrom),
        dateTo: formatSabyDate(window.dateTo),
        responseKeys: documentsProbe.step.responseKeys,
        receiptCount: receiptDocuments(documentsProbe.data).length,
      },
    });

    if (documentsProbe.step.status !== 'ok') {
      documentListFailures += 1;
      continue;
    }

    for (const receipt of receiptDocuments(documentsProbe.data)) {
      selectedReceipts.push(receipt);
      if (selectedReceipts.length >= requestedLimit) break;
    }
    if (selectedReceipts.length >= requestedLimit) break;
  }

  if (documentListFailures === windows.length) {
    errors.push('Fiscal document list probe failed for every requested date window');
  }

  const analyzedReceipts: AnalyzedReceipt[] = [];
  const fullReceipts: FullReceiptProbeResult[] = [];
  let fullDocumentFailures = 0;
  let sampleFullDocumentStep: ProbeStep | null = null;

  for (const selectedDocument of selectedReceipts) {
    const paths = fullDocumentPaths(options.organizationInn, kktRegNumber, fn, selectedDocument.document);
    let fullDocumentData: unknown = null;
    let fullDocumentStep: ProbeStep | null = null;

    for (const [index, path] of paths.entries()) {
      const result = await restProbe(config, auth, path, index === 0 ? 'ofd.document_full' : 'ofd.document_full_by_requisites');
      fullDocumentStep = result.step;
      if (result.step.status === 'ok') {
        fullDocumentData = result.data;
        break;
      }
    }

    if (!fullDocumentData || !fullDocumentStep) {
      fullDocumentFailures += 1;
      continue;
    }

    const receipt = unwrapFiscalDocument(fullDocumentData);
    if (!receipt) {
      fullDocumentFailures += 1;
      continue;
    }

    const analysis = analyzeReceiptForProbe(receipt);
    const summary = analyzedReceiptSummary(receipt, analysis);
    analyzedReceipts.push(summary);
    fullReceipts.push({
      receipt,
      analysis,
      summary,
      wrapperKey: selectedDocument.wrapperKey,
    });

    if (!sampleFullDocumentStep) {
      sampleFullDocumentStep = {
        ...fullDocumentStep,
        sample: fullDocumentSample(fullDocumentData),
      };
    }
  }

  if (sampleFullDocumentStep) {
    steps.push(sampleFullDocumentStep);
  } else {
    steps.push({
      name: 'ofd.document_full',
      status: selectedReceipts.length > 0 ? 'failed' : 'skipped',
      method: 'GET',
      error: selectedReceipts.length > 0 ? 'Full fiscal document probe failed for selected receipts' : 'Document list did not contain receipts for analysis',
    });
  }

  steps.push({
    name: 'ofd.receipt_analysis',
    status: 'ok',
    sample: {
      requestedDateFrom: formatSabyDate(range.dateFrom),
      requestedDateTo: formatSabyDate(range.dateTo),
      requestedLimit,
      selectedReceipts: selectedReceipts.length,
      fullDocumentFailures,
      ...receiptAnalysisAggregate(analyzedReceipts),
    },
  });

  const returns = returnDiagnostics(fullReceipts);
  const receiptMatches = receiptDiagnostics(fullReceipts);
  steps.push({
    name: 'ofd.return_diagnostics',
    status: 'ok',
    sample: returns,
  });
  steps.push({
    name: 'ofd.receipt_match_diagnostics',
    status: 'ok',
    sample: receiptMatches,
  });

  return {
    ok: errors.length === 0,
    checkedAt: new Date().toISOString(),
    enabled: config.enabled,
    configured: true,
    analysisSummary: receiptAnalysisAggregate(analyzedReceipts),
    returnDiagnostics: returns,
    receiptDiagnostics: receiptMatches,
    steps,
    errors,
  };
}
