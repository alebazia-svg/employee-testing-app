import { spawn } from 'node:child_process';
import fs from 'node:fs';

const runtimeEnvPath = '/tmp/portal-one-c-runtime-env.json';
const keys = [
  '1C_BASE_URL',
  '1C_API_USER',
  '1C_API_PASSWORD',
  '1C_REQUEST_TIMEOUT_MS',
  '1C_CACHE_TTL_SECONDS',
  'NODE_ENV',
];

function writeRuntimeEnv() {
  const values = {};
  for (const key of keys) {
    const value = process.env[key];
    if (value) values[key] = value;
  }

  fs.writeFileSync(runtimeEnvPath, JSON.stringify(values), { mode: 0o600 });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with ${signal ?? code}`));
    });
  });
}

writeRuntimeEnv();
await run('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
await run('node', ['node_modules/next/dist/bin/next', 'start']);
