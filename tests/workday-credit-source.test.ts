import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkdayCreditDocuments, loadWorkdayCreditFiscal } from '../lib/workday-credit-source';
import type { OneCSalesRealizationDocument, OneCSalesRealizationsResult, OneCSalesRealizationFiscalOperationsResult } from '../lib/one-c';
const doc = (ref: string) => ({ ref } as OneCSalesRealizationDocument);
const page = (documents: OneCSalesRealizationDocument[], count = documents.length) => ({ ok: true, documents, responseDocumentCount: count, diagnostics: [] } as unknown as OneCSalesRealizationsResult);
const fiscal = (ref: string) => ({ realizationRef: ref, ok: true, fiscalized: true, operations: [] } as unknown as OneCSalesRealizationFiscalOperationsResult);

test('loads full pagination independently of unreliable hasMore', async () => {
  const offsets: number[] = [];
  const source = await loadWorkdayCreditDocuments('2026-11-08', async params => {
    offsets.push(params.offset);
    assert.equal(params.includeLines, false);
    return params.offset === 0 ? page(Array.from({ length: 100 }, (_, i) => doc(String(i)))) : page([doc('last')]);
  });
  assert.deepEqual(offsets, [0, 100]); assert.equal(source.ok, true); assert.equal(source.documents.length, 101);
});
test('hitting the bound or a failed page cannot declare partial data complete', async () => {
  const capped = await loadWorkdayCreditDocuments('2026-11-08', async () => page([doc('x')], 100));
  assert.equal(capped.ok, false); assert.match(capped.error!, /Полнота/);
  let calls = 0;
  const failed = await loadWorkdayCreditDocuments('2026-11-08', async () => ++calls === 1 ? page([doc('a')], 100) : { ...page([]), ok: false, error: 'offline' });
  assert.equal(failed.ok, false); assert.equal(failed.error, 'offline'); assert.equal(failed.documents.length, 1);
});
test('keeps all documents but reads fiscal details only for documents used by checks', async () => {
  const documents = [doc('needed'), doc('unused'), doc('needed')];
  const calls: string[] = [];
  const result = await loadWorkdayCreditFiscal({ ok: true, documents, fiscalByRealization: {} }, item => item.ref === 'needed', async ref => { calls.push(ref); return fiscal(ref); });
  assert.equal(result.documents, documents); assert.deepEqual(calls, ['needed']); assert.ok(result.fiscalByRealization.needed);
  const empty = await loadWorkdayCreditFiscal({ ok: true, documents, fiscalByRealization: {} }, () => false, async () => assert.fail('no completed checks'));
  assert.equal(empty.documents, documents); assert.deepEqual(empty.fiscalByRealization, {});
});
test('reuses a free slot instead of waiting for a whole four-document batch', async () => {
  const started: string[] = [], release = new Map<string, () => void>();
  const work = loadWorkdayCreditFiscal({ ok: true, documents: Array.from({ length: 6 }, (_, i) => doc(String(i))), fiscalByRealization: {} }, () => true, async ref => {
    started.push(ref); await new Promise<void>(resolve => release.set(ref, resolve)); return fiscal(ref);
  });
  assert.deepEqual(started, ['0', '1', '2', '3']);
  release.get('1')!(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, ['0', '1', '2', '3', '4']);
  release.get('4')!(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(started[5], '5');
  for (const finish of release.values()) finish();
  const result = await work; assert.equal(Object.keys(result.fiscalByRealization).length, 6);
});
test('incomplete source never triggers fiscal reads or gains a false success', async () => {
  const source = { ok: false, documents: [doc('a')], fiscalByRealization: {}, error: 'incomplete' };
  assert.equal(await loadWorkdayCreditFiscal(source, () => true, async () => assert.fail()), source);
});

test('an answer for a different realization cannot confirm the requested document', async () => {
  const source = await loadWorkdayCreditFiscal({ ok: true, documents: [doc('a')], fiscalByRealization: {} }, () => true, async () => fiscal('b'));
  assert.equal(source.fiscalByRealization.a.ok, false);
  assert.match(source.fiscalByRealization.a.error!, /другой реализации/);
});


test('exactly one thousand rows remain complete when the extra probe is empty', async () => {
  const result = await loadWorkdayCreditDocuments('2026-11-08', async params => params.offset === 1000 ? page([]) : page(Array.from({ length: 100 }, (_, i) => doc(String(params.offset + i)))));
  assert.equal(result.ok, true); assert.equal(result.documents.length, 1000);
});
