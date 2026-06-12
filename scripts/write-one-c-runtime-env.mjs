import fs from 'node:fs';

const targetPath = '/tmp/portal-one-c-runtime-env.json';
const keys = [
  '1C_BASE_URL',
  '1C_API_USER',
  '1C_API_PASSWORD',
  '1C_REQUEST_TIMEOUT_MS',
  '1C_CACHE_TTL_SECONDS',
  'NODE_ENV',
];

const values = {};
for (const key of keys) {
  const value = process.env[key];
  if (value) values[key] = value;
}

fs.writeFileSync(targetPath, JSON.stringify(values), { mode: 0o600 });
