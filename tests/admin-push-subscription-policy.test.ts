import assert from 'node:assert/strict';
import test from 'node:test';
import { adminPushRegistrationMode, requestHost } from '../lib/admin-push-subscription-policy';

test('the team domain owns the single active admin push subscription', () => {
  assert.equal(adminPushRegistrationMode('team.mobo-opt.ru'), 'primary-single');
  assert.equal(adminPushRegistrationMode('TEAM.MOBO-OPT.RU:443'), 'primary-single');
});

test('the old portal remains usable but does not register duplicate admin pushes', () => {
  assert.equal(adminPushRegistrationMode('portal.alebazia.xyz'), 'legacy-disabled');
});

test('development and preview hosts keep standard registration behavior', () => {
  assert.equal(adminPushRegistrationMode('localhost'), 'standard');
  assert.equal(adminPushRegistrationMode('preview.example.test'), 'standard');
});

test('forwarded host is preferred behind the production proxy', () => {
  const request = new Request('http://portal-app:3000/api/admin/push-subscription', {
    headers: { 'x-forwarded-host': 'team.mobo-opt.ru, proxy.internal' },
  });
  assert.equal(requestHost(request), 'team.mobo-opt.ru');
});

test('host header is used when the proxy does not provide x-forwarded-host', () => {
  const request = new Request('http://portal-app:3000/api/admin/push-subscription', {
    headers: { host: 'team.mobo-opt.ru' },
  });
  assert.equal(requestHost(request), 'team.mobo-opt.ru');
});
