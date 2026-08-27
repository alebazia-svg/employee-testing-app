import assert from 'node:assert/strict';
import test from 'node:test';
import { infrastructureAction, parseInfrastructureChecks } from '../lib/infrastructure-watchdog';

test('parses safe infrastructure checks', () => {
  assert.deepEqual(parseInfrastructureChecks(JSON.stringify([
    { key: 'unit.bank', label: 'Банк', ok: true, detail: 'Последний запуск успешен' },
  ])), [{ key: 'unit.bank', label: 'Банк', ok: true, detail: 'Последний запуск успешен' }]);
});

test('rejects malformed infrastructure checks', () => {
  assert.throws(() => parseInfrastructureChecks('[{"key":"bad key","label":"X","ok":true}]'));
});

test('alerts only after three consecutive failures and silently clears a short outage', () => {
  assert.equal(infrastructureAction('healthy', false), 'record_pending_1');
  assert.equal(infrastructureAction('pending_1', false), 'record_pending_2');
  assert.equal(infrastructureAction('pending_2', false), 'alert_down');
  assert.equal(infrastructureAction('pending_1', true), 'recover_silently');
  assert.equal(infrastructureAction('pending_2', true), 'recover_silently');
  assert.equal(infrastructureAction('down', true), 'alert_recovered');
  assert.equal(infrastructureAction('healthy', true), 'none');
});
