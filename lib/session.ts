import { createHmac, timingSafeEqual } from 'node:crypto';

export const sessionCookieName = 'offonika_session';
export const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

type SessionPayload = {
  userId: number;
  expiresAt: number;
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

export function createSessionToken(userId: number, now = Date.now()) {
  const expiresAt = now + sessionMaxAgeSeconds * 1000;
  const payload = `v1.${userId}.${expiresAt}`;
  return `${payload}.${signature(payload)}`;
}

export function readSessionToken(token: string | undefined, now = Date.now()): SessionPayload | null {
  if (!token) return null;
  const [version, userIdRaw, expiresAtRaw, providedSignature, ...extra] = token.split('.');
  if (version !== 'v1' || extra.length || !providedSignature) return null;

  const userId = Number(userIdRaw);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(expiresAt) || expiresAt <= now) return null;

  const payload = `${version}.${userId}.${expiresAt}`;
  const expected = Buffer.from(signature(payload));
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  return { userId, expiresAt };
}
