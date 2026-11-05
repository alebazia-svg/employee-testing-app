import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm, utimes } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadVerifiedTaxFile } from '../lib/tax-verified-file-cache';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

test('reuses verified parsing and returns independent values', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tax-cache-'));
  try {
    const file = path.join(dir, 'source'); await writeFile(file, '{"value":1}');
    let reads = 0;
    const parse = (bytes: Buffer) => { reads++; return JSON.parse(bytes.toString()); };
    const sha = digest('{"value":1}');
    const a = await loadVerifiedTaxFile('test', file, sha, parse); a.value = 999;
    const b = await loadVerifiedTaxFile('test', file, sha, parse);
    assert.equal(b.value, 1); assert.equal(reads, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('changed or deleted latest source cannot reuse cached success', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tax-cache-'));
  try {
    const file = path.join(dir, 'source'); const sha = digest('good');
    await writeFile(file, 'good');
    const parse = (bytes: Buffer) => bytes.toString();
    assert.equal(await loadVerifiedTaxFile('test', file, sha, parse), 'good');
    await writeFile(file, 'evil'); // identical size; a forged mtime cannot hide ctime change
    await utimes(file, new Date(0), new Date(0));
    assert.equal(await loadVerifiedTaxFile('test', file, sha, parse), undefined);
    await rm(file);
    assert.equal(await loadVerifiedTaxFile('test', file, sha, parse), undefined);
    await writeFile(file, 'good');
    assert.equal(await loadVerifiedTaxFile('test', file, sha, parse), 'good');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('failed parsing is retried, not kept as a cached failure', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tax-cache-'));
  try {
    const file = path.join(dir, 'source'); await writeFile(file, 'good');
    let attempts = 0;
    const parse = () => { if (++attempts === 1) throw new Error('unavailable'); return 'ready'; };
    assert.equal(await loadVerifiedTaxFile('test', file, digest('good'), parse), undefined);
    assert.equal(await loadVerifiedTaxFile('test', file, digest('good'), parse), 'ready');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('a checksum change cannot reuse a prior value', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tax-cache-'));
  try {
    const file = path.join(dir, 'source'); await writeFile(file, 'good');
    const parse = (bytes: Buffer) => bytes.toString();
    assert.equal(await loadVerifiedTaxFile('test', file, digest('good'), parse), 'good');
    assert.equal(await loadVerifiedTaxFile('test', file, digest('other'), parse), undefined);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
