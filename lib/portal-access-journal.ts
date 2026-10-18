import 'server-only';
import { createHash } from 'node:crypto';
import { prisma } from './prisma';
import { readSessionToken } from './session';
import { accessDevice, type AccessPushState } from './portal-access-device';
import type { PortalDisplayMode } from './portal-display-mode';
import { parseAppObservation, type AppObservation } from './portal-app-observation';

export function accessSessionIdentity(token: string | undefined, userId: number, now = new Date()) {
  const session = readSessionToken(token, now.getTime());
  if (!session || session.userId !== userId) return null;
  return { sessionHash: createHash('sha256').update(`portal-access-v1:${token}`).digest('hex'), expiresAt: new Date(session.expiresAt) };
}
type PushObservation = { permission: 'granted' | 'denied' | 'default' | 'unsupported' | 'unknown'; endpoint?: string; displayMode?: PortalDisplayMode; app?: AppObservation };
export function parsePushObservation(value: unknown): PushObservation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (Object.keys(p).some(k => !['permission', 'endpoint', 'displayMode', 'app'].includes(k))) return null;
  if (p.app !== undefined && !parseAppObservation(p.app)) return null;
  if (p.displayMode !== undefined && (typeof p.displayMode !== 'string' || !['app', 'browser', 'unknown'].includes(p.displayMode))) return null;
  if (typeof p.permission !== 'string' || !['granted', 'denied', 'default', 'unsupported', 'unknown'].includes(p.permission)) return null;
  if (p.endpoint !== undefined && (typeof p.endpoint !== 'string' || p.endpoint.length > 4096 || !p.endpoint.startsWith('https://'))) return null;
  return p as PushObservation;
}
export async function recordPortalAccess(input: { userId: number; token: string | undefined; userAgent: string; browserInstanceId?: string; login?: boolean; push?: PushObservation; now?: Date }) {
  const now = input.now ?? new Date();
  const identity = accessSessionIdentity(input.token, input.userId, now);
  if (!identity) return;
  const where = { sessionHash: identity.sessionHash, userId: input.userId };
  const existing = await prisma.portalAccessSession.findUnique({ where: { sessionHash: identity.sessionHash } });
  if (existing && (existing.userId !== input.userId || existing.loggedOutAt)) return;
  // One write per minute, regardless of how many tabs are open. Login is always captured.
  if (!input.login && existing && (!input.browserInstanceId || existing.browserInstanceId) && (!input.push || existing.pushCheckedAt) && now.getTime() - existing.lastSeenAt.getTime() < 60000) return;
  // Identity is not authentication. Bind once; later cookie changes never move an existing session.
  const browserIdentity = !existing?.browserInstanceId && input.browserInstanceId ? { browserInstanceId: input.browserInstanceId } : {};
  const priorClassification = browserIdentity.browserInstanceId && !existing?.serviceMarkedAt
    ? await prisma.portalAccessSession.findFirst({ where: { userId: input.userId, browserInstanceId: browserIdentity.browserInstanceId, serviceMarkedAt: { not: null } }, orderBy: { serviceMarkedAt: 'desc' }, select: { isService: true, serviceMarkedAt: true, serviceMarkedBy: true } }) : null;
  const classification = priorClassification ?? {};
  let pushState: AccessPushState = 'unknown';
  const context = input.push?.displayMode ? { displayMode: input.push.displayMode, contextCheckedAt: now } : {};
  // Keep the last known association for diagnostics if the browser no longer
  // returns an endpoint. It does not make the observation connected; readers
  // independently check subscription ownership and active state.
  let pushSubscriptionId: number | null = existing?.pushSubscriptionId ?? null;
  if (input.push) {
    pushState = input.push.permission === 'denied' ? 'blocked' : input.push.permission === 'unsupported' ? 'unsupported'
      : input.push.permission === 'unknown' ? 'unknown' : 'not_connected';
    if (input.push.permission === 'granted' && input.push.endpoint) {
      const subscription = await prisma.workdayPushSubscription.findFirst({ where: { endpoint: input.push.endpoint, userId: input.userId }, select: { id: true } });
      pushSubscriptionId = subscription?.id ?? null;
      if (subscription) pushState = 'connected';
    }
  }
  if (!existing) await prisma.portalAccessSession.createMany({ skipDuplicates: true, data: [{ ...identity, ...accessDevice(input.userAgent), userId: input.userId,
    firstSeenAt: now, lastSeenAt: now, loginAt: input.login ? now : null, ...context, ...browserIdentity, ...classification,
    ...(input.push ? { pushState, pushSubscriptionId, pushCheckedAt: now } : {}),
  }] });
  if (existing) await prisma.portalAccessSession.updateMany({ where: { ...where, loggedOutAt: null, lastSeenAt: existing.lastSeenAt }, data: {
    lastSeenAt: now, ...context, ...browserIdentity, ...classification, ...(input.login ? { loginAt: now } : {}),
    ...(input.push ? { pushState, pushSubscriptionId, pushCheckedAt: now } : {}),
  } });
}
export async function recordPortalLogout(token: string | undefined, userId: number) {
  const now = new Date(); const identity = accessSessionIdentity(token, userId, now);
  if (!identity) return;
  await prisma.portalAccessSession.updateMany({ where: { sessionHash: identity.sessionHash, userId, loggedOutAt: null }, data: { loggedOutAt: now, lastSeenAt: now } });
}
