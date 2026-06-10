type OneCConfig = {
  baseUrl: string;
  user: string;
  password: string;
  timeoutMs: number;
  cacheTtlSeconds: number;
};

type OneCEndpoint = 'ping' | 'version' | 'info';

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

let cachedHealth: { expiresAt: number; value: OneCHealthResult } | null = null;

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function getConfig(): OneCConfig {
  return {
    baseUrl: (process.env['1C_BASE_URL'] ?? '').trim().replace(/\/+$/, ''),
    user: (process.env['1C_API_USER'] ?? '').trim(),
    password: process.env['1C_API_PASSWORD'] ?? '',
    timeoutMs: readPositiveInteger(process.env['1C_REQUEST_TIMEOUT_MS'], 5000),
    cacheTtlSeconds: readPositiveInteger(process.env['1C_CACHE_TTL_SECONDS'], 0),
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

function formatError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') return 'Request timed out';
  if (error instanceof Error) return error.message;
  return 'Unknown request error';
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
    environment: extractEnvironment(info.data) ?? process.env.NODE_ENV ?? null,
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
