import { createHmac, timingSafeEqual } from 'node:crypto';

export const sessionCookieName = 'offonika_session';
export const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

type SessionPayload = {
  userId: number;
  expiresAt: number;
  credentialKey: string;
};

function sessionSecret() {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('PORTAL_SESSION_SECRET must contain at least 32 characters.');
  }
  return secret;
}

function signature(payload: string) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

function credentialKey(passwordHash: string) {
  return createHmac('sha256', sessionSecret()).update(`credential:${passwordHash}`).digest('base64url');
}

export function createPasswordBoundSessionToken(userId: number, passwordHash: string, now = Date.now()) {
  const expiresAt = now + sessionMaxAgeSeconds * 1000;
  const payload = `v2.${userId}.${expiresAt}.${credentialKey(passwordHash)}`;
  return `${payload}.${signature(payload)}`;
}

export function readSessionToken(token: string | undefined, now = Date.now()): SessionPayload | null {
  if (!token) return null;
  const [version, userIdRaw, expiresAtRaw, sessionCredentialKey, providedSignature, ...extra] = token.split('.');
  if (version !== 'v2' || extra.length || !sessionCredentialKey || !providedSignature) return null;

  const userId = Number(userIdRaw);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(expiresAt) || expiresAt <= now) return null;

  const payload = `${version}.${userId}.${expiresAt}.${sessionCredentialKey}`;
  const expected = Buffer.from(signature(payload));
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  return { userId, expiresAt, credentialKey: sessionCredentialKey };
}

export function sessionMatchesPasswordHash(session: SessionPayload, passwordHash: string) {
  const expected = Buffer.from(credentialKey(passwordHash));
  const provided = Buffer.from(session.credentialKey);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
