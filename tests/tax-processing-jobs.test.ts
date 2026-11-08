import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createTaxProcessingJobs, type TaxJobLock } from '../lib/tax-processing-jobs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tax-job-recovery-'));
  const statuses = new Map<string, string>();
  let tail = Promise.resolve();
  const lock: TaxJobLock = (id, task) => {
    const work = tail.then(() => task({ setStatus: async value => { statuses.set(id, value); } }));
    tail = work.then(() => {}, () => {});
    return work;
  };
  await mkdir(path.join(root, 'results'));
  return { root, statuses, jobs: createTaxProcessingJobs(root, lock), restart: () => createTaxProcessingJobs(root, lock) };
}

test('a fresh instance restores a completed result after the original callback disappeared', async () => {
  const f = await fixture();
  const job = await f.jobs.begin('document');
  await writeFile(path.join(f.root, 'results', `${job.attempt}.json`), JSON.stringify({ status: 'completed' }));
  assert.equal(f.statuses.get('document'), 'UPLOADED');
  const restored = await f.restart().reconcile('document');
  assert.equal(restored?.state, 'done');
  assert.equal(f.statuses.get('document'), 'PROCESSED');
});

test('older late failure cannot replace the newer completed attempt, including after restart', async () => {
  const f = await fixture();
  const old = await f.jobs.begin('document');
  const current = await f.jobs.begin('document');
  await f.jobs.finish('document', current.attempt, { state: 'done' });
  assert.equal(await f.jobs.finish('document', old.attempt, { state: 'failed' }), null);
  await writeFile(path.join(f.root, 'results', `${old.attempt}.json`), JSON.stringify({ status: 'failed', error: 'old failure' }));
  assert.equal((await f.restart().reconcile('document'))?.state, 'done');
  assert.equal(f.statuses.get('document'), 'PROCESSED');
});

test('an absent result remains unconfirmed and does not invent success or failure', async () => {
  const f = await fixture();
  await f.jobs.begin('document');
  assert.equal((await f.restart().reconcile('document'))?.state, 'processing');
  assert.equal(f.statuses.get('document'), 'UPLOADED');
  assert.equal(await f.jobs.reconcile('legacy-document'), null);
});

test('a late durable result replaces a temporary bridge failure; failed result retains its explanation', async () => {
  const f = await fixture();
  const job = await f.jobs.begin('document');
  await f.jobs.finish('document', job.attempt, { state: 'failed', message: 'bridge configuration' });
  await writeFile(path.join(f.root, 'results', `${job.attempt}.json`), JSON.stringify({ status: 'completed' }));
  assert.equal((await f.restart().reconcile('document'))?.state, 'done');
  const next = await f.jobs.begin('document');
  await writeFile(path.join(f.root, 'results', `${next.attempt}.json`), JSON.stringify({ status: 'failed', error: 'Wrong columns' }));
  assert.equal((await f.jobs.reconcile('document'))?.message, 'Wrong columns');
  assert.equal(f.statuses.get('document'), 'PROCESSING_FAILED');
});

test('independent documents do not consume each other’s result', async () => {
  const f = await fixture();
  const a = await f.jobs.begin('a');
  await f.jobs.begin('b');
  await writeFile(path.join(f.root, 'results', `${a.attempt}.json`), JSON.stringify({ status: 'completed' }));
  await Promise.all([f.jobs.reconcile('a'), f.jobs.reconcile('b')]);
  assert.equal(f.statuses.get('a'), 'PROCESSED');
  assert.equal(f.statuses.get('b'), 'UPLOADED');
});

test('a late transport timeout cannot demote a result already recovered from disk', async () => {
  const f = await fixture();
  const job = await f.jobs.begin('document');
  await writeFile(path.join(f.root, 'results', `${job.attempt}.json`), JSON.stringify({ status: 'completed' }));
  await f.jobs.reconcile('document');
  await f.jobs.finish('document', job.attempt, { state: 'processing', message: 'timeout' });
  await f.jobs.finish('document', job.attempt, { state: 'failed', message: 'late exception' });
  assert.equal(f.statuses.get('document'), 'PROCESSED');
  assert.equal((await f.restart().reconcile('document'))?.state, 'done');
});
