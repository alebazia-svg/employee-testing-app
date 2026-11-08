import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function harness(processDocument: (input: { onQueued: () => void }) => Promise<{ status: string; message?: string }>) {
  const source = readFileSync('app/api/admin/taxes/documents/route.ts', 'utf8');
  const start = source.indexOf('async function processInBackground(');
  const end = source.indexOf('export async function POST', start);
  assert.ok(start > 0 && end > start);
  const compiled = ts.transpileModule(source.slice(start, end) + '\nreturn processInBackground;', { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  const results: Array<{ state: string; message?: string }> = [];
  const jobs = { begin: async () => ({ attempt: 'attempt' }), finish: async (_id: string, _attempt: string, result: { state: string }) => { results.push(result); } };
  return { start: new Function('taxProcessingJobs', 'processAusnDocument', compiled)(() => jobs, processDocument), results };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('acceptance waits for durable queue registration but not for long processing', async () => {
  let queued!: () => void, complete!: (result: { status: string }) => void, accepted = false;
  const durable = new Promise<void>(resolve => { queued = resolve; });
  const outcome = new Promise<{ status: string }>(resolve => { complete = resolve; });
  const h = harness(async input => { await durable; input.onQueued(); return outcome; });
  const request = h.start('doc', {}).then(() => { accepted = true; });
  await flush(); assert.equal(accepted, false);
  queued(); await request;
  assert.equal(accepted, true); assert.equal(h.results.length, 0);
  complete({ status: 'completed' }); await flush();
  assert.equal(h.results[0].state, 'done');
});

test('a queue persistence failure is rejected instead of falsely acknowledged', async () => {
  const h = harness(async () => { throw new Error('disk unavailable'); });
  await assert.rejects(h.start('doc', {}), /не удалось передать/);
  assert.equal(h.results[0].state, 'failed');
});

test('a lost response after durable queuing stays unconfirmed, not failed', async () => {
  const h = harness(async input => { input.onQueued(); throw new Error('connection closed'); });
  await h.start('doc', {}); await flush();
  assert.equal(h.results[0].state, 'processing');
});
