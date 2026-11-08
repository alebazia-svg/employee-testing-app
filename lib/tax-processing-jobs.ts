import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type TaxProcessingJob = { attempt: string; state: 'processing' | 'done' | 'failed'; message?: string };
type LockedDocument = { setStatus: (status: 'UPLOADED' | 'PROCESSED' | 'PROCESSING_FAILED') => Promise<void> };
export type TaxJobLock = <T>(id: string, task: (document: LockedDocument) => Promise<T>) => Promise<T>;

// Metadata lives on the existing persistent intake volume. The supplied DB lock
// serializes registration/reconciliation across web workers, not just one Node.
export function createTaxProcessingJobs(root: string, lock: TaxJobLock) {
  const jobPath = (id: string) => path.join(root, 'portal-jobs', `${createHash('sha256').update(id).digest('hex')}.json`);
  async function readJson(file: string): Promise<unknown | null> {
    try { return JSON.parse(await readFile(file, 'utf8')); }
    catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
      throw error;
    }
  }
  async function read(id: string): Promise<TaxProcessingJob | null> {
    const value = await readJson(jobPath(id)) as TaxProcessingJob | null;
    if (value && (!/^[a-f0-9]{32}$/.test(value.attempt) || !['processing', 'done', 'failed'].includes(value.state))) throw new Error('Некорректное состояние обработки документа.');
    return value;
  }
  async function save(id: string, value: TaxProcessingJob) {
    const target = jobPath(id);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o750 });
    const temporary = `${target}.${randomBytes(8).toString('hex')}.tmp`;
    await writeFile(temporary, JSON.stringify(value), { mode: 0o640, flag: 'wx' });
    await rename(temporary, target);
  }
  const status = (job: TaxProcessingJob) => job.state === 'done' ? 'PROCESSED' as const : job.state === 'failed' ? 'PROCESSING_FAILED' as const : 'UPLOADED' as const;
  return {
    async begin(id: string) {
      return lock(id, async document => {
        const job: TaxProcessingJob = { attempt: randomBytes(16).toString('hex'), state: 'processing' };
        await save(id, job);
        await document.setStatus('UPLOADED');
        return job;
      });
    },
    async finish(id: string, attempt: string, result: { state: TaxProcessingJob['state']; message?: string }) {
      return lock(id, async document => {
        const job = await read(id);
        if (!job || job.attempt !== attempt) return null;
        if (job.state === 'done' || job.state !== 'processing' && result.state === 'processing') return job;
        const next = { ...job, ...result };
        await save(id, next);
        await document.setStatus(status(next));
        return next;
      });
    },
    async reconcile(id: string) {
      // Legacy/archive rows without a durable job need no DB transaction.
      if (!await read(id)) return null;
      return lock(id, async document => {
        let job = await read(id);
        if (!job) return null; // Pre-upgrade uploads retain their existing status.
        const result = await readJson(path.join(root, 'results', `${job.attempt}.json`)) as { status?: string; error?: string } | null;
        // Missing/incomplete results never prove failure. Do not resubmit work.
        if (result?.status === 'completed' || result?.status === 'failed') {
          job = { ...job, state: result.status === 'completed' ? 'done' : 'failed', message: typeof result.error === 'string' ? result.error : undefined };
          await save(id, job);
        }
        if (job.state !== 'processing') await document.setStatus(status(job));
        return job;
      });
    },
  };
}
