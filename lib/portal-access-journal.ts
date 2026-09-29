import 'server-only';
import { createHash } from 'node:crypto';
import { prisma } from './prisma';
import { readSessionToken } from './session';
import { accessDevice, type AccessPushState } from './portal-access-device';

export function accessSessionIdentity(token: string | undefined, userId: number, now = new Date()) {
  const session = readSessionToken(token, now.getTime());
  if (!session || session.userId !== userId) return null;
  return { sessionHash: createHash('sha256').update(`portal-access-v1:${token}`).digest('hex'), expiresAt: new Date(session.expiresAt) };
}
type PushObservation = { permission: 'granted' | 'denied' | 'default' | 'unsupported' | 'unknown'; endpoint?: string };
export function parsePushObservation(value: unknown): PushObservation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (Object.keys(p).some(k => !['permission', 'endpoint'].includes(k))) return null;
  if (!['granted', 'denied', 'default', 'unsupported', 'unknown'].includes(String(p.permission))) return null;
  if (p.endpoint !== undefined && (typeof p.endpoint !== 'string' || p.endpoint.length > 4096 || !p.endpoint.startsWith('https://'))) return null;
  return p as PushObservation;
}
export async function recordPortalAccess(input: { userId: number; token: string | undefined; userAgent: string; login?: boolean; push?: PushObservation; now?: Date }) {
  const now = input.now ?? new Date();
  const identity = accessSessionIdentity(input.token, input.userId, now);
  if (!identity) return;
  const where = { sessionHash: identity.sessionHash, userId: input.userId };
  const existing = await prisma.portalAccessSession.findUnique({ where: { sessionHash: identity.sessionHash } });
  if (existing && (existing.userId !== input.userId || existing.loggedOutAt)) return;
  // One write per minute, regardless of how many tabs are open. Login is always captured.
  if (!input.login && existing && (!input.push || existing.pushCheckedAt) && now.getTime() - existing.lastSeenAt.getTime() < 60000) return;
  let pushState: AccessPushState = 'unknown';
  let pushSubscriptionId: number | null = null;
  if (input.push) {
    pushState = input.push.permission === 'denied' ? 'blocked' : input.push.permission === 'unsupported' ? 'unsupported'
      : input.push.permission === 'unknown' ? 'unknown' : 'not_connected';
    if (input.push.permission === 'granted' && input.push.endpoint) {
      const subscription = await prisma.workdayPushSubscription.findFirst({ where: { endpoint: input.push.endpoint, userId: input.userId, disabledAt: null }, select: { id: true } });
      if (subscription) { pushState = 'connected'; pushSubscriptionId = subscription.id; }
    }
  }
  if (!existing) await prisma.portalAccessSession.createMany({ skipDuplicates: true, data: [{ ...identity, ...accessDevice(input.userAgent), userId: input.userId,
    firstSeenAt: now, lastSeenAt: now, loginAt: input.login ? now : null,
    ...(input.push ? { pushState, pushSubscriptionId, pushCheckedAt: now } : {}),
  }] });
  if (existing) await prisma.portalAccessSession.updateMany({ where: { ...where, loggedOutAt: null, lastSeenAt: existing.lastSeenAt }, data: {
    lastSeenAt: now, ...(input.login ? { loginAt: now } : {}),
    ...(input.push ? { pushState, pushSubscriptionId, pushCheckedAt: now } : {}),
  } });
}
export async function recordPortalLogout(token: string | undefined, userId: number) {
  const now = new Date(); const identity = accessSessionIdentity(token, userId, now);
  if (!identity) return;
  await prisma.portalAccessSession.updateMany({ where: { sessionHash: identity.sessionHash, userId, loggedOutAt: null }, data: { loggedOutAt: now, lastSeenAt: now } });
}
