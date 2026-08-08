import 'server-only';

import { randomUUID } from 'crypto';

const PRODUCTION_BASE_URL = 'https://business.tbank.ru/openapi';
const SANDBOX_BASE_URL = 'https://business.tbank.ru/openapi/sandbox';
const SANDBOX_TOKEN = 'TBankSandboxToken';

type TBankEnvironment = 'production' | 'sandbox';

type TBankConfig = {
  enabled: boolean;
  environment: TBankEnvironment;
  baseUrl: string;
  token: string;
  timeoutMs: number;
};

export type TBankTerminal = {
  key: string;
  id: string;
};

export type TBankTerminalOperation = {
  rrn: string;
  transactionDate: string;
  amountKopecks: number;
  amountRubles: number;
  maskedCardNumber: string;
  type: 'Debit' | 'Credit' | 'Other';
};

export type TBankTerminalsResult = {
  ok: boolean;
  checkedAt: string;
  environment: TBankEnvironment;
  configured: boolean;
  durationMs: number;
  status?: number;
  requestId: string;
  terminals: TBankTerminal[];
  totalElements: number | null;
  totalPages: number | null;
  error?: string;
};

export type TBankOperationsResult = {
  ok: boolean;
  checkedAt: string;
  environment: TBankEnvironment;
  configured: boolean;
  durationMs: number;
  status?: number;
  requestId: string;
  terminalKey: string;
  from: string;
  till: string;
  operations: TBankTerminalOperation[];
  lastTransactionDate: string;
  error?: string;
};

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function getConfig(): TBankConfig {
  const environment: TBankEnvironment = process.env.TBANK_API_ENV === 'sandbox' ? 'sandbox' : 'production';
  const configuredBaseUrl = process.env.TBANK_API_BASE_URL?.trim().replace(/\/+$/, '');
  const configuredToken = process.env.TBANK_API_TOKEN?.trim();

  return {
    enabled: process.env.TBANK_ACQUIRING_ENABLED === 'true',
    environment,
    baseUrl: configuredBaseUrl || (environment === 'sandbox' ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL),
    token: configuredToken || (environment === 'sandbox' ? SANDBOX_TOKEN : ''),
    timeoutMs: readPositiveInteger(process.env.TBANK_REQUEST_TIMEOUT_MS, 10_000),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function maskCardNumber(value: unknown) {
  const source = readString(value);
  if (!source) return '';
  const lastFour = source.replace(/\D/g, '').slice(-4);
  return lastFour ? `•••• ${lastFour}` : 'скрыта';
}

function readError(body: unknown, fallback: string) {
  if (!isRecord(body)) return fallback;
  return readString(body.errorMessage) || readString(body.message) || readString(body.error) || fallback;
}

async function request(path: string, config: TBankConfig) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/json',
        'X-Request-Id': requestId,
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text;
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
      requestId: response.headers.get('x-request-id') || requestId,
      body,
    };
  } catch (error) {
    const message = error instanceof Error
      ? (error.name === 'AbortError' ? `T-Bank API timeout after ${config.timeoutMs} ms` : error.message)
      : 'T-Bank API request failed';
    return { ok: false, durationMs: Date.now() - startedAt, requestId, body: null, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

function configurationError(config: TBankConfig) {
  if (!config.enabled) return 'T-Bank acquiring integration is disabled';
  if (!config.token) return 'TBANK_API_TOKEN is not configured';
  return '';
}

export async function getTBankTerminals(): Promise<TBankTerminalsResult> {
  const config = getConfig();
  const checkedAt = new Date().toISOString();
  const configError = configurationError(config);
  if (configError) {
    return {
      ok: false,
      checkedAt,
      environment: config.environment,
      configured: false,
      durationMs: 0,
      requestId: '',
      terminals: [],
      totalElements: null,
      totalPages: null,
      error: configError,
    };
  }

  const response = await request('/api/v1/tacq/terminals?page=0&size=100', config);
  const source = isRecord(response.body) ? response.body : {};
  const rawTerminals = Array.isArray(source.terminals) ? source.terminals : [];
  const terminals = rawTerminals.flatMap((value): TBankTerminal[] => {
    if (!isRecord(value)) return [];
    const key = readString(value.key);
    const id = readString(value.id);
    return key && id ? [{ key, id }] : [];
  });

  return {
    ok: response.ok,
    checkedAt,
    environment: config.environment,
    configured: true,
    durationMs: response.durationMs,
    status: response.status,
    requestId: response.requestId,
    terminals,
    totalElements: readNumber(source.totalElements),
    totalPages: readNumber(source.totalPages),
    error: response.ok ? undefined : (response.error || readError(response.body, `T-Bank API returned HTTP ${response.status ?? 'error'}`)),
  };
}

export async function getTBankTerminalOperations(params: {
  terminalKey: string;
  from: string;
  till: string;
  limit?: number;
}): Promise<TBankOperationsResult> {
  const config = getConfig();
  const checkedAt = new Date().toISOString();
  const terminalKey = params.terminalKey.trim();
  const fromDate = new Date(params.from);
  const tillDate = new Date(params.till);
  const limit = Math.min(Math.max(Math.trunc(params.limit ?? 1000), 1), 1000);
  const configError = configurationError(config);
  let validationError = configError;

  if (!terminalKey) validationError ||= 'terminalKey is required';
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(tillDate.getTime())) validationError ||= 'from and till must be valid dates';
  if (!validationError && (tillDate <= fromDate || tillDate.getTime() - fromDate.getTime() > 24 * 60 * 60 * 1000)) {
    validationError = 'T-Bank operation interval must be greater than zero and no longer than 24 hours';
  }

  if (validationError) {
    return {
      ok: false,
      checkedAt,
      environment: config.environment,
      configured: !configError,
      durationMs: 0,
      requestId: '',
      terminalKey,
      from: params.from,
      till: params.till,
      operations: [],
      lastTransactionDate: '',
      error: validationError,
    };
  }

  const query = new URLSearchParams({
    from: fromDate.toISOString(),
    till: tillDate.toISOString(),
    limit: String(limit),
  });
  const response = await request(`/api/v1/tacq/operations/terminal/${encodeURIComponent(terminalKey)}?${query}`, config);
  const source = isRecord(response.body) ? response.body : {};
  const rawOperations = Array.isArray(source.operations) ? source.operations : [];
  const operations = rawOperations.flatMap((value): TBankTerminalOperation[] => {
    if (!isRecord(value)) return [];
    const amountKopecks = readNumber(value.amount);
    const rawType = readString(value.type);
    const type: TBankTerminalOperation['type'] = rawType === 'Debit' || rawType === 'Credit' ? rawType : 'Other';
    if (amountKopecks === null) return [];
    return [{
      rrn: readString(value.rrn),
      transactionDate: readString(value.transactionDate),
      amountKopecks,
      amountRubles: amountKopecks / 100,
      maskedCardNumber: maskCardNumber(value.cardNumber),
      type,
    }];
  });

  return {
    ok: response.ok,
    checkedAt,
    environment: config.environment,
    configured: true,
    durationMs: response.durationMs,
    status: response.status,
    requestId: response.requestId,
    terminalKey,
    from: fromDate.toISOString(),
    till: tillDate.toISOString(),
    operations,
    lastTransactionDate: readString(source.lastTransactionDate),
    error: response.ok ? undefined : (response.error || readError(response.body, `T-Bank API returned HTTP ${response.status ?? 'error'}`)),
  };
}
