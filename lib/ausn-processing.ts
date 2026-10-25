import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const processableTypes = new Set(['AUSN_INCOME', 'ENS_OPERATIONS', 'AUSN_CALCULATION']);

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

  const host = process.env.AUSN_BRIDGE_HOST;
  const key = process.env.AUSN_BRIDGE_KEY_PATH;
  if (!host || !key) return { status: 'failed', requestId, message: 'Серверная обработка АУСН пока не подключена; документ сохранён, запрос оставлен в очереди.' };
  try {
    await execFileAsync('ssh', ['-i', key, '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${path.join(path.dirname(key), 'known_hosts')}`, '-o', 'PasswordAuthentication=no', '-o', 'KbdInteractiveAuthentication=no', '-o', 'ConnectTimeout=10', host], { timeout: 520_000, maxBuffer: 1024 * 1024 });
    const result = JSON.parse(await readFile(resultPath, 'utf8')) as { status?: string; error?: string };
    if (result.status !== 'completed') return { status: 'failed', requestId, message: result.error || 'Сервер не подтвердил обновление отчёта.' };
    return { status: 'completed', requestId, message: 'Документ проверен. Данные АУСН и полный отчёт обновлены.' };
  } catch (error) {
    return { status: 'failed', requestId, message: error instanceof Error ? `Документ сохранён, но отчёт не обновился: ${error.message}` : 'Документ сохранён, но отчёт не обновился.' };
  }
}
