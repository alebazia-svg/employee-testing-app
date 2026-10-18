import test from 'node:test';
import assert from 'node:assert/strict';
import { accessClientIp } from '../lib/portal-access-network';
import { accessIsAdministrative, accessCurrentConnections } from '../lib/portal-access-view';
import { observationWithin } from '../lib/portal-observation-deadline';
import type { AccessJournalRow } from '../components/PortalAccessJournal';

test('IP requires verified proxy opt-in, is validated, and never trusts arbitrary XFF', () => {
  const headers = new Headers({ 'x-real-ip': '203.0.113.24', 'x-forwarded-for': '198.51.100.99, 10.0.0.1' });
  assert.equal(accessClientIp(headers, false), undefined);
  assert.equal(accessClientIp(headers, true), '203.0.113.24');
  assert.equal(accessClientIp(new Headers({ 'x-forwarded-for': '203.0.113.24' }), true), undefined);
  for (const invalid of ['203.0.113.24, 1.1.1.1', '127.0.0.1:3000', 'unknown', 'x'.repeat(500), '999.1.1.1']) {
    assert.equal(accessClientIp(new Headers({ 'x-real-ip': invalid }), true), undefined);
  }
  assert.equal(accessClientIp(new Headers({ 'x-real-ip': '2001:db8::1' }), true), '2001:db8::1');
});

test('admin and same-browser cross-account connections are separate, with explicit shared-PC override', () => {
  const row = { role: 'EMPLOYEE', isService: false };
  assert.equal(accessIsAdministrative(row), false);
  assert.equal(accessIsAdministrative({ ...row, role: 'ADMIN' }), true);
  assert.equal(accessIsAdministrative({ ...row, adminObserved: true }), true);
  assert.equal(accessIsAdministrative({ ...row, adminObserved: true, serviceMarkedAt: '2026-10-18T11:00:00Z' }), false);
  assert.equal(accessIsAdministrative({ ...row, ownerInspection: true, serviceMarkedAt: '2026-10-18T11:00:00Z' }), true);
  // IP/name never determine classification or consolidation.
  const base = { ...row, login: 'buyer', device: 'iPhone', browser: 'Safari', lastIp: '203.0.113.1', lastSeenAt: '2026-10-18T11:00:00Z' } as AccessJournalRow;
  const records = [{ ...base, id: 'a', browserInstanceId: 'one' }, { ...base, id: 'b', browserInstanceId: 'two' }];
  assert.equal(accessCurrentConnections(records).length, 2);
  assert.ok(records.every(r => !accessIsAdministrative(r)));
});

test('stalled or failed subscription read cannot block version reporting', async () => {
  assert.equal(await observationWithin(() => new Promise(() => {}), undefined, 10), undefined);
  assert.equal(await observationWithin(async () => { throw Error('permission'); }, undefined, 10), undefined);
  assert.equal(await observationWithin(async () => null, undefined, 10), null);
  assert.equal(await observationWithin(async () => 'subscription', undefined, 10), 'subscription');
});
