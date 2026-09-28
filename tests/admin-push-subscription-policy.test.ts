import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adminPushClientMode,
  adminPushRegistrationMode,
  requestHost,
  shouldDisableOtherAdminPushSubscriptions,
} from '../lib/admin-push-subscription-policy';

test('the team domain uses the primary admin push registration policy', () => {
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

test('only an installed PWA can replace another admin push subscription', () => {
  assert.equal(shouldDisableOtherAdminPushSubscriptions('primary-single', 'standalone'), true);
  assert.equal(shouldDisableOtherAdminPushSubscriptions('primary-single', 'browser'), false);
  assert.equal(shouldDisableOtherAdminPushSubscriptions('standard', 'standalone'), false);
  assert.equal(shouldDisableOtherAdminPushSubscriptions('legacy-disabled', 'standalone'), false);
});

test('missing or unrecognized client mode is treated as a browser', () => {
  assert.equal(adminPushClientMode('standalone'), 'standalone');
  assert.equal(adminPushClientMode('browser'), 'browser');
  assert.equal(adminPushClientMode(undefined), 'browser');
  assert.equal(adminPushClientMode('unexpected'), 'browser');
});
