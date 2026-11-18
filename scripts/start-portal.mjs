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
const children = new Set();
let stopping = false;
let restartTimer;

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  clearTimeout(restartTimer);
  for (const child of children) child.kill('SIGTERM');
}

function start(args, onClose) {
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  children.add(child);
  child.on('error', error => console.error(error.message));
  child.once('close', code => {
    children.delete(child);
    if (!stopping) onClose(code);
  });
}

function startWorker() {
  start(['--conditions=react-server', '--import', 'tsx', 'scripts/retail-cash-handover-worker.ts'], () => {
    console.error('Обработчик передачи кассы остановился. Повтор запуска через 10 секунд.');
    restartTimer = setTimeout(startWorker, 10000);
  });
}

process.on('SIGTERM', () => stop(0));
process.on('SIGINT', () => stop(0));
start(['node_modules/next/dist/bin/next', 'start'], code => stop(code ?? 1));
if (process.env.RETAIL_CASH_HANDOVER_ENABLED === '1' || process.env.RETAIL_CASH_HANDOVER_TEST_ENABLED === '1') {
  startWorker();
}
