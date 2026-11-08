import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmsCabinetReplacement, probeAcquiringDependency } from '../lib/acquiring-dependency-probe';

const now = new Date('2026-11-08T12:00:00Z');
const config = { aqsiKey: true, mappings: 'retail-a=1,retail-b=2' };
test('probes all active aQsi mappings rather than the unused legacy API', async () => {
  const seen: string[] = [];
  const result = await probeAcquiringDependency({ config, now,
    readOperations: async input => { seen.push(input.terminalKey); assert.equal(input.from, '2026-11-08T00:00:00+03:00'); assert.equal(input.to, now.toISOString()); return { complete: true }; },
    readLegacyTerminals: async () => { throw new Error('Legacy must not be called'); },
  });
  assert.deepEqual(seen, ['retail-a', 'retail-b']);
  assert.equal(result.ok, true); assert.equal(result.source, 'aqsi');
});
test('one incomplete or failing terminal cannot report healthy', async () => {
  for (const mode of ['incomplete', 'throw']) {
    const result = await probeAcquiringDependency({ config, now,
      readOperations: async ({ terminalKey }) => {
        if (terminalKey === 'retail-b' && mode === 'throw') throw new Error('private upstream payload');
        return { complete: terminalKey === 'retail-a' };
      }, readLegacyTerminals: async () => ({ ok: true }),
    });
    assert.equal(result.ok, false); assert.match(result.detail ?? '', /1 из 2/); assert.ok(!(result.detail ?? '').includes('private'));
  }
});
test('missing, duplicate and malformed mappings fail closed', async () => {
  for (const mappings of ['', 'a=1,a=2', 'a=1=2', 'a=', '=2']) {
    const result = await probeAcquiringDependency({ config: { aqsiKey: true, mappings }, now,
      readOperations: async () => { throw new Error('Must not read an invalid mapping'); },
      readLegacyTerminals: async () => ({ ok: true }),
    });
    assert.equal(result.ok, false); assert.equal(result.source, 'aqsi');
  }
});
test('single-terminal compatibility and genuine legacy deployments remain supported', async () => {
  const a = await probeAcquiringDependency({ config: { aqsiKey: true, legacyKey: 'a', legacyId: '1' }, now,
    readOperations: async ({ terminalKey }) => ({ complete: terminalKey === 'a' }), readLegacyTerminals: async () => ({ ok: false }) });
  assert.equal(a.ok, true);
  const b = await probeAcquiringDependency({ config: { aqsiKey: false }, now,
    readOperations: async () => { throw new Error('No aQsi credentials'); }, readLegacyTerminals: async () => ({ ok: true }) });
  assert.equal(b.ok, true); assert.equal(b.source, 'legacy');
});
test('old cabinet incident resolves only after confirmed replacement; no false recovery or repeated recovery', () => {
  const valid = { cabinetEnabled: false, source: 'aqsi', ok: true, latestType: 'dependency.down' };
  assert.equal(confirmsCabinetReplacement(valid), true);
  for (const patch of [{ cabinetEnabled: true }, { source: 'legacy' }, { ok: false }, { latestType: 'dependency.recovered' }, { latestType: undefined }]) {
    assert.equal(confirmsCabinetReplacement({ ...valid, ...patch }), false);
  }
});
