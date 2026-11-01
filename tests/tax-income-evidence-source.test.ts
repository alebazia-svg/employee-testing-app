import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { loadIncomeEvidence } from '../lib/tax-income-evidence-source';
test('archived evidence requires the file checksum, known documents and the latest usable assessment', async () => {
 const root = await mkdtemp(path.join(tmpdir(), 'tax-evidence-'));
 try {
 const raw = { schema: 1, reviewedAt: '2026-11-01T00:00:00Z', title: 'Разбор', cases: [{ id: 'a', date: '2026-08-30', bank: 'Банк', amountCents: 30000, bankBaseCents: 0, fiscalBaseCents: null, identityResolved: false, fnsSearchComplete: false, finding: 'Проверка не завершена', internalNotes: [], sourceDocumentIds: ['source'] }] };
 const zip = new JSZip();zip.file('tax-income-evidence.json', JSON.stringify(raw)); const bytes = await zip.generateAsync({ type: 'nodebuffer' }); await writeFile(path.join(root, 'review.zip'), bytes);
 const doc = { id: 'source', documentType: 'CORRECTION_EVIDENCE', status: 'UPLOADED', originalName: 'AUSN_tax_evidence_test.zip', storageKey: 'review.zip', sha256: createHash('sha256').update(bytes).digest('hex'), createdAt: new Date('2026-11-01') };
 assert.equal((await loadIncomeEvidence([doc], root))?.cases[0].fiscalBaseCents, null);
 assert.equal(await loadIncomeEvidence([{ ...doc, sha256: '0'.repeat(64) }], root), undefined);
 assert.equal(await loadIncomeEvidence([{ ...doc, id: 'other' }], root), undefined);
 assert.equal(await loadIncomeEvidence([doc, { ...doc, id: 'new', status: 'PROCESSING_FAILED', createdAt: new Date('2026-11-02') }], root), undefined);
 assert.equal(await loadIncomeEvidence([{ ...doc, storageKey: '../review.zip' }], root), undefined);
 } finally { await rm(root, { recursive: true, force: true }); }
});
