import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';

import { processAusnDocument } from '../lib/ausn-processing';

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
