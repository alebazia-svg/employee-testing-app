import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const sessionCookieName = 'offonika_session';
export const sessionAccessCookieName = 'offonika_session_access';
export const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

type SessionPayload = { userId: number; expiresAt: number; sessionVersion: number; accessId?: string };

function sessionSecret() {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('PORTAL_SESSION_SECRET must contain at least 32 characters.');
  return secret;
}

function signature(payload: string) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

export function createSessionToken(userId: number, now = Date.now(), options: { sessionVersion?: number; maxAgeSeconds?: number; accessId?: string } = {}) {
  const version = options.sessionVersion ?? 0;
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(version) || version < 0) throw new Error('Invalid session identity');
  const expiresAt = now + (options.maxAgeSeconds ?? sessionMaxAgeSeconds) * 1000;
  const payload = options.accessId
    ? `v3.${userId}.${expiresAt}.${version}.${options.accessId}`
    : `v2.${userId}.${expiresAt}.${version}`;
  return `${payload}.${signature(payload)}`;
}

export function readSessionToken(token: string | undefined, now = Date.now()): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  const legacy = parts[0] === 'v1';
  const renewed = parts[0] === 'v3';
  if (legacy ? parts.length !== 4 : renewed ? parts.length !== 6 : parts[0] !== 'v2' || parts.length !== 5) return null;
  if (renewed && !/^[a-f0-9]{64}$/.test(parts[4])) return null;
  const userId = Number(parts[1]);
  const expiresAt = Number(parts[2]);
  const sessionVersion = legacy ? 0 : Number(parts[3]);
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(expiresAt) || expiresAt <= now
    || !Number.isSafeInteger(sessionVersion) || sessionVersion < 0 || (!legacy && !/^\d+$/.test(parts[3]))) return null;
  const payload = parts.slice(0, -1).join('.');
  const expected = Buffer.from(signature(payload));
  const provided = Buffer.from(parts[parts.length - 1]);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  return { userId, expiresAt, sessionVersion, ...(renewed ? { accessId: parts[4] } : {}) };
}

/** The primary cookie remains readable by the previous release. The optional
 * signed companion preserves journal identity and is bound to that exact login. */
export function journalSessionToken(primary?: string, companion?: string) {
  if (!primary?.startsWith('v2.') || !companion) return primary;
  const session = readSessionToken(primary);
  const access = readSessionToken(companion);
  if (session && access?.accessId && access.userId === session.userId
    && access.sessionVersion === session.sessionVersion && access.expiresAt === session.expiresAt) return companion;
  return primary;
}

export function sessionTokenFromCookies(jar: { get(name: string): { value: string } | undefined }) {
  return journalSessionToken(jar.get(sessionCookieName)?.value, jar.get(sessionAccessCookieName)?.value);
}

export function sessionAccessId(token: string, session: SessionPayload) {
  return session.accessId ?? createHash('sha256').update(`portal-access-v1:${token}`).digest('hex');
}

export function sessionMatchesUser(session: SessionPayload, user: {
  id: number; isActive: boolean; sessionVersion: number;
}, now = Date.now()) {
  return session.userId === user.id && user.isActive && session.sessionVersion === user.sessionVersion
    && session.expiresAt > now;
}
