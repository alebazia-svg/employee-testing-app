import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { createSessionToken, journalSessionToken, readSessionToken, sessionAccessId, sessionMatchesUser } from '../lib/session';
import { clearLoginFailures, loginAllowed, recordLoginFailure } from '../lib/login-rate-limit';

process.env.PORTAL_SESSION_SECRET = 'test-only-session-secret-with-at-least-32-characters';

test('signed session accepts an intact token before expiry', () => {
  const now = Date.UTC(2026, 7, 21);
  const token = createSessionToken(7, now);
  assert.deepEqual(readSessionToken(token, now + 1_000), {
    userId: 7,
    sessionVersion: 0,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
  });
});

test('signed session rejects tampering, expiry and legacy numeric cookies', () => {
  const now = Date.UTC(2026, 7, 21);
  const token = createSessionToken(7, now);
  assert.equal(readSessionToken(token.replace('.7.', '.1.'), now), null);
  assert.equal(readSessionToken(token, now + 31 * 24 * 60 * 60 * 1000), null);
  assert.equal(readSessionToken('7', now), null);
});

test('login attempts are temporarily limited per address and login', () => {
  const request = new Request('https://portal.example/login', { headers: { 'x-forwarded-for': '192.0.2.15' } });
  const now = Date.UTC(2026, 7, 21);
  for (let index = 0; index < 5; index += 1) recordLoginFailure(request, 'employee', now + index);
  assert.equal(loginAllowed(request, 'employee', now + 10), false);
  assert.equal(loginAllowed(request, 'employee', now + 16 * 60 * 1000), true);
  clearLoginFailures(request, 'employee');
});


test('legacy signed v1 sessions survive installation until their own account is reset', () => {
  const now = Date.UTC(2026, 9, 19);
  const payload = `v1.7.${now + 60_000}`;
  const token = `${payload}.${createHmac('sha256', process.env.PORTAL_SESSION_SECRET!).update(payload).digest('base64url')}`;
  const session = readSessionToken(token, now)!;
  assert.equal(session.sessionVersion, 0);
  assert.equal(sessionMatchesUser(session, { id: 7, isActive: true, sessionVersion: 0 }, now), true);
  assert.equal(sessionMatchesUser(session, { id: 7, isActive: true, sessionVersion: 1 }, now), false);
  assert.equal(sessionMatchesUser(session, { id: 8, isActive: true, sessionVersion: 0 }, now), false);
});

test('versioned sessions reject reset versions, disabled accounts, expiry and tampered versions', () => {
  const now = Date.UTC(2026, 9, 19);
  const token = createSessionToken(7, now, { sessionVersion: 4 });
  const session = readSessionToken(token, now)!;
  assert.equal(sessionMatchesUser(session, { id: 7, isActive: true, sessionVersion: 4 }, now), true);
  assert.equal(sessionMatchesUser(session, { id: 7, isActive: true, sessionVersion: 5 }, now), false);
  assert.equal(sessionMatchesUser(session, { id: 7, isActive: false, sessionVersion: 4 }, now), false);
  assert.equal(sessionMatchesUser(session, { id: 7, isActive: true, sessionVersion: 4 }, session.expiresAt), false);
  assert.equal(readSessionToken(token.replace('.4.', '.5.'), now), null);
  assert.equal(readSessionToken(token + '.extra', now), null);
});

test('renewal preserves the journal identity of v1 and v2 sessions', () => {
  const now = Date.UTC(2026, 10, 25);
  const legacyPayload = `v1.7.${now + 60_000}`;
  const legacySignature = createHmac('sha256', process.env.PORTAL_SESSION_SECRET!).update(legacyPayload).digest('base64url');
  const versioned = createSessionToken(7, now, { sessionVersion: 4, maxAgeSeconds: 60 });
  for (const token of [`${legacyPayload}.${legacySignature}`, versioned]) {
    const previous = readSessionToken(token, now)!;
    const accessId = sessionAccessId(token, previous);
    const renewed = createSessionToken(7, now, { sessionVersion: previous.sessionVersion, accessId });
    const after = now + 61_000;
    assert.equal(readSessionToken(token, after), null);
    const session = readSessionToken(renewed, after)!;
    assert.equal(sessionAccessId(renewed, session), accessId);
    assert.equal(session.sessionVersion, previous.sessionVersion);
    assert.equal(session.expiresAt, now + 30 * 86_400_000);
    assert.equal(readSessionToken(renewed.replace(accessId, 'a'.repeat(64)), after), null);
  }
});

test('rollback can read the primary cookie and the journal companion requires the matching primary cookie', () => {
  const now = Date.now();
  const primary = createSessionToken(7, now, { sessionVersion: 4 });
  const companion = createSessionToken(7, now, { sessionVersion: 4, accessId: 'b'.repeat(64) });
  assert.match(primary, /^v2\./);
  assert.equal(journalSessionToken(primary, companion), companion);
  assert.equal(journalSessionToken(undefined, companion), undefined);
  const other = createSessionToken(7, now + 1, { sessionVersion: 4 });
  assert.equal(journalSessionToken(other, companion), other);
});
