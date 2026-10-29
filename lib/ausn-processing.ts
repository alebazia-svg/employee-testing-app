import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const processableTypes = new Set(['AUSN_INCOME', 'ENS_OPERATIONS', 'AUSN_CALCULATION']);
const bridgeRetryDelayMs = 2_000;
const bridgeResultDeadlineMs = 17 * 60_000;

type ProcessingInput = { documentType: string; periodKey: string; extension: string; bytes: Uint8Array; sha256: string };
export type AusnProcessingResult = { status: 'not_required' | 'completed' | 'failed'; message: string; requestId?: string };

function intakeRoot() {
  return process.env.AUSN_PORTAL_INTAKE_DIR || '/app/runtime/ausn-intake';
}

async function atomicWrite(target: string, data: Uint8Array | string) {
  await mkdir(path.dirname(target), { recursive: true, mode: 0o750 });
  const temporary = `${target}.${randomBytes(8).toString('hex')}.tmp`;
  await writeFile(temporary, data, { mode: 0o640, flag: 'wx' });
  await rename(temporary, target);
}

type StoredProcessingResult = { status?: string; error?: string };

async function readProcessingResult(resultPath: string): Promise<StoredProcessingResult | null> {
  try {
    return JSON.parse(await readFile(resultPath, 'utf8')) as StoredProcessingResult;
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

function bridgeStatus(stdout: string) {
  const line = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!line) return undefined;
  try {
    const payload = JSON.parse(line) as { status?: string };
    return payload.status;
  } catch {
    return undefined;
  }
}

export async function waitForAusnProcessingResult(input: {
  resultPath: string;
  invokeBridge: () => Promise<{ stdout: string }>;
  pause?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  deadlineMs?: number;
}) {
  const pause = input.pause ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const now = input.now ?? Date.now;
  const deadline = now() + (input.deadlineMs ?? bridgeResultDeadlineMs);

  while (true) {
    const response = await input.invokeBridge();
    const result = await readProcessingResult(input.resultPath);
    if (result) return result;

    const status = bridgeStatus(response.stdout);
    if (!['busy', 'idle'].includes(status || '') || now() >= deadline) {
      throw new Error('Сервер не подтвердил завершение обработки документа.');
    }
    await pause(bridgeRetryDelayMs);
  }
}

export async function processAusnDocument(input: ProcessingInput): Promise<AusnProcessingResult> {
  if (!processableTypes.has(input.documentType)) return { status: 'not_required', message: 'Документ сохранён в постоянном архиве.' };
  if (input.documentType === 'AUSN_INCOME' && input.extension !== 'xlsx') return { status: 'failed', message: 'Для обновления данных нужна выгрузка «Доходы АУСН» в формате XLSX.' };
  if (input.documentType === 'ENS_OPERATIONS' && !['zip', 'csv'].includes(input.extension)) return { status: 'failed', message: 'Для сверки ЕНС нужна выгрузка ZIP или CSV.' };
  if (input.documentType === 'AUSN_CALCULATION' && input.extension !== 'pdf') return { status: 'failed', message: 'Справка о расчёте АУСН должна быть в PDF.' };

  const requestId = randomBytes(16).toString('hex');
  const fileName = `${requestId}.${input.extension}`;
  const root = intakeRoot();
  const filePath = path.join(root, 'files', fileName);
  const requestPath = path.join(root, 'pending', `${requestId}.json`);
  const resultPath = path.join(root, 'results', `${requestId}.json`);
  const actualSha = createHash('sha256').update(input.bytes).digest('hex');
  if (actualSha !== input.sha256) return { status: 'failed', message: 'Контрольная сумма файла изменилась до обработки.' };
  await atomicWrite(filePath, input.bytes);
  await atomicWrite(requestPath, JSON.stringify({ request_id: requestId, document_type: input.documentType, file_name: fileName, sha256: input.sha256, period_key: input.periodKey }));

  return runBridge(requestId, resultPath, 'document');
}

// Sends a queued request through the narrow portal → runner bridge and waits for
// its own result file. Shared by document processing and plain refreshes.
async function runBridge(requestId: string, resultPath: string, kind: 'document' | 'refresh'): Promise<AusnProcessingResult> {
  const host = process.env.AUSN_BRIDGE_HOST;
  const key = process.env.AUSN_BRIDGE_KEY_PATH;
  if (!host || !key) return { status: 'failed', requestId, message: kind === 'document' ? 'Серверная обработка АУСН пока не подключена; документ сохранён, запрос оставлен в очереди.' : 'Серверный пересчёт АУСН пока не подключён.' };
  try {
    const args = ['-i', key, '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${path.join(path.dirname(key), 'known_hosts')}`, '-o', 'PasswordAuthentication=no', '-o', 'KbdInteractiveAuthentication=no', '-o', 'ConnectTimeout=10', host];
    const result = await waitForAusnProcessingResult({
      resultPath,
      invokeBridge: async () => {
        const response = await execFileAsync('ssh', args, { timeout: 520_000, maxBuffer: 1024 * 1024 });
        return { stdout: response.stdout };
      },
    });
    if (result.status !== 'completed') return { status: 'failed', requestId, message: result.error || 'Сервер не подтвердил обновление отчёта.' };
    return { status: 'completed', requestId, message: kind === 'document' ? 'Документ проверен. Данные АУСН и полный отчёт обновлены.' : 'Цифры пересчитаны по свежим данным 1С, банка и кассы.' };
  } catch (error) {
    return { status: 'failed', requestId, message: kind === 'document' ? 'Документ сохранён, но серверная обработка не завершилась. Повторите загрузку позже — дубликат файла не создастся.' : 'Сервер не успел пересчитать цифры. Попробуйте ещё раз через несколько минут.' };
  }
}

// Re-runs the canonical full and current AUSN reports without a document, so the
// portal and limit notifications do not keep showing stale figures. Used by the
// «Обновить цифры» button and by the daily refresh job.
export async function requestAusnRefresh(): Promise<AusnProcessingResult> {
  const requestId = randomBytes(16).toString('hex');
  const root = intakeRoot();
  await atomicWrite(path.join(root, 'pending', `${requestId}.json`), JSON.stringify({ request_id: requestId, document_type: 'REFRESH' }));
  return runBridge(requestId, path.join(root, 'results', `${requestId}.json`), 'refresh');
}
