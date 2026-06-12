import 'server-only';
import process from 'node:process';

export type OneCRuntimeEnv = {
  baseUrl: string;
  user: string;
  password: string;
  requestTimeoutMs?: string;
  cacheTtlSeconds?: string;
  nodeEnv?: string;
};

export function readOneCRuntimeEnv(): OneCRuntimeEnv {
  return {
    baseUrl: (process.env['1C_BASE_URL'] ?? '').trim().replace(/\/+$/, ''),
    user: (process.env['1C_API_USER'] ?? '').trim(),
    password: process.env['1C_API_PASSWORD'] ?? '',
    requestTimeoutMs: process.env['1C_REQUEST_TIMEOUT_MS'],
    cacheTtlSeconds: process.env['1C_CACHE_TTL_SECONDS'],
    nodeEnv: process.env.NODE_ENV,
  };
}
