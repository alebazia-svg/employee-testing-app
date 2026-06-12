import 'server-only';
import fs from 'node:fs';
import process from 'node:process';

export type OneCRuntimeEnv = {
  baseUrl: string;
  user: string;
  password: string;
  requestTimeoutMs?: string;
  cacheTtlSeconds?: string;
  nodeEnv?: string;
};

const ONE_C_ENV_KEYS = [
  '1C_BASE_URL',
  '1C_API_USER',
  '1C_API_PASSWORD',
  '1C_REQUEST_TIMEOUT_MS',
  '1C_CACHE_TTL_SECONDS',
  'NODE_ENV',
] as const;

function readProcEnv(path: string): Record<string, string> {
  try {
    return fs.readFileSync(path, 'utf8')
      .split('\0')
      .reduce<Record<string, string>>((env, entry) => {
        const index = entry.indexOf('=');
        if (index > 0) env[entry.slice(0, index)] = entry.slice(index + 1);
        return env;
      }, {});
  } catch {
    return {};
  }
}

function readRuntimeValue(key: typeof ONE_C_ENV_KEYS[number]) {
  const direct = process.env[key];
  if (direct) return direct;

  for (const env of [readProcEnv('/proc/self/environ'), readProcEnv('/proc/1/environ')]) {
    const value = env[key];
    if (value) return value;
  }

  return '';
}

export function readOneCRuntimeEnv(): OneCRuntimeEnv {
  return {
    baseUrl: readRuntimeValue('1C_BASE_URL').trim().replace(/\/+$/, ''),
    user: readRuntimeValue('1C_API_USER').trim(),
    password: readRuntimeValue('1C_API_PASSWORD'),
    requestTimeoutMs: readRuntimeValue('1C_REQUEST_TIMEOUT_MS'),
    cacheTtlSeconds: readRuntimeValue('1C_CACHE_TTL_SECONDS'),
    nodeEnv: readRuntimeValue('NODE_ENV'),
  };
}
