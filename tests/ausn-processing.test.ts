import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';

import { processAusnDocument, waitForAusnProcessingResult } from '../lib/ausn-processing';

test('queues a validated fixed-schema request when bridge is unavailable', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ausn-intake-'));
  process.env.AUSN_PORTAL_INTAKE_DIR = root;
  delete process.env.AUSN_BRIDGE_HOST;
  delete process.env.AUSN_BRIDGE_KEY_PATH;
  const bytes = new TextEncoder().encode('%PDF-1.4\n');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const result = await processAusnDocument({ documentType: 'AUSN_CALCULATION', periodKey: '2026-09', extension: 'pdf', bytes, sha256 });
  assert.equal(result.status, 'failed');
  assert.ok(result.requestId);
  const request = JSON.parse(await readFile(path.join(root, 'pending', `${result.requestId}.json`), 'utf8'));
  assert.deepEqual(Object.keys(request).sort(), ['document_type', 'file_name', 'period_key', 'request_id', 'sha256']);
  assert.equal(request.document_type, 'AUSN_CALCULATION');
  assert.equal(request.sha256, sha256);
});

test('rejects an XLS file for row-level LK FNS processing', async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const result = await processAusnDocument({ documentType: 'AUSN_INCOME', periodKey: '2026-09', extension: 'xls', bytes, sha256: createHash('sha256').update(bytes).digest('hex') });
  assert.equal(result.status, 'failed');
  assert.match(result.message, /XLSX/);
});

test('retries a busy bridge instead of reading a missing result too early', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ausn-result-'));
  const resultPath = path.join(root, 'request.json');
  let calls = 0;
  const result = await waitForAusnProcessingResult({
    resultPath,
    invokeBridge: async () => {
      calls += 1;
      if (calls === 1) return { stdout: '{"status":"busy"}\n' };
      await writeFile(resultPath, JSON.stringify({ status: 'completed' }));
      return { stdout: '{"status":"completed"}\n' };
    },
    pause: async () => {},
  });
  assert.equal(calls, 2);
  assert.equal(result.status, 'completed');
});

test('turns a missing bridge result into a clear bounded error', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ausn-result-'));
  let clock = 0;
  await assert.rejects(
    waitForAusnProcessingResult({
      resultPath: path.join(root, 'missing.json'),
      invokeBridge: async () => ({ stdout: '{"status":"busy"}\n' }),
      pause: async () => { clock += 10; },
      now: () => clock,
      deadlineMs: 5,
    }),
    /не подтвердил завершение/,
  );
});

test('a refresh request carries no document and matches the runner REFRESH schema exactly', async () => {
  const { requestAusnRefresh } = await import('../lib/ausn-processing');
  const { mkdtemp, readdir, readFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const root = await mkdtemp(path.join(tmpdir(), 'ausn-refresh-'));
  const saved = { intake: process.env.AUSN_PORTAL_INTAKE_DIR, host: process.env.AUSN_BRIDGE_HOST, key: process.env.AUSN_BRIDGE_KEY_PATH };
  process.env.AUSN_PORTAL_INTAKE_DIR = root; delete process.env.AUSN_BRIDGE_HOST; delete process.env.AUSN_BRIDGE_KEY_PATH;
  try {
    const result = await requestAusnRefresh();
    assert.equal(result.status, 'failed');
    assert.match(result.message, /пересчёт/);
    const [name] = await readdir(path.join(root, 'pending'));
    const payload = JSON.parse(await readFile(path.join(root, 'pending', name), 'utf8'));
    assert.deepEqual(Object.keys(payload).sort(), ['document_type', 'request_id']);
    assert.equal(payload.document_type, 'REFRESH');
    assert.equal(`${payload.request_id}.json`, name);
  } finally {
    if (saved.intake === undefined) delete process.env.AUSN_PORTAL_INTAKE_DIR; else process.env.AUSN_PORTAL_INTAKE_DIR = saved.intake;
    if (saved.host !== undefined) process.env.AUSN_BRIDGE_HOST = saved.host;
    if (saved.key !== undefined) process.env.AUSN_BRIDGE_KEY_PATH = saved.key;
  }
});
