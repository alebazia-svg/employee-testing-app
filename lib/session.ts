import { createHmac, timingSafeEqual } from 'node:crypto';

export const sessionCookieName = 'offonika_session';
export const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

type SessionPayload = { userId: number; expiresAt: number; sessionVersion: number };

function sessionSecret() {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('PORTAL_SESSION_SECRET must contain at least 32 characters.');
  return secret;
}

function signature(payload: string) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

export function createSessionToken(userId: number, now = Date.now(), options: { sessionVersion?: number; maxAgeSeconds?: number } = {}) {
  const version = options.sessionVersion ?? 0;
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(version) || version < 0) throw new Error('Invalid session identity');
  const expiresAt = now + (options.maxAgeSeconds ?? sessionMaxAgeSeconds) * 1000;
  const payload = `v2.${userId}.${expiresAt}.${version}`;
  return `${payload}.${signature(payload)}`;
}

export function readSessionToken(token: string | undefined, now = Date.now()): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  const legacy = parts[0] === 'v1';
  if ((legacy && parts.length !== 4) || (!legacy && (parts[0] !== 'v2' || parts.length !== 5))) return null;
  const userId = Number(parts[1]);
  const expiresAt = Number(parts[2]);
  const sessionVersion = legacy ? 0 : Number(parts[3]);
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(expiresAt) || expiresAt <= now
    || !Number.isSafeInteger(sessionVersion) || sessionVersion < 0 || (!legacy && !/^\d+$/.test(parts[3]))) return null;
  const payload = parts.slice(0, -1).join('.');
  const expected = Buffer.from(signature(payload));
  const provided = Buffer.from(parts[parts.length - 1]);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  return { userId, expiresAt, sessionVersion };
}

export function sessionMatchesUser(session: SessionPayload, user: {
  id: number; isActive: boolean; sessionVersion: number;
}, now = Date.now()) {
  return session.userId === user.id && user.isActive && session.sessionVersion === user.sessionVersion
    && session.expiresAt > now;
}
