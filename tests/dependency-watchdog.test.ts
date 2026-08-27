import test from 'node:test';
import assert from 'node:assert/strict';
import { daysUntilExpiry, expiryWarning, parseDependencyExpiries } from '@/lib/dependency-watchdog';

test('calculates subscription deadlines in Moscow calendar days', () => {
  const now = new Date('2026-08-27T20:30:00Z');
  assert.equal(daysUntilExpiry('2026-08-28', now), 1);
  assert.equal(daysUntilExpiry('2026-09-03', now), 7);
});

test('uses stable threshold event keys without daily duplicate alerts', () => {
  const warning = expiryWarning({ key: 'ofd', label: 'ОФД', expiresOn: '2026-09-03' }, new Date('2026-08-27T10:00:00Z'));
  assert.equal(warning?.threshold, 7);
  assert.equal(warning?.eventKey, 'dependency:ofd:expiry:2026-09-03:7');
});

test('accepts only complete dated registry rows', () => {
  assert.deepEqual(parseDependencyExpiries('[{"key":"ofd","label":"ОФД","expiresOn":"2026-09-03"},{"key":"bad"}]'), [
    { key: 'ofd', label: 'ОФД', expiresOn: '2026-09-03', renewalUrl: undefined },
  ]);
});
