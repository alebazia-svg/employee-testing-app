import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInfrastructureChecks } from '../lib/infrastructure-watchdog';

test('parses safe infrastructure checks', () => {
  assert.deepEqual(parseInfrastructureChecks(JSON.stringify([
    { key: 'unit.bank', label: 'Банк', ok: true, detail: 'Последний запуск успешен' },
  ])), [{ key: 'unit.bank', label: 'Банк', ok: true, detail: 'Последний запуск успешен' }]);
});

test('rejects malformed infrastructure checks', () => {
  assert.throws(() => parseInfrastructureChecks('[{"key":"bad key","label":"X","ok":true}]'));
});
