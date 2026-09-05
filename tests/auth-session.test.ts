import assert from 'node:assert/strict';
import test from 'node:test';
import { createPasswordBoundSessionToken, readSessionToken, sessionMatchesPasswordHash } from '../lib/session';
import { clearLoginFailures, loginAllowed, recordLoginFailure } from '../lib/login-rate-limit';

process.env.PORTAL_SESSION_SECRET = 'test-only-session-secret-with-at-least-32-characters';

test('signed session accepts an intact token before expiry', () => {
  const now = Date.UTC(2026, 7, 21);
  const token = createPasswordBoundSessionToken(7, 'hash-before-change', now);
  const session = readSessionToken(token, now + 1_000);
  assert.equal(session?.userId, 7);
  assert.equal(session?.expiresAt, now + 30 * 24 * 60 * 60 * 1000);
  assert.match(session?.credentialKey ?? '', /^[A-Za-z0-9_-]{43}$/);
  assert.equal(sessionMatchesPasswordHash(session!, 'hash-before-change'), true);
  assert.equal(sessionMatchesPasswordHash(session!, 'hash-after-change'), false);
});

test('signed session rejects tampering, expiry and legacy numeric cookies', () => {
  const now = Date.UTC(2026, 7, 21);
  const token = createPasswordBoundSessionToken(7, 'hash-before-change', now);
  assert.equal(readSessionToken(token.replace('.7.', '.1.'), now), null);
  assert.equal(readSessionToken(token, now + 31 * 24 * 60 * 60 * 1000), null);
  assert.equal(readSessionToken('7', now), null);
  assert.equal(readSessionToken(`v1.7.${now + 1_000}.legacy-signature`, now), null);
});

test('login attempts are temporarily limited per address and login', () => {
  const request = new Request('https://portal.example/login', { headers: { 'x-forwarded-for': '192.0.2.15' } });
  const now = Date.UTC(2026, 7, 21);
  for (let index = 0; index < 5; index += 1) recordLoginFailure(request, 'employee', now + index);
  assert.equal(loginAllowed(request, 'employee', now + 10), false);
  assert.equal(loginAllowed(request, 'employee', now + 16 * 60 * 1000), true);
  clearLoginFailures(request, 'employee');
});
